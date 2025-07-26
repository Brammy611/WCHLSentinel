const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long']
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    role: {
        type: String,
        enum: ['student', 'admin', 'instructor'],
        default: 'student'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    examHistory: [{
        exam: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Exam'
        },
        session: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ExamSession'
        },
        score: Number,
        completedAt: Date
    }]
}, {
    timestamps: true
});

// Index for better performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

// Hash password before saving
// userSchema.pre('save', async function(next) {
//     // Only hash the password if it has been modified (or is new)
//     if (!this.isModified('password')) return next();
    
//     try {
//         // Hash password with cost of 12
//         const hashedPassword = await bcrypt.hash(this.password, 12);
//         this.password = hashedPassword;
//         next();
//     } catch (error) {
//         next(error);
//     }
// });

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Update last login
userSchema.methods.updateLastLogin = function() {
    this.lastLogin = new Date();
    return this.save();
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
    const userObject = this.toObject();
    delete userObject.password;
    return userObject;
};

const User = mongoose.model('User', userSchema);

module.exports = User;