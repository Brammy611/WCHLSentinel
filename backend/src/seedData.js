const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const User = require('./models/User');
const Exam = require('./models/Exam');

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Exam.deleteMany({});
    console.log('Cleared existing data');

    // Create sample users with hashed passwords
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@example.com',
      password: await bcrypt.hash('admin123', 12),
      role: 'admin'
    });

    const studentUser = new User({
      name: 'John Doe',
      email: 'student@example.com',
      password: await bcrypt.hash('student123', 12),
      role: 'student'
    });

    await adminUser.save();
    await studentUser.save();
    console.log('Created sample users');

    // Create sample exams with correct structure
    const mathExam = new Exam({
      title: 'Mathematics Basic Test',
      description: 'Basic mathematics test covering algebra, geometry, and arithmetic operations.',
      duration: 90,
      passingScore: 70,
      creator: adminUser._id,
      questions: [
        {
          question: 'What is 15 + 25?',
          type: 'multiple-choice',
          options: ['35', '40', '45', '50'],
          correctAnswer: '40', // Changed to string
          points: 10
        },
        {
          question: 'What is the square root of 64?',
          type: 'multiple-choice',
          options: ['6', '7', '8', '9'],
          correctAnswer: '8', // Changed to string
          points: 10
        },
        {
          question: 'If a triangle has sides of 3, 4, and 5 units, what type of triangle is it?',
          type: 'multiple-choice',
          options: ['Equilateral', 'Isosceles', 'Right triangle', 'Scalene'],
          correctAnswer: 'Right triangle', // Changed to string
          points: 15
        },
        {
          question: 'Solve for x: 2x + 5 = 15',
          type: 'multiple-choice',
          options: ['5', '10', '7', '3'],
          correctAnswer: '5', // Changed to string
          points: 15
        },
        {
          question: 'Explain the Pythagorean theorem and provide an example.',
          type: 'essay',
          points: 50
        }
      ]
    });

    const scienceExam = new Exam({
      title: 'Science General Knowledge',
      description: 'General science test covering physics, chemistry, and biology basics.',
      duration: 60,
      passingScore: 75,
      creator: adminUser._id,
      questions: [
        {
          question: 'What planet is known as the Red Planet?',
          type: 'multiple-choice',
          options: ['Earth', 'Mars', 'Jupiter', 'Venus'],
          correctAnswer: 'Mars', // Changed to string
          points: 10
        },
        {
          question: 'What gas do plants absorb from the atmosphere?',
          type: 'multiple-choice',
          options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'],
          correctAnswer: 'Carbon Dioxide', // Changed to string
          points: 10
        },
        {
          question: 'Who proposed the theory of relativity?',
          type: 'multiple-choice',
          options: ['Isaac Newton', 'Albert Einstein', 'Galileo Galilei', 'Nikola Tesla'],
          correctAnswer: 'Albert Einstein', // Changed to string
          points: 10
        },
        {
          question: 'Define photosynthesis and its importance in the ecosystem.',
          type: 'essay',
          points: 30
        }
      ]
    });

    const programmingExam = new Exam({
      title: 'Basic Programming Concepts',
      description: 'Test your understanding of basic programming concepts and logic.',
      duration: 75,
      passingScore: 65,
      creator: adminUser._id,
      questions: [
        {
          question: 'What does HTML stand for?',
          type: 'multiple-choice',
          options: ['Hyper Text Markup Language', 'Home Tool Markup Language', 'Hyperlinks and Text Markup Language', 'Hyper Text Making Language'],
          correctAnswer: 'Hyper Text Markup Language',
          points: 10
        },
        {
          question: 'Which of the following is NOT a programming language?',
          type: 'multiple-choice',
          options: ['Python', 'JavaScript', 'HTML', 'Java'],
          correctAnswer: 'HTML',
          points: 10
        },
        {
          question: 'What is the output of 3 + 2 * 4 in most programming languages?',
          type: 'multiple-choice',
          options: ['20', '11', '14', '9'],
          correctAnswer: '11',
          points: 15
        },
        {
          question: 'Explain the difference between front-end and back-end development.',
          type: 'essay',
          points: 25
        }
      ]
    });

    await mathExam.save();
    await scienceExam.save();
    await programmingExam.save();

    console.log('Created sample exams');
    console.log('\nSample login credentials:');
    console.log('Admin: admin@example.com / admin123');
    console.log('Student: student@example.com / student123');
    
    process.exit();
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();