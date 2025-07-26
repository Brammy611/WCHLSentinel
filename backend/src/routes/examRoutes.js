const express = require('express');
const router = express.Router();
const { 
    getAllExams, 
    getExamById, 
    createExam, 
    startExam, 
    submitExam,
    getExamHistory,
    getExamResult
} = require('../controllers/examController');
const auth = require('../middleware/auth');

// Public routes
router.get('/', auth, getAllExams);
router.get('/history', auth, getExamHistory);
router.get('/:id', auth, getExamById);
router.get('/result/:id', auth, getExamResult);
router.post('/:id/start', auth, startExam);
router.post('/:id/submit', auth, submitExam);
router.post('/create', auth, createExam);

module.exports = router;
