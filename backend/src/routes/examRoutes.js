// examRoutes.js
const express = require('express');
const router = express.Router();
const { 
    getAllExams, 
    getExamById, 
    createExam, 
    startExam, 
    submitExam,
    getExamHistory,
    getCertificate,
    verifyCertificate,
    registerFace, // Pastikan ini ada
    testICPConnection,
    processProctoringFrame
} = require('../controllers/examController');

const auth = require('../middleware/auth');
// const verifyFace = require('../middleware/faceVerification'); // Hapus atau nonaktifkan ini

/**
 * ===============================
 * Public & Authenticated Routes
 * ===============================
 */

// Pendaftaran wajah menggunakan multer
router.post('/registerFace', auth, registerFace);

// Rute ujian
router.post('/:id/start', auth, startExam);
router.post('/:id/submit', auth, submitExam);
router.post('/create', auth, createExam);
router.get('/history', auth, getExamHistory);
router.get('/:id', auth, getExamById);
router.post('/proctoring/frame', auth, processProctoringFrame);

// Rute sertifikat
router.get('/certificate/:id', getCertificate);
router.get('/verify/:id', verifyCertificate);

// Rute servis mock (jika masih digunakan)
router.post('/services/icpFaceRecognitionService', auth, (req, res) => {
    const { studentId, imageData } = req.body;
    if (!studentId || !imageData) {
        return res.status(400).json({ error: 'Missing fields: studentId or imageData' });
    }

    console.log('ICP Face Recognition request:', { studentId });
    // Mock response
    res.status(200).json({ result: 'Face recognized (mock)' });
});
router.post('/services/aiProctoringService', auth, (req, res) => {
    const { examId, studentId } = req.body;
    if (!examId || !studentId) {
        return res.status(400).json({ error: 'Missing fields: examId or studentId' });
    }

    console.log('AI Proctoring request:', { examId, studentId });
    // Mock response
    res.status(200).json({ result: 'Proctoring session started (mock)' });
});

router.get('/icp/test', auth, testICPConnection);

module.exports = router;

