const mongoose = require('mongoose');

const examSessionSchema = new mongoose.Schema({
    exam: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    answers: [{
        questionId: {
            type: String,
            required: true
        },
        answer: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['multiple-choice', 'essay'],
            required: true
        }
    }],
    score: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    status: {
        type: String,
        enum: ['in-progress', 'completed', 'cancelled'],
        default: 'in-progress'
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    },
    certificateId: {
        type: String // For blockchain certificate reference
    },
    biodata: {
        fullName: String,
        studentId: String,
        phoneNumber: String
    },
    proctoring: {
        violations: [{
            type: String,
            timestamp: Date,
            description: String
        }],
        warningCount: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true
});

// Index for better performance
examSessionSchema.index({ user: 1, exam: 1 });
examSessionSchema.index({ status: 1 });
examSessionSchema.index({ completedAt: -1 });

// Ensure only one active session per user per exam
examSessionSchema.index(
    { user: 1, exam: 1, status: 1 }, 
    { 
        unique: true, 
        partialFilterExpression: { status: 'in-progress' } 
    }
);

module.exports = mongoose.model('ExamSession', examSessionSchema);