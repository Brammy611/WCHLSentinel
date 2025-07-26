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
    verifyCertificate 
} = require('../controllers/examController');
const auth = require('../middleware/auth');
const verifyFace = require('../middleware/faceVerification');

// Public routes
router.get('/', auth, getAllExams);
router.get('/history', auth, getExamHistory);
router.get('/:id', auth, getExamById);
router.get('/certificate/:id', getCertificate);
router.get('/verify/:id', verifyCertificate);

// Protected routes with face verification
router.post('/:id/start', auth, verifyFace, startExam);
router.post('/:id/submit', auth, verifyFace, submitExam);
router.post('/create', auth, createExam);

module.exports = router;