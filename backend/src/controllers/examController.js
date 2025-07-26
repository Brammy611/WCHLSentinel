const Exam = require('../models/Exam');
const ExamSession = require('../models/ExamSession');

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
            .select('exam score completedAt certificateId');

        const formattedHistory = history.map(session => ({
            _id: session._id,
            examTitle: session.exam?.title || 'Unknown Exam',
            score: session.score,
            completedAt: session.completedAt,
            certificateId: session.certificateId
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
            creator: req.user ? req.user.userId : null
        });
        
        await exam.save();
        res.status(201).json({
            success: true,
            message: 'Exam created successfully',
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
            // Return sample exam if not found
            const sampleExam = {
                _id: req.params.id,
                title: 'Sample Mathematics Test',
                description: 'This is a sample exam for testing purposes.',
                duration: 60,
                passingScore: 70,
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
                        question: 'Explain the process of photosynthesis.',
                        type: 'essay',
                        points: 20
                    }
                ],
                isActive: true
            };
            
            return res.json({
                success: true,
                exam: sampleExam,
                message: 'Sample exam loaded (exam not found in database)'
            });
        }
        
        res.json({
            success: true,
            exam
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

exports.startExam = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        
        if (!exam) {
            // If exam not found, use sample exam
            const sampleExam = {
                _id: req.params.id,
                title: 'Sample Mathematics Test',
                description: 'This is a sample exam for testing purposes.',
                duration: 60,
                passingScore: 70,
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
                        question: 'Explain the process of photosynthesis.',
                        type: 'essay',
                        points: 20
                    }
                ]
            };

            // Create a temporary session for sample exam
            const session = new ExamSession({
                exam: req.params.id,
                user: req.user.userId,
                startTime: new Date(),
                status: 'in-progress'
            });
            
            await session.save();

            return res.json({ 
                success: true,
                message: 'Sample exam started successfully',
                sessionId: session._id,
                exam: sampleExam,
                startTime: session.startTime
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
                message: 'Exam session already active',
                sessionId: existingSession._id,
                exam: exam
            });
        }

        const session = new ExamSession({
            exam: exam._id,
            user: req.user.userId,
            startTime: new Date(),
            status: 'in-progress'
        });
        
        await session.save();

        res.json({ 
            success: true,
            message: 'Exam started successfully',
            sessionId: session._id,
            exam: exam,
            startTime: session.startTime
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

exports.submitExam = async (req, res) => {
    try {
        const { answers, sessionId } = req.body;
        
        console.log('Received answers:', answers);
        console.log('Session ID:', sessionId);

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid answers format' 
            });
        }

        // Find the active session
        const session = await ExamSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ 
                success: false,
                message: 'Exam session not found' 
            });
        }

        // Get the exam (handle both real exam and sample exam)
        let exam = await Exam.findById(session.exam);
        
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
                        question: 'Explain the process of photosynthesis.',
                        type: 'essay',
                        points: 20
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
                    // For essay, give full points if answered (basic implementation)
                    if (userAnswer.answer.trim().length > 10) {
                        totalScore += questionPoints;
                    }
                }
            }
        });

        const finalScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

        // Update session with answers and score
        session.answers = answers;
        session.score = finalScore;
        session.status = 'completed';
        session.completedAt = new Date();
        
        await session.save();

        console.log('Exam submitted successfully:', {
            sessionId: session._id,
            score: finalScore,
            totalScore,
            maxScore
        });

        res.json({ 
            success: true,
            message: 'Exam submitted successfully',
            session: session,
            score: finalScore
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
                        question: 'Explain the process of photosynthesis.',
                        type: 'essay',
                        correctAnswer: 'Sample answer about photosynthesis'
                    }
                ]
            };
        }

        // Format the result data
        const result = {
            score: session.score,
            passingScore: exam.passingScore || 70,
            questions: exam.questions.map((q) => {
                const userAnswer = session.answers.find(a => a.questionId === q._id.toString());
                return {
                    question: q.question,
                    userAnswer: userAnswer ? userAnswer.answer : 'No answer',
                    correctAnswer: q.correctAnswer || 'N/A',
                    isCorrect: userAnswer ? userAnswer.answer === q.correctAnswer : false
                };
            }),
            certificateId: session.certificateId
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