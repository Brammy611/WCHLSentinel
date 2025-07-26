use candid::{CandidType, Deserialize};
use ic_cdk::{query, update, init, pre_upgrade, post_upgrade};
use std::cell::RefCell;
use std::collections::HashMap;
use serde_bytes::ByteBuf;
use tract_onnx::prelude::*;
use image::{ImageBuffer, Rgb};
use ndarray::{Array, Array4, Axis};

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct BoundingBox {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct FaceDetectionResult {
    pub face_detected: bool,
    pub face_count: u32,
    pub bounding_boxes: Vec<BoundingBox>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct FaceRecognitionResult {
    pub face_detected: bool,
    pub face_count: u32,
    pub face_embeddings: Vec<f32>,
    pub bounding_boxes: Vec<BoundingBox>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum ModelStatus {
    NotLoaded,
    Loading,
    Ready,
    Error(String),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct CanisterStats {
    pub face_detection_model_status: ModelStatus,
    pub face_recognition_model_status: ModelStatus,
    pub total_detections: u64,
    pub total_recognitions: u64,
    pub model_detection_size: u64,
    pub model_recognition_size: u64,
}

#[derive(Debug)]
struct CanisterState {
    face_detection_model_bytes: Vec<u8>,
    face_recognition_model_bytes: Vec<u8>,
    face_detection_model: Option<TypedRunnableModel<f32>>,
    face_recognition_model: Option<TypedRunnableModel<f32>>,
    face_detection_model_status: ModelStatus,
    face_recognition_model_status: ModelStatus,
    stats: CanisterStats,
}

impl Default for CanisterState {
    fn default() -> Self {
        Self {
            face_detection_model_bytes: Vec::new(),
            face_recognition_model_bytes: Vec::new(),
            face_detection_model: None,
            face_recognition_model: None,
            face_detection_model_status: ModelStatus::NotLoaded,
            face_recognition_model_status: ModelStatus::NotLoaded,
            stats: CanisterStats {
                face_detection_model_status: ModelStatus::NotLoaded,
                face_recognition_model_status: ModelStatus::NotLoaded,
                total_detections: 0,
                total_recognitions: 0,
                model_detection_size: 0,
                model_recognition_size: 0,
            },
        }
    }
}

thread_local! {
    static STATE: RefCell<CanisterState> = RefCell::new(CanisterState::default());
}

#[init]
fn init() {
    ic_cdk::println!("Face Recognition Canister initialized");
}

#[pre_upgrade]
fn pre_upgrade() {
    STATE.with(|state| {
        let state = state.borrow();
        let serialized = serde_json::to_string(&state.stats).unwrap_or_default();
        ic_cdk::storage::stable_save((serialized,)).unwrap();
    });
}

#[post_upgrade]
fn post_upgrade() {
    let (serialized_stats,): (String,) = ic_cdk::storage::stable_restore().unwrap_or_default();
    
    if !serialized_stats.is_empty() {
        if let Ok(stats) = serde_json::from_str::<CanisterStats>(&serialized_stats) {
            STATE.with(|state| {
                let mut state = state.borrow_mut();
                state.stats = stats;
            });
        }
    }
}

#[update]
fn clear_face_detection_model_bytes() {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.face_detection_model_bytes.clear();
        state.face_detection_model = None;
        state.face_detection_model_status = ModelStatus::NotLoaded;
        state.stats.face_detection_model_status = ModelStatus::NotLoaded;
        state.stats.model_detection_size = 0;
    });
    ic_cdk::println!("Face detection model bytes cleared");
}

#[update]
fn clear_face_recognition_model_bytes() {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.face_recognition_model_bytes.clear();
        state.face_recognition_model = None;
        state.face_recognition_model_status = ModelStatus::NotLoaded;
        state.stats.face_recognition_model_status = ModelStatus::NotLoaded;
        state.stats.model_recognition_size = 0;
    });
    ic_cdk::println!("Face recognition model bytes cleared");
}

#[update]
fn append_face_detection_model_bytes(bytes: ByteBuf) {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.face_detection_model_bytes.extend_from_slice(&bytes);
        state.face_detection_model_status = ModelStatus::Loading;
        state.stats.face_detection_model_status = ModelStatus::Loading;
        state.stats.model_detection_size = state.face_detection_model_bytes.len() as u64;
    });
    ic_cdk::println!("Appended {} bytes to face detection model", bytes.len());
}

#[update]
fn append_face_recognition_model_bytes(bytes: ByteBuf) {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.face_recognition_model_bytes.extend_from_slice(&bytes);
        state.face_recognition_model_status = ModelStatus::Loading;
        state.stats.face_recognition_model_status = ModelStatus::Loading;
        state.stats.model_recognition_size = state.face_recognition_model_bytes.len() as u64;
    });
    ic_cdk::println!("Appended {} bytes to face recognition model", bytes.len());
}

#[update]
fn setup_models() -> String {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        
        let mut results = Vec::new();
        
        // Setup face detection model
        if !state.face_detection_model_bytes.is_empty() {
            match load_detection_model(&state.face_detection_model_bytes) {
                Ok(model) => {
                    state.face_detection_model = Some(model);
                    state.face_detection_model_status = ModelStatus::Ready;
                    state.stats.face_detection_model_status = ModelStatus::Ready;
                    results.push("✅ Face detection model loaded successfully");
                },
                Err(e) => {
                    let error_msg = format!("Failed to load face recognition model: {}", e);
                    state.face_recognition_model_status = ModelStatus::Error(error_msg.clone());
                    state.stats.face_recognition_model_status = ModelStatus::Error(error_msg.clone());
                    results.push(&format!("❌ {}", error_msg));
                }
            }
        } else {
            results.push("⚠️ No face recognition model bytes available");
        }
        
        results.join("\n")
    })
}

fn load_detection_model(model_bytes: &[u8]) -> TractResult<TypedRunnableModel<f32>> {
    ic_cdk::println!("Loading face detection model ({} bytes)", model_bytes.len());
    
    let model = tract_onnx::onnx()
        .model_for_read(&mut std::io::Cursor::new(model_bytes))?
        .with_input_fact(0, InferenceFact::dt_shape(f32::datum_type(), tvec![1, 3, 240, 320]))?
        .into_optimized()?
        .into_runnable()?;
    
    ic_cdk::println!("Face detection model loaded successfully");
    Ok(model)
}

fn load_recognition_model(model_bytes: &[u8]) -> TractResult<TypedRunnableModel<f32>> {
    ic_cdk::println!("Loading face recognition model ({} bytes)", model_bytes.len());
    
    let model = tract_onnx::onnx()
        .model_for_read(&mut std::io::Cursor::new(model_bytes))?
        .with_input_fact(0, InferenceFact::dt_shape(f32::datum_type(), tvec![1, 3, 160, 160]))?
        .into_optimized()?
        .into_runnable()?;
    
    ic_cdk::println!("Face recognition model loaded successfully");
    Ok(model)
}

#[query]
fn detect_face(image_bytes: ByteBuf) -> FaceDetectionResult {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.stats.total_detections += 1;
        
        match &state.face_detection_model {
            Some(model) => {
                match process_face_detection(&image_bytes, model) {
                    Ok(result) => result,
                    Err(e) => {
                        ic_cdk::println!("Face detection error: {}", e);
                        FaceDetectionResult {
                            face_detected: false,
                            face_count: 0,
                            bounding_boxes: vec![],
                        }
                    }
                }
            },
            None => {
                ic_cdk::println!("Face detection model not loaded");
                FaceDetectionResult {
                    face_detected: false,
                    face_count: 0,
                    bounding_boxes: vec![],
                }
            }
        }
    })
}

#[query]
fn recognize_face(image_bytes: ByteBuf) -> FaceRecognitionResult {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.stats.total_recognitions += 1;
        
        let detection_result = match &state.face_detection_model {
            Some(detection_model) => {
                match process_face_detection(&image_bytes, detection_model) {
                    Ok(result) => result,
                    Err(e) => {
                        ic_cdk::println!("Face detection error in recognition: {}", e);
                        return FaceRecognitionResult {
                            face_detected: false,
                            face_count: 0,
                            face_embeddings: vec![],
                            bounding_boxes: vec![],
                        };
                    }
                }
            },
            None => {
                ic_cdk::println!("Face detection model not loaded");
                return FaceRecognitionResult {
                    face_detected: false,
                    face_count: 0,
                    face_embeddings: vec![],
                    bounding_boxes: vec![],
                };
            }
        };

        if !detection_result.face_detected {
            return FaceRecognitionResult {
                face_detected: false,
                face_count: 0,
                face_embeddings: vec![],
                bounding_boxes: detection_result.bounding_boxes,
            };
        }

        // Extract face embeddings using recognition model
        let embeddings = match &state.face_recognition_model {
            Some(recognition_model) => {
                match process_face_recognition(&image_bytes, &detection_result.bounding_boxes, recognition_model) {
                    Ok(embeddings) => embeddings,
                    Err(e) => {
                        ic_cdk::println!("Face recognition error: {}", e);
                        vec![]
                    }
                }
            },
            None => {
                ic_cdk::println!("Face recognition model not loaded");
                vec![]
            }
        };

        FaceRecognitionResult {
            face_detected: detection_result.face_detected,
            face_count: detection_result.face_count,
            face_embeddings: embeddings,
            bounding_boxes: detection_result.bounding_boxes,
        }
    })
}

fn process_face_detection(image_bytes: &[u8], model: &TypedRunnableModel<f32>) -> Result<FaceDetectionResult, Box<dyn std::error::Error>> {
    // Decode image
    let img = image::load_from_memory(image_bytes)?;
    let img = img.to_rgb8();
    
    // Resize to model input size (240x320 for Ultraface)
    let resized = image::imageops::resize(&img, 320, 240, image::imageops::FilterType::Lanczos3);
    
    // Convert to tensor format (CHW)
    let mut input_data = Vec::with_capacity(3 * 240 * 320);
    
    // Normalize and convert to CHW format
    for c in 0..3 {
        for y in 0..240 {
            for x in 0..320 {
                let pixel = resized.get_pixel(x, y);
                let value = pixel[c] as f32 / 255.0;
                input_data.push((value - 0.5) / 0.5); // Normalize to [-1, 1]
            }
        }
    }
    
    // Create tensor
    let input_tensor = Array4::from_shape_vec((1, 3, 240, 320), input_data)?;
    
    // Run inference
    let result = model.run(tvec![input_tensor.into()])?;
    
    // Parse detection results
    let bounding_boxes = parse_detection_output(&result)?;
    
    Ok(FaceDetectionResult {
        face_detected: !bounding_boxes.is_empty(),
        face_count: bounding_boxes.len() as u32,
        bounding_boxes,
    })
}

fn process_face_recognition(image_bytes: &[u8], bounding_boxes: &[BoundingBox], model: &TypedRunnableModel<f32>) -> Result<Vec<f32>, Box<dyn std::error::Error>> {
    if bounding_boxes.is_empty() {
        return Ok(vec![]);
    }
    
    // Use the first detected face
    let bbox = &bounding_boxes[0];
    
    // Decode and crop image
    let img = image::load_from_memory(image_bytes)?;
    let img = img.to_rgb8();
    
    let (img_width, img_height) = img.dimensions();
    
    // Convert normalized coordinates to pixel coordinates
    let x = (bbox.x * img_width as f32) as u32;
    let y = (bbox.y * img_height as f32) as u32;
    let w = (bbox.width * img_width as f32) as u32;
    let h = (bbox.height * img_height as f32) as u32;
    
    // Ensure coordinates are within image bounds
    let x = x.min(img_width.saturating_sub(1));
    let y = y.min(img_height.saturating_sub(1));
    let w = w.min(img_width - x);
    let h = h.min(img_height - y);
    
    // Crop face region
    let face_img = image::imageops::crop_imm(&img, x, y, w, h);
    
    // Resize to model input size (160x160 for FaceNet)
    let resized = image::imageops::resize(&face_img, 160, 160, image::imageops::FilterType::Lanczos3);
    
    // Convert to tensor format (CHW)
    let mut input_data = Vec::with_capacity(3 * 160 * 160);
    
    // Normalize for FaceNet
    for c in 0..3 {
        for y in 0..160 {
            for x in 0..160 {
                let pixel = resized.get_pixel(x, y);
                let value = pixel[c] as f32 / 255.0;
                input_data.push((value - 0.5) / 0.5); // Normalize to [-1, 1]
            }
        }
    }
    
    // Create tensor
    let input_tensor = Array4::from_shape_vec((1, 3, 160, 160), input_data)?;
    
    // Run inference
    let result = model.run(tvec![input_tensor.into()])?;
    
    // Extract embeddings from output
    if let Some(output) = result.get(0) {
        let embeddings = output.to_array_view::<f32>()?;
        Ok(embeddings.iter().cloned().collect())
    } else {
        Ok(vec![])
    }
}

fn parse_detection_output(outputs: &[Arc<Tensor>]) -> Result<Vec<BoundingBox>, Box<dyn std::error::Error>> {
    let mut bounding_boxes = Vec::new();
    
    if outputs.len() < 2 {
        return Ok(bounding_boxes);
    }
    
    // Ultraface outputs: boxes and scores
    let boxes = outputs[0].to_array_view::<f32>()?;
    let scores = outputs[1].to_array_view::<f32>()?;
    
    let num_detections = boxes.shape()[1];
    let confidence_threshold = 0.5;
    
    for i in 0..num_detections {
        let score = scores[[0, i, 1]]; // Assuming class 1 is face
        
        if score > confidence_threshold {
            let x1 = boxes[[0, i, 0]];
            let y1 = boxes[[0, i, 1]];
            let x2 = boxes[[0, i, 2]];
            let y2 = boxes[[0, i, 3]];
            
            // Convert to normalized coordinates
            let x = x1 / 320.0;
            let y = y1 / 240.0;
            let width = (x2 - x1) / 320.0;
            let height = (y2 - y1) / 240.0;
            
            bounding_boxes.push(BoundingBox {
                x,
                y,
                width,
                height,
            });
        }
    }
    
    Ok(bounding_boxes)
}

#[query]
fn get_stats() -> CanisterStats {
    STATE.with(|state| {
        let state = state.borrow();
        state.stats.clone()
    })
}

#[query]
fn health_check() -> bool {
    STATE.with(|state| {
        let state = state.borrow();
        matches!(state.face_detection_model_status, ModelStatus::Ready) 
            && matches!(state.face_recognition_model_status, ModelStatus::Ready)
    })
}

#[update]
fn reset_stats() {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.stats.total_detections = 0;
        state.stats.total_recognitions = 0;
    });
    ic_cdk::println!("Statistics reset");
}

// Custom getrandom implementation for WASM
#[no_mangle]
pub extern "C" fn custom_getrandom(ptr: *mut u8, len: usize) -> u32 {
    unsafe {
        for i in 0..len {
            *ptr.add(i) = (ic_cdk::api::time() as u8).wrapping_add(i as u8);
        }
    }
    0
}

getrandom::register_custom_getrandom!(custom_getrandom);

// Export candid interface
ic_cdk::export_candid!();e) => {
                    let error_msg = format!("Failed to load face detection model: {}", e);
                    state.face_detection_model_status = ModelStatus::Error(error_msg.clone());
                    state.stats.face_detection_model_status = ModelStatus::Error(error_msg.clone());
                    results.push(&format!("❌ {}", error_msg));
                }
            }
        } else {
            results.push("⚠️ No face detection model bytes available");
        }
        
        // Setup face recognition model
        if !state.face_recognition_model_bytes.is_empty() {
            match load_recognition_model(&state.face_recognition_model_bytes) {
                Ok(model) => {
                    state.face_recognition_model = Some(model);
                    state.face_recognition_model_status = ModelStatus::Ready;
                    state.stats.face_recognition_model_status = ModelStatus::Ready;
                    results.push("✅ Face recognition model loaded successfully");
                },
                Err(e) => {
                    let error_msg = format!("Failed to load face recognition model: {}", e);
                    state.face_recognition_model_status = ModelStatus::Error(error_msg.clone());
                    state.stats.face_recognition_model_status = ModelStatus::Error(error_msg.clone()); 
                }
                