const mongoose = require('mongoose');
const Exam = require('../models/Exam');
require('dotenv').config();

const sampleExams = [
    {
        title: 'Mathematics Basic',
        description: 'Basic mathematics test covering algebra and geometry',
        duration: 60,
        questions: [
            {
                question: 'What is 2 + 2?',
                options: ['3', '4', '5', '6'],
                correctAnswer: 1
            }
        ]
    },
    {
        title: 'Science Quiz',
        description: 'General science quiz about physics and chemistry',
        duration: 45,
        questions: [
            {
                question: 'What is H2O?',
                options: ['Water', 'Gold', 'Silver', 'Iron'],
                correctAnswer: 0
            }
        ]
    }
];

const seedExams = async (userId) => {
    try {
        await Exam.deleteMany({});
        const examsWithCreator = sampleExams.map(exam => ({
            ...exam,
            creator: userId
        }));
        await Exam.insertMany(examsWithCreator);
        console.log('Sample exams seeded successfully');
    } catch (error) {
        console.error('Error seeding exams:', error);
    }
};

module.exports = seedExams;