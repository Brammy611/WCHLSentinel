const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.header('Authorization');
        let token = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.replace('Bearer ', '');
        }
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'Access denied. No token provided.' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if user still exists
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Token is valid but user no longer exists' 
            });
        }

        // Add user info to request
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role || user.role
        };
        
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid token' 
            });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token expired' 
            });
        }
        
        res.status(401).json({ 
            success: false,
            message: 'Token verification failed' 
        });
    }
};

module.exports = auth;