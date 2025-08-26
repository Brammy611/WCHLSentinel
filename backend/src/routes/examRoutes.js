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
    // ...
});
router.post('/services/aiProctoringService', auth, (req, res) => {
    // ...
});

router.get('/icp/test', auth, testICPConnection);

module.exports = router;
