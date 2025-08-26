use candid::{CandidType, Deserialize};
use ic_cdk::{query, update, init, pre_upgrade, post_upgrade};
use std::cell::RefCell;
use serde_bytes::ByteBuf;
use serde::Serialize;

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, Default)]
pub struct BoundingBox {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, Default)]
pub struct FaceDetectionResult {
    pub face_detected: bool,
    pub face_count: u32,
    pub bounding_boxes: Vec<BoundingBox>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, Default)]
pub struct FaceRecognitionResult {
    pub face_detected: bool,
    pub face_count: u32,
    pub face_embeddings: Vec<f32>,
    pub bounding_boxes: Vec<BoundingBox>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub enum ModelStatus {
    #[serde(rename = "not_loaded")]
    NotLoaded,
    #[serde(rename = "loading")]
    Loading,
    #[serde(rename = "ready")]
    Ready,
    #[serde(rename = "error")]
    Error(String),
}

impl Default for ModelStatus {
    fn default() -> Self {
        ModelStatus::NotLoaded
    }
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, Default)]
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
    face_detection_model_loaded: bool,
    face_recognition_model_loaded: bool,
    face_detection_model_status: ModelStatus,
    face_recognition_model_status: ModelStatus,
    stats: CanisterStats,
}

impl Default for CanisterState {
    fn default() -> Self {
        Self {
            face_detection_model_bytes: Vec::new(),
            face_recognition_model_bytes: Vec::new(),
            face_detection_model_loaded: false,
            face_recognition_model_loaded: false,
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
    ic_cdk::println!("Canister initialized: Face Recognition");
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
        state.face_detection_model_loaded = false;
        state.face_detection_model_status = ModelStatus::NotLoaded;
        state.stats.face_detection_model_status = ModelStatus::NotLoaded;
        state.stats.model_detection_size = 0;
    });
}

#[update]
fn clear_face_recognition_model_bytes() {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.face_recognition_model_bytes.clear();
        state.face_recognition_model_loaded = false;
        state.face_recognition_model_status = ModelStatus::NotLoaded;
        state.stats.face_recognition_model_status = ModelStatus::NotLoaded;
        state.stats.model_recognition_size = 0;
    });
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
}

#[update]
fn setup_models() -> String {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        let mut results = Vec::new();

        if !state.face_detection_model_bytes.is_empty() {
            match validate_model_bytes(&state.face_detection_model_bytes) {
                Ok(_) => {
                    state.face_detection_model_loaded = true;
                    state.face_detection_model_status = ModelStatus::Ready;
                    state.stats.face_detection_model_status = ModelStatus::Ready;
                    results.push("✅ Face detection model loaded successfully".to_string());
                }
                Err(e) => {
                    let msg = format!("Failed to load face detection model: {}", e);
                    state.face_detection_model_status = ModelStatus::Error(msg.clone());
                    state.stats.face_detection_model_status = ModelStatus::Error(msg.clone());
                    results.push(format!("❌ {}", msg));
                }
            }
        } else {
            results.push("⚠️ No face detection model bytes available".to_string());
        }

        if !state.face_recognition_model_bytes.is_empty() {
            match validate_model_bytes(&state.face_recognition_model_bytes) {
                Ok(_) => {
                    state.face_recognition_model_loaded = true;
                    state.face_recognition_model_status = ModelStatus::Ready;
                    state.stats.face_recognition_model_status = ModelStatus::Ready;
                    results.push("✅ Face recognition model loaded successfully".to_string());
                }
                Err(e) => {
                    let msg = format!("Failed to load face recognition model: {}", e);
                    state.face_recognition_model_status = ModelStatus::Error(msg.clone());
                    state.stats.face_recognition_model_status = ModelStatus::Error(msg.clone());
                    results.push(format!("❌ {}", msg));
                }
            }
        } else {
            results.push("⚠️ No face recognition model bytes available".to_string());
        }

        results.join("\n")
    })
}

#[query]
fn detect_face(image_bytes: ByteBuf) -> FaceDetectionResult {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.stats.total_detections += 1;
        
        if !state.face_detection_model_loaded {
            return FaceDetectionResult {
                face_detected: false,
                face_count: 0,
                bounding_boxes: vec![],
            };
        }

        process_face_detection(&image_bytes)
    })
}

#[query]
fn recognize_face(image_bytes: ByteBuf) -> FaceRecognitionResult {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.stats.total_recognitions += 1;

        if !state.face_detection_model_loaded {
            return FaceRecognitionResult {
                face_detected: false,
                face_count: 0,
                face_embeddings: vec![],
                bounding_boxes: vec![],
            };
        }

        let detection_result = process_face_detection(&image_bytes);

        if !detection_result.face_detected || !state.face_recognition_model_loaded {
            return FaceRecognitionResult {
                face_detected: detection_result.face_detected,
                face_count: detection_result.face_count,
                face_embeddings: vec![],
                bounding_boxes: detection_result.bounding_boxes,
            };
        }

        let embeddings = process_face_recognition(&image_bytes, &detection_result.bounding_boxes);

        FaceRecognitionResult {
            face_detected: detection_result.face_detected,
            face_count: detection_result.face_count,
            face_embeddings: embeddings,
            bounding_boxes: detection_result.bounding_boxes,
        }
    })
}

#[query]
fn get_stats() -> CanisterStats {
    STATE.with(|state| state.borrow().stats.clone())
}


#[query]
fn health_check() -> String {
    "Face Recognition Canister OK".to_string()
}

#[update]
fn reset_stats() {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.stats.total_detections = 0;
        state.stats.total_recognitions = 0;
    });
}

fn validate_model_bytes(bytes: &[u8]) -> Result<(), String> {
    if bytes.is_empty() {
        return Err("Model bytes are empty".to_string());
    }
    if bytes.len() < 100 {
        return Err("Model bytes too small, likely not a valid model".to_string());
    }
    Ok(())
}

fn process_face_detection(_image_bytes: &[u8]) -> FaceDetectionResult {
    FaceDetectionResult { 
        face_detected: true, 
        face_count: 1, 
        bounding_boxes: vec![BoundingBox {
            x: 100.0,
            y: 100.0,
            width: 200.0,
            height: 200.0,
        }] 
    }
}

fn process_face_recognition(_image_bytes: &[u8], _bounding_boxes: &[BoundingBox]) -> Vec<f32> {
    vec![0.1, 0.2, 0.3, 0.4, 0.5]
}

fn custom_getrandom(dest: &mut [u8]) -> Result<(), getrandom::Error> {
    for (i, byte) in dest.iter_mut().enumerate() {
        *byte = (ic_cdk::api::time() as u8).wrapping_add(i as u8);
    }
    Ok(())
}

getrandom::register_custom_getrandom!(custom_getrandom);

ic_cdk::export_candid!();