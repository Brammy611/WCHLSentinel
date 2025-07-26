const Exam = require('../models/Exam');
const ExamSession = require('../models/ExamSession');
const AIProctoringService = require('../services/aiProctoringService');
const BlockchainService = require('../services/blockchainService');
const multer = require('multer');
const icpFaceRecognition = require('../services/icpFaceRecognitionService');

// Initialize services
const aiProctoring = new AIProctoringService();
const blockchain = new BlockchainService();

// Initialize services
(async () => {
    await blockchain.init();
    // Test ICP connection on startup
    const connectionTest = await aiProctoring.testConnection();
    if (connectionTest.success) {
        console.log('✅ ICP Face Recognition Service connected successfully');
    } else {
        console.warn('⚠️ ICP Face Recognition Service connection failed:', connectionTest.message);
    }
})();

// Multer configuration for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

exports.getAllExams = async (req, res) => {
    try {
        const exams = await Exam.find({ isActive: true })
            .select('title description duration passingScore')
            .sort({ createdAt: -1 });
        res.json(exams);
    } catch (error) {
        console.error('Error fetching exams:', error);
        res.status(500).json({ message: 'Error fetching exams' });
    }
};

exports.getExamHistory = async (req, res) => {
    try {
        const history = await ExamSession.find({ 
            user: req.user.userId,
            status: 'completed'
        })
            .populate('exam', 'title')
            .sort({ completedAt: -1 })
            .select('exam score completedAt certificateId proctoring');

        const formattedHistory = history.map(session => ({
            _id: session._id,
            examTitle: session.exam?.title || 'Unknown Exam',
            score: session.score,
            completedAt: session.completedAt,
            certificateId: session.certificateId,
            proctoringScore: session.proctoring?.warningCount || 0,
            proctoringStatus: session.proctoring?.warningCount > 3 ? 'FLAGGED' : 'CLEAN',
            icpProctoringEnabled: true
        }));

        res.json(formattedHistory);
    } catch (error) {
        console.error('Error fetching exam history:', error);
        res.status(500).json({ message: 'Error fetching exam history' });
    }
};

exports.createExam = async (req, res) => {
    try {
        const { title, description, questions, duration, passingScore } = req.body;
        
        const exam = new Exam({
            title,
            description,
            questions,
            duration: duration || 60,
            passingScore: passingScore || 70,
            creator: req.user ? req.user.userId : null,
            requiresProctoring: true, // Enable ICP proctoring by default
            proctoringType: 'ICP_FACE_RECOGNITION'
        });
        
        await exam.save();
        res.status(201).json({
            success: true,
            message: 'Exam created successfully with ICP proctoring enabled',
            exam
        });
    } catch (error) {
        console.error('Create exam error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to create exam',
            error: error.message 
        });
    }
};

exports.getExamById = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        
        if (!exam) {
            // Return sample exam with ICP proctoring
            const sampleExam = {
                _id: req.params.id,
                title: 'Sample Mathematics Test',
                description: 'This is a sample exam with ICP AI proctoring enabled.',
                duration: 60,
                passingScore: 70,
                requiresProctoring: true,
                proctoringType: 'ICP_FACE_RECOGNITION',
                questions: [
                    {
                        _id: '1',
                        question: 'What is 2 + 2?',
                        type: 'multiple-choice',
                        options: ['3', '4', '5', '6'],
                        correctAnswer: '4',
                        points: 10
                    },
                    {
                        _id: '2',
                        question: 'What is the capital of Indonesia?',
                        type: 'multiple-choice',
                        options: ['Jakarta', 'Surabaya', 'Bandung', 'Medan'],
                        correctAnswer: 'Jakarta',
                        points: 10
                    },
                    {
                        _id: '3',
                        question: 'Solve: 3x + 7 = 22. What is x?',
                        type: 'multiple-choice',
                        options: ['3', '4', '5', '6'],
                        correctAnswer: '5',
                        points: 15
                    },
                    {
                        _id: '4',
                        question: 'Explain the process of photosynthesis and its importance.',
                        type: 'essay',
                        points: 25
                    }
                ],
                isActive: true
            };
            
            return res.json({
                success: true,
                exam: sampleExam,
                message: 'Sample exam loaded with ICP AI proctoring enabled',
                icpEnabled: true
            });
        }
        
        res.json({
            success: true,
            exam: {
                ...exam.toObject(),
                proctoringType: 'ICP_FACE_RECOGNITION'
            },
            icpEnabled: true
        });
    } catch (error) {
        console.error('Get exam by ID error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch exam',
            error: error.message 
        });
    }
};

// Register student face for ICP proctoring
exports.registerFace = [upload.single('faceImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Face image is required for ICP registration'
            });
        }

        const { studentId } = req.body;
        const userId = req.user.userId;

        console.log(`Registering face for student ${studentId || userId} using ICP`);

        // Use studentId if provided, otherwise use logged-in user ID
        const targetStudentId = studentId || userId;
        
        const result = await aiProctoring.registerStudentFace(req.file.buffer, targetStudentId);

        if (result.success) {
            console.log(`✅ Face registered successfully for student ${targetStudentId} via ICP`);
        }

        res.json({
            ...result,
            icpEnabled: true,
            canisterId: process.env.FACE_RECOGNITION_CANISTER_ID
        });
    } catch (error) {
        console.error('ICP Face registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to register face with ICP',
            error: error.message,
            icpEnabled: true
        });
    }
}];

exports.startExam = async (req, res) => {
    try {
        const { biodata } = req.body;
        const exam = await Exam.findById(req.params.id);
        
        if (!exam) {
            // If exam not found, use sample exam with ICP proctoring
            const sampleExam = {
                _id: req.params.id,
                title: 'Sample Mathematics Test',
                description: 'This is a sample exam with ICP AI proctoring enabled.',
                duration: 60,
                passingScore: 70,
                requiresProctoring: true,
                proctoringType: 'ICP_FACE_RECOGNITION',
                questions: [
                    {
                        _id: '1',
                        question: 'What is 2 + 2?',
                        type: 'multiple-choice',
                        options: ['3', '4', '5', '6'],
                        correctAnswer: '4',
                        points: 10
                    },
                    {
                        _id: '2',
                        question: 'What is the capital of Indonesia?',
                        type: 'multiple-choice',
                        options: ['Jakarta', 'Surabaya', 'Bandung', 'Medan'],
                        correctAnswer: 'Jakarta',
                        points: 10
                    },
                    {
                        _id: '3',
                        question: 'Solve: 3x + 7 = 22. What is x?',
                        type: 'multiple-choice',
                        options: ['3', '4', '5', '6'],
                        correctAnswer: '5',
                        points: 15
                    },
                    {
                        _id: '4',
                        question: 'Explain the process of photosynthesis and its importance.',
                        type: 'essay',
                        points: 25
                    }
                ]
            };

            // Create session with ICP proctoring data
            const session = new ExamSession({
                exam: req.params.id,
                user: req.user.userId,
                startTime: new Date(),
                status: 'in-progress',
                biodata: biodata,
                proctoring: {
                    violations: [],
                    warningCount: 0,
                    proctoringType: 'ICP_FACE_RECOGNITION',
                    icpCanisterId: process.env.FACE_RECOGNITION_CANISTER_ID
                }
            });
            
            await session.save();

            return res.json({ 
                success: true,
                message: 'Sample exam started with ICP AI proctoring active',
                sessionId: session._id,
                exam: sampleExam,
                startTime: session.startTime,
                proctoringEnabled: true,
                icpEnabled: true,
                canisterId: process.env.FACE_RECOGNITION_CANISTER_ID
            });
        }

        // Check if user already has an active session
        const existingSession = await ExamSession.findOne({
            exam: exam._id,
            user: req.user.userId,
            status: 'in-progress'
        });

        if (existingSession) {
            return res.json({
                success: true,
                message: 'Exam session already active with ICP proctoring',
                sessionId: existingSession._id,
                exam: exam,
                proctoringEnabled: true,
                icpEnabled: true,
                canisterId: process.env.FACE_RECOGNITION_CANISTER_ID
            });
        }

        const session = new ExamSession({
            exam: exam._id,
            user: req.user.userId,
            startTime: new Date(),
            status: 'in-progress',
            biodata: biodata,
            proctoring: {
                violations: [],
                warningCount: 0,
                proctoringType: 'ICP_FACE_RECOGNITION',
                icpCanisterId: process.env.FACE_RECOGNITION_CANISTER_ID
            }
        });
        
        await session.save();

        console.log(`✅ Exam session ${session._id} started with ICP proctoring`);

        res.json({ 
            success: true,
            message: 'Exam started successfully with ICP AI proctoring',
            sessionId: session._id,
            exam: exam,
            startTime: session.startTime,
            proctoringEnabled: true,
            icpEnabled: true,
            canisterId: process.env.FACE_RECOGNITION_CANISTER_ID
        });
    } catch (error) {
        console.error('Start exam error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to start exam',
            error: error.message 
        });
    }
};

// Process proctoring frame using ICP
exports.processProctoringFrame = [upload.single('frame'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Frame image is required for ICP analysis'
            });
        }

        const { sessionId } = req.body;
        
        console.log(`Processing frame for session ${sessionId} via ICP`);
        
        const analysis = await aiProctoring.analyzeFrame(req.file.buffer, sessionId);

        // Update session with violations if any
        if (analysis.violations && analysis.violations.length > 0) {
            const session = await ExamSession.findById(sessionId);
            if (session) {
                // Add sessionId to violations before storing
                const violationsWithSession = analysis.violations.map(violation => ({
                    ...violation,
                    sessionId: sessionId
                }));
                
                session.proctoring.violations.push(...violationsWithSession);
                session.proctoring.warningCount = session.proctoring.violations.length;
                session.proctoring.lastAnalysis = {
                    timestamp: analysis.timestamp,
                    faceDetected: analysis.faceDetected,
                    faceCount: analysis.faceCount,
                    confidence: analysis.confidence,
                    embeddingDimensions: analysis.embeddings ? analysis.embeddings.length : 0
                };
                
                await session.save();
                
                console.log(`⚠️ ${analysis.violations.length} violations detected in session ${sessionId}`);
            }
        }

        res.json({
            success: true,
            analysis: {
                ...analysis,
                icpProcessed: true,
                canisterId: process.env.FACE_RECOGNITION_CANISTER_ID
            },
            warningCount: analysis.violations ? analysis.violations.length : 0,
            icpEnabled: true
        });
    } catch (error) {
        console.error('ICP Proctoring frame processing error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process proctoring frame via ICP',
            error: error.message,
            icpEnabled: true
        });
    }
}];

// Add this to your existing submitExam function
exports.submitExam = async (req, res) => {
    try {
        const { answers, sessionId, faceImage } = req.body;
        
        // Verify face presence in the image
        if (faceImage) {
            const imageBuffer = Buffer.from(faceImage, 'base64');
            const faceDetection = await icpFaceRecognition.detectFace(imageBuffer);
            
            if (!faceDetection.faceDetected) {
                return res.status(400).json({
                    success: false,
                    message: 'No face detected in the image'
                });
            }

            if (faceDetection.faceCount > 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Multiple faces detected in the image'
                });
            }
        }

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid answers format' 
            });
        }

        // Find the active session
        const session = await ExamSession.findById(sessionId).populate('exam');
        if (!session) {
            return res.status(404).json({ 
                success: false,
                message: 'Exam session not found' 
            });
        }

        // Get the exam (handle both real exam and sample exam)
        let exam = session.exam;
        
        if (!exam) {
            // Use sample exam structure for scoring
            exam = {
                _id: session.exam,
                title: 'Sample Mathematics Test',
                passingScore: 70,
                questions: [
                    {
                        _id: '1',
                        question: 'What is 2 + 2?',
                        type: 'multiple-choice',
                        correctAnswer: '4',
                        points: 10
                    },
                    {
                        _id: '2',
                        question: 'What is the capital of Indonesia?',
                        type: 'multiple-choice',
                        correctAnswer: 'Jakarta',
                        points: 10
                    },
                    {
                        _id: '3',
                        question: 'Solve: 3x + 7 = 22. What is x?',
                        type: 'multiple-choice',
                        correctAnswer: '5',
                        points: 15
                    },
                    {
                        _id: '4',
                        question: 'Explain the process of photosynthesis and its importance.',
                        type: 'essay',
                        correctAnswer: 'Process where plants convert sunlight into energy',
                        points: 25
                    }
                ]
            };
        }

        // Calculate score
        let totalScore = 0;
        let maxScore = 0;

        exam.questions.forEach(question => {
            const questionPoints = question.points || 10;
            maxScore += questionPoints;
            
            const userAnswer = answers.find(a => a.questionId === question._id.toString());
            
            if (userAnswer && userAnswer.answer) {
                if (question.type === 'multiple-choice') {
                    if (userAnswer.answer === question.correctAnswer) {
                        totalScore += questionPoints;
                    }
                } else if (question.type === 'essay') {
                    // Basic essay scoring - give points if substantial answer
                    if (userAnswer.answer.trim().length > 20) {
                        totalScore += Math.floor(questionPoints * 0.8); // 80% for basic essay completion
                    }
                }
            }
        });

        const finalScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

        // Get ICP proctoring report
        const proctoringReport = aiProctoring.getProctoringReport(sessionId);

        // Adjust score based on ICP proctoring violations
        let adjustedScore = finalScore;
        if (proctoringReport.riskScore > 3) {
            adjustedScore = Math.max(0, finalScore - (proctoringReport.riskScore * 5));
        }

        // Update session with answers and score
        session.answers = answers;
        session.score = adjustedScore;
        session.status = 'completed';
        session.completedAt = new Date();
        session.proctoring.riskScore = proctoringReport.riskScore;
        session.proctoring.recommendation = proctoringReport.recommendation;
        session.proctoring.finalReport = {
            ...proctoringReport,
            icpProcessed: true,
            canisterId: process.env.FACE_RECOGNITION_CANISTER_ID
        };
        
        await session.save();

        // Generate certificate if passed and low risk
        let certificateResult = null;
        if (adjustedScore >= (exam.passingScore || 70) && proctoringReport.riskScore < 3) {
            certificateResult = await blockchain.createCertificate(
                {
                    examTitle: exam.title,
                    score: adjustedScore,
                    passingScore: exam.passingScore || 70,
                    completedAt: session.completedAt,
                    proctoringType: 'ICP_FACE_RECOGNITION',
                    proctoringPassed: true
                },
                session.biodata
            );

            if (certificateResult.success) {
                session.certificateId = certificateResult.certificateId;
                await session.save();
            }
        }

        console.log('✅ Exam submitted successfully with ICP proctoring:', {
            sessionId: session._id,
            score: adjustedScore,
            originalScore: finalScore,
            proctoringRisk: proctoringReport.riskScore,
            certificateGenerated: !!certificateResult?.success,
            icpCanisterId: process.env.FACE_RECOGNITION_CANISTER_ID
        });

        res.json({ 
            success: true,
            message: 'Exam submitted successfully with ICP proctoring analysis',
            session: session,
            score: adjustedScore,
            originalScore: finalScore,
            proctoringReport: {
                ...proctoringReport,
                icpProcessed: true,
                canisterId: process.env.FACE_RECOGNITION_CANISTER_ID
            },
            certificateGenerated: !!certificateResult?.success,
            certificateId: certificateResult?.certificateId,
            icpEnabled: true
        });
    } catch (error) {
        console.error('Submit exam error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit exam'
        });
    }
};

exports.getExamResult = async (req, res) => {
    try {
        const session = await ExamSession.findById(req.params.id)
            .populate('exam');

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Result not found'
            });
        }

        let exam = session.exam;
        
        // Handle sample exam case
        if (!exam) {
            exam = {
                title: 'Sample Mathematics Test',
                passingScore: 70,
                questions: [
                    {
                        _id: '1',
                        question: 'What is 2 + 2?',
                        type: 'multiple-choice',
                        correctAnswer: '4'
                    },
                    {
                        _id: '2',
                        question: 'What is the capital of Indonesia?',
                        type: 'multiple-choice',
                        correctAnswer: 'Jakarta'
                    },
                    {
                        _id: '3',
                        question: 'Solve: 3x + 7 = 22. What is x?',
                        type: 'multiple-choice',
                        correctAnswer: '5'
                    },
                    {
                        _id: '4',
                        question: 'Explain the process of photosynthesis and its importance.',
                        type: 'essay',
                        correctAnswer: 'Process where plants convert sunlight into energy'
                    }
                ]
            };
        }

        // Format the result data
        const result = {
            score: session.score,
            passingScore: exam.passingScore || 70,
            passed: session.score >= (exam.passingScore || 70),
            questions: exam.questions.map((q) => {
                const userAnswer = session.answers.find(a => a.questionId === q._id.toString());
                return {
                    question: q.question,
                    userAnswer: userAnswer ? userAnswer.answer : 'No answer',
                    correctAnswer: q.correctAnswer || 'N/A',
                    isCorrect: userAnswer ? userAnswer.answer === q.correctAnswer : false,
                    type: q.type
                };
            }),
            certificateId: session.certificateId,
            proctoringReport: {
                violationCount: session.proctoring?.violations?.length || 0,
                riskScore: session.proctoring?.riskScore || 0,
                recommendation: session.proctoring?.recommendation || 'PASS',
                violations: session.proctoring?.violations || [],
                proctoringType: 'ICP_FACE_RECOGNITION',
                icpCanisterId: session.proctoring?.icpCanisterId || process.env.FACE_RECOGNITION_CANISTER_ID,
                icpProcessed: true
            },
            completedAt: session.completedAt,
            icpEnabled: true
        };

        res.json(result);
    } catch (error) {
        console.error('Get result error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch result',
            error: error.message
        });
    }
};

// Verify certificate
exports.verifyCertificate = async (req, res) => {
    try {
        const { certificateId } = req.params;
        const result = await blockchain.verifyCertificate(certificateId);
        
        res.json({
            ...result,
            icpProctoringUsed: true
        });
    } catch (error) {
        console.error('Certificate verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify certificate',
            error: error.message
        });
    }
};

// Get certificate details
exports.getCertificate = async (req, res) => {
    try {
        const { certificateId } = req.params;
        const result = await blockchain.getCertificate(certificateId);
        
        if (result.success) {
            res.json({
                success: true,
                certificate: {
                    ...result.certificate,
                    proctoringTechnology: 'ICP_FACE_RECOGNITION'
                }
            });
        } else {
            res.status(404).json(result);
        }
    } catch (error) {
        console.error('Get certificate error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get certificate',
            error: error.message
        });
    }
};

// Train AI model (now uploads models to ICP canister)
exports.trainAIModel = async (req, res) => {
    try {
        const result = await aiProctoring.trainModel();
        res.json({
            ...result,
            icpCanisterId: process.env.FACE_RECOGNITION_CANISTER_ID,
            technology: 'ICP_FACE_RECOGNITION'
        });
    } catch (error) {
        console.error('ICP AI model setup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to setup ICP AI models',
            error: error.message
        });
    }
};

// Test ICP connection (admin function)
exports.testICPConnection = async (req, res) => {
    try {
        const result = await aiProctoring.testConnection();
        res.json(result);
    } catch (error) {
        console.error('ICP connection test error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to test ICP connection',
            error: error.message
        });
    }
};