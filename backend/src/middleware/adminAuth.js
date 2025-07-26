const User = require('../models/User');

const adminAuth = async (req, res, next) => {
    try {
        // Check if user is authenticated (should be done by auth middleware first)
        if (!req.user || !req.user.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Get user from database
        const user = await User.findById(req.user.userId);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user has admin role
        if (user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        // Add user object to request for further use
        req.adminUser = user;
        next();
    } catch (error) {
        console.error('Admin auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during authorization'
        });
    }
};

module.exports = adminAuth;