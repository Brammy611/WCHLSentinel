const { HttpAgent, Actor } = require('@dfinity/agent');
const { Principal } = require('@dfinity/principal');
const { readFileSync } = require('fs');
const path = require('path');

class AIProctoringService {
    constructor() {
        this.agent = null;
        this.faceRecognitionCanister = null;
        this.canisterId = process.env.FACE_RECOGNITION_CANISTER_ID || 'your-canister-id-here';
        this.violations = [];
        this.isInitialized = false;
        this.studentFaceEmbeddings = new Map(); // Store face embeddings by student ID
        this.lastFaceDetection = Date.now();
        this.lookAwayCount = 0;
        this.multiplePersonCount = 0;
        this.noFaceCount = 0;
        
        this.init();
    }

    async init() {
        try {
            // Initialize Internet Computer agent
            this.agent = new HttpAgent({
                host: process.env.IC_HOST || 'https://ic0.app',
            });

            // In development, fetch root key
            if (process.env.NODE_ENV === 'development') {
                await this.agent.fetchRootKey();
            }

            // Create actor for face recognition canister
            const idlFactory = ({ IDL }) => {
                return IDL.Service({
                    'setup_models': IDL.Func([], [IDL.Text], []),
                    'clear_face_detection_model_bytes': IDL.Func([], [], []),
                    'clear_face_recognition_model_bytes': IDL.Func([], [], []),
                    'append_face_detection_model_bytes': IDL.Func([IDL.Vec(IDL.Nat8)], [], []),
                    'append_face_recognition_model_bytes': IDL.Func([IDL.Vec(IDL.Nat8)], [], []),
                    'recognize_face': IDL.Func(
                        [IDL.Vec(IDL.Nat8)], 
                        [IDL.Record({
                            'face_detected': IDL.Bool,
                            'face_count': IDL.Nat32,
                            'face_embeddings': IDL.Vec(IDL.Float32),
                            'bounding_boxes': IDL.Vec(IDL.Record({
                                'x': IDL.Float32,
                                'y': IDL.Float32,
                                'width': IDL.Float32,
                                'height': IDL.Float32
                            }))
                        })], 
                        ['query']
                    ),
                    'detect_face': IDL.Func(
                        [IDL.Vec(IDL.Nat8)], 
                        [IDL.Record({
                            'face_detected': IDL.Bool,
                            'face_count': IDL.Nat32,
                            'bounding_boxes': IDL.Vec(IDL.Record({
                                'x': IDL.Float32,
                                'y': IDL.Float32,
                                'width': IDL.Float32,
                                'height': IDL.Float32
                            }))
                        })], 
                        ['query']
                    )
                });
            };

            this.faceRecognitionCanister = Actor.createActor(idlFactory, {
                agent: this.agent,
                canisterId: this.canisterId,
            });

            this.isInitialized = true;
            console.log('ICP AI Proctoring Service initialized successfully');
        } catch (error) {
            console.error('Failed to initialize ICP AI Proctoring Service:', error);
            this.isInitialized = false;
        }
    }

    // Register student face during pre-exam using ICP canister
    async registerStudentFace(imageBuffer, studentId) {
        try {
            if (!this.isInitialized) {
                throw new Error('ICP AI Proctoring Service not initialized');
            }

            // Convert buffer to Uint8Array for ICP canister
            const imageBytes = new Uint8Array(imageBuffer);

            // Call ICP canister to recognize face and get embeddings
            const result = await this.faceRecognitionCanister.recognize_face(imageBytes);

            if (!result.face_detected) {
                throw new Error('No face detected in registration image');
            }

            if (result.face_count > 1) {
                throw new Error('Multiple faces detected. Please ensure only one person is visible');
            }

            // Store face embeddings for this student
            this.studentFaceEmbeddings.set(studentId, {
                embeddings: result.face_embeddings,
                registeredAt: new Date(),
                boundingBox: result.bounding_boxes[0]
            });

            console.log(`Face registered for student ${studentId} with ${result.face_embeddings.length} embedding dimensions`);

            return {
                success: true,
                message: 'Face registered successfully using ICP face recognition',
                faceDetected: true,
                confidence: 100,
                embeddingDimensions: result.face_embeddings.length
            };

        } catch (error) {
            console.error('ICP Face registration error:', error);
            return {
                success: false,
                message: error.message || 'Failed to register face with ICP',
                faceDetected: false
            };
        }
    }

    // Real-time proctoring analysis using ICP canister
    async analyzeFrame(imageBuffer, sessionId) {
        try {
            if (!this.isInitialized) {
                return this.createViolation('SYSTEM_ERROR', 'ICP AI Proctoring not initialized', 0);
            }

            // Convert buffer to Uint8Array for ICP canister
            const imageBytes = new Uint8Array(imageBuffer);

            // Call ICP canister for face detection and recognition
            const result = await this.faceRecognitionCanister.recognize_face(imageBytes);

            const analysis = {
                timestamp: new Date(),
                sessionId,
                violations: [],
                faceDetected: result.face_detected,
                faceCount: result.face_count,
                confidence: 0,
                embeddings: result.face_embeddings,
                boundingBoxes: result.bounding_boxes
            };

            // Check for violations
            if (!result.face_detected || result.face_count === 0) {
                this.noFaceCount++;
                if (this.noFaceCount > 5) { // 5 consecutive frames without face
                    analysis.violations.push(
                        this.createViolation('NO_FACE_DETECTED', 'Student not visible in camera', 0.9)
                    );
                }
            } else {
                this.noFaceCount = 0;
            }

            if (result.face_count > 1) {
                this.multiplePersonCount++;
                analysis.violations.push(
                    this.createViolation('MULTIPLE_PERSONS', 'Multiple persons detected', 0.95)
                );
            } else {
                this.multiplePersonCount = 0;
            }

            // Face recognition using cosine similarity of embeddings
            if (result.face_detected && result.face_embeddings.length > 0) {
                const studentData = this.getStudentDataForSession(sessionId);
                
                if (studentData && this.studentFaceEmbeddings.has(studentData.studentId)) {
                    const registeredEmbeddings = this.studentFaceEmbeddings.get(studentData.studentId).embeddings;
                    const similarity = this.calculateCosineSimilarity(result.face_embeddings, registeredEmbeddings);
                    
                    analysis.confidence = similarity * 100;

                    // If similarity is low, it might be a different person
                    if (similarity < 0.7) { // 70% threshold
                        analysis.violations.push(
                            this.createViolation('IDENTITY_MISMATCH', 
                                `Different person detected (similarity: ${(similarity * 100).toFixed(1)}%)`, 0.8)
                        );
                    }
                }
            }

            // Check for looking away using bounding box position
            if (result.face_detected && result.bounding_boxes.length > 0) {
                const bbox = result.bounding_boxes[0];
                const faceCenter = {
                    x: bbox.x + bbox.width / 2,
                    y: bbox.y + bbox.height / 2
                };

                // Assuming normalized coordinates (0-1), image center is at (0.5, 0.5)
                const imageCenter = { x: 0.5, y: 0.5 };
                
                const distance = Math.sqrt(
                    Math.pow(faceCenter.x - imageCenter.x, 2) + 
                    Math.pow(faceCenter.y - imageCenter.y, 2)
                );

                // If face is far from center, might be looking away
                if (distance > 0.3) { // 30% of image dimension
                    this.lookAwayCount++;
                    if (this.lookAwayCount > 10) {
                        analysis.violations.push(
                            this.createViolation('LOOKING_AWAY', 'Student looking away from screen', 0.7)
                        );
                    }
                } else {
                    this.lookAwayCount = 0;
                }
            }

            this.lastFaceDetection = Date.now();
            return analysis;

        } catch (error) {
            console.error('ICP Frame analysis error:', error);
            return {
                timestamp: new Date(),
                sessionId,
                violations: [this.createViolation('ANALYSIS_ERROR', error.message, 0.5)],
                faceDetected: false,
                faceCount: 0,
                confidence: 0
            };
        }
    }

    // Calculate cosine similarity between two embedding vectors
    calculateCosineSimilarity(embeddingA, embeddingB) {
        if (embeddingA.length !== embeddingB.length) {
            console.warn('Embedding dimensions do not match');
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < embeddingA.length; i++) {
            dotProduct += embeddingA[i] * embeddingB[i];
            normA += embeddingA[i] * embeddingA[i];
            normB += embeddingB[i] * embeddingB[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (normA * normB);
    }

    // Helper method to get student data for a session (you'll need to implement this)
    getStudentDataForSession(sessionId) {
        // This should query your database to get student information for the session
        // For now, returning a mock response
        // You'll need to integrate this with your ExamSession model
        return {
            studentId: 'student_123', // This should come from your session data
            sessionId: sessionId
        };
    }

    createViolation(type, description, severity) {
        const violation = {
            type,
            description,
            severity,
            timestamp: new Date()
        };
        
        this.violations.push({
            ...violation,
            sessionId: null // Will be set when storing to session
        });
        
        return violation;
    }

    // Get proctoring summary for a session
    getProctoringReport(sessionId) {
        const sessionViolations = this.violations.filter(v => v.sessionId === sessionId);
        
        const report = {
            sessionId,
            totalViolations: sessionViolations.length,
            violationTypes: {},
            riskScore: 0,
            recommendation: 'PASS'
        };

        sessionViolations.forEach(violation => {
            if (!report.violationTypes[violation.type]) {
                report.violationTypes[violation.type] = 0;
            }
            report.violationTypes[violation.type]++;
            report.riskScore += violation.severity;
        });

        // Determine recommendation based on risk score
        if (report.riskScore > 5) {
            report.recommendation = 'REVIEW_REQUIRED';
        } else if (report.riskScore > 2) {
            report.recommendation = 'FLAG';
        }

        return report;
    }

    // Upload models to ICP canister (admin function)
    async uploadModels(faceDetectionModelPath, faceRecognitionModelPath) {
        try {
            if (!this.isInitialized) {
                throw new Error('ICP AI Proctoring Service not initialized');
            }

            console.log('Clearing existing models...');
            await this.faceRecognitionCanister.clear_face_detection_model_bytes();
            await this.faceRecognitionCanister.clear_face_recognition_model_bytes();

            console.log('Uploading face detection model...');
            const detectionModelBytes = readFileSync(faceDetectionModelPath);
            await this.faceRecognitionCanister.append_face_detection_model_bytes(
                new Uint8Array(detectionModelBytes)
            );

            console.log('Uploading face recognition model...');
            const recognitionModelBytes = readFileSync(faceRecognitionModelPath);
            await this.faceRecognitionCanister.append_face_recognition_model_bytes(
                new Uint8Array(recognitionModelBytes)
            );

            console.log('Setting up models...');
            const result = await this.faceRecognitionCanister.setup_models();

            return {
                success: true,
                message: 'Models uploaded successfully to ICP canister',
                setupResult: result
            };

        } catch (error) {
            console.error('Model upload error:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Train model (now delegates to ICP canister setup)
    async trainModel() {
        try {
            // For ICP implementation, training is replaced by model setup
            // The ONNX models should be pre-trained and uploaded to the canister
            
            const detectionModelPath = path.join(__dirname, '../models/version-RFB-320.onnx');
            const recognitionModelPath = path.join(__dirname, '../models/face-recognition.onnx');

            return await this.uploadModels(detectionModelPath, recognitionModelPath);

        } catch (error) {
            console.error('Training error:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Test connection to ICP canister
    async testConnection() {
        try {
            if (!this.isInitialized) {
                throw new Error('Service not initialized');
            }

            // Test with a small dummy image
            const testImage = new Uint8Array(1024); // 1KB dummy data
            const result = await this.faceRecognitionCanister.detect_face(testImage);
            
            return {
                success: true,
                message: 'Successfully connected to ICP face recognition canister',
                canisterId: this.canisterId,
                testResult: result
            };

        } catch (error) {
            console.error('Connection test failed:', error);
            return {
                success: false,
                message: `Failed to connect to ICP canister: ${error.message}`,
                canisterId: this.canisterId
            };
        }
    }
}

module.exports = AIProctoringService;