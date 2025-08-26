const Exam = require('../models/Exam');
const ExamSession = require('../models/ExamSession');
const AIProctoringService = require('../services/aiProctoringService');
const BlockchainService = require('../services/blockchainService');
const multer = require('multer');
const fs = require('fs'); // Import the 'fs' module
const path = require('path'); // Import the 'path' module
const { exec } = require('child_process');


// Initialize services
const aiProctoring = new AIProctoringService();
const blockchain = new BlockchainService();

// Initialize services with better error handling
(async () => {
    try {
        await blockchain.init();
        console.log('✅ Blockchain service initialized');
        
        const connectionTest = await aiProctoring.testConnection();
        if (connectionTest.success) {
            console.log('✅ ICP Face Recognition Service connected successfully');
        } else {
            console.warn('⚠️ ICP Face Recognition Service connection failed:', connectionTest.message);
        }
    } catch (error) {
        console.error('❌ Service initialization failed:', error);
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

// Create a directory to store uploaded images if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads/face-registrations');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Simpan file yang diterima
const saveFile = (buffer, filename) => {
    const filePath = path.join(__dirname, '../uploads/face-registrations', filename);
    fs.writeFileSync(filePath, buffer);
    return filePath;
};

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
            requiresProctoring: true,
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
            return res.status(400).json({ success: false, message: 'Face image is required.' });
        }

        const { studentId } = req.body;
        const registrationId = studentId || req.user.userId;

        // Simpan gambar yang diunggah ke folder lokal
        const filename = `${registrationId}-${Date.now()}.jpg`;
        const filePath = saveFile(req.file.buffer, filename);
        
        console.log(`Image saved to: ${filePath}`);

        // Panggil skrip Python untuk memproses gambar
        const pythonScriptPath = path.join(__dirname, '../scriptsss/new_face_recognizer.py');
        
        exec(`python ${pythonScriptPath} "${filePath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Python script error: ${error.message}`);
                return res.status(500).json({ success: false, message: 'Failed to process image.' });
            }

            if (stderr) {
                console.error(`Python script stderr: ${stderr}`);
            }

            try {
                const result = JSON.parse(stdout);
                if (!result.success) {
                    // Hapus file jika pengenalan gagal
                    fs.unlinkSync(filePath);
                    return res.status(400).json({ success: false, message: result.message });
                }

                // Jika berhasil, kirim respons ke frontend
                const faceResult = result.faces[0]; // Asumsi satu wajah
                console.log(`Face recognized: ${faceResult.name} with confidence ${faceResult.confidence}`);

                // Anda bisa menyimpan informasi ini ke database
                // ...

                return res.json({
                    success: true,
                    message: 'Face registered and recognized successfully.',
                    faceData: faceResult
                });

            } catch (jsonError) {
                console.error('Failed to parse Python output:', jsonError);
                return res.status(500).json({ success: false, message: 'Invalid response from AI service.' });
            }
        });

    } catch (error) {
        console.error('Registration failed:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during face registration.',
            error: error.message
        });
    }
}];

exports.startExam = async (req, res) => {
    try {
        // Handle both formats: direct biodata fields or nested biodata object
        const biodata = {
            fullName: req.body.fullName || req.body.biodata?.fullName,
            studentId: req.body.studentId || req.body.biodata?.studentId,
            phoneNumber: req.body.phoneNumber || req.body.biodata?.phoneNumber
        };

        console.log("📩 startExam biodata:", biodata);

        if (!biodata.fullName || !biodata.studentId) {
            return res.status(400).json({
                success: false,
                message: "Missing required biodata (fullName and studentId)"
            });
        }

        const exam = await Exam.findById(req.params.id);
        
        if (!exam) {
            // Create session with sample exam
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

        // Check for existing active session
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
                startTime: existingSession.startTime,
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
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID is required'
            });
        }
        
        console.log(`Processing frame for session ${sessionId} via ICP`);
        
        const analysis = await aiProctoring.analyzeFrame(req.file.buffer, sessionId);

        // Update session with violations if any
        if (analysis.violations && analysis.violations.length > 0) {
            const session = await ExamSession.findById(sessionId);
            if (session) {
                const violationsWithSession = analysis.violations.map(violation => ({
                    ...violation,
                    sessionId: sessionId,
                    timestamp: new Date()
                }));
                
                session.proctoring.violations.push(...violationsWithSession);
                session.proctoring.warningCount = session.proctoring.violations.length;
                session.proctoring.lastAnalysis = {
                    timestamp: analysis.timestamp || new Date(),
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

exports.submitExam = async (req, res) => {
    try {
        const { answers, sessionId } = req.body;
        
        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid answers format - expected array' 
            });
        }

        if (!sessionId) {
            return res.status(400).json({ 
                success: false,
                message: 'Session ID is required' 
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
                        totalScore += Math.floor(questionPoints * 0.8);
                    }
                }
            }
        });

        const finalScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

        // Get ICP proctoring report
        const proctoringReport = await aiProctoring.getProctoringReport(sessionId);

        // Adjust score based on ICP proctoring violations
        let adjustedScore = finalScore;
        const riskScore = proctoringReport?.riskScore || 0;
        if (riskScore > 3) {
            adjustedScore = Math.max(0, finalScore - (riskScore * 5));
        }

        // Update session with answers and score
        session.answers = answers;
        session.score = adjustedScore;
        session.status = 'completed';
        session.completedAt = new Date();
        session.proctoring.riskScore = riskScore;
        session.proctoring.recommendation = proctoringReport?.recommendation || 'PASS';
        session.proctoring.finalReport = {
            ...proctoringReport,
            icpProcessed: true,
            canisterId: process.env.FACE_RECOGNITION_CANISTER_ID
        };
        
        await session.save();

        // Generate certificate if passed and low risk
        let certificateResult = null;
        if (adjustedScore >= (exam.passingScore || 70) && riskScore < 3) {
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

            if (certificateResult?.success) {
                session.certificateId = certificateResult.certificateId;
                await session.save();
            }
        }

        console.log('✅ Exam submitted successfully with ICP proctoring:', {
            sessionId: session._id,
            score: adjustedScore,
            originalScore: finalScore,
            proctoringRisk: riskScore,
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
            message: 'Failed to submit exam',
            error: error.message
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
            success: true,
            score: session.score,
            passingScore: exam.passingScore || 70,
            passed: session.score >= (exam.passingScore || 70),
            questions: exam.questions.map((q) => {
                const userAnswer = session.answers?.find(a => a.questionId === q._id.toString());
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
        
        if (result?.success) {
            res.json({
                success: true,
                certificate: {
                    ...result.certificate,
                    proctoringTechnology: 'ICP_FACE_RECOGNITION'
                }
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Certificate not found'
            });
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

// Train AI model
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

// Test ICP connection
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
