const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    duration: {
        type: Number,
        required: true // in minutes
    },
    passingScore: {
        type: Number,
        default: 70
    },
    questions: [{
        question: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['multiple-choice', 'essay'],
            default: 'multiple-choice'
        },
        options: [{
            type: String
        }],
        correctAnswer: {
            type: String, // Changed from Number to String to handle both options and essay answers
            required: function() {
                return this.type === 'multiple-choice';
            }
        },
        points: {
            type: Number,
            default: 10
        }
    }],
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const Exam = mongoose.model('Exam', examSchema);
module.exports = Exam;