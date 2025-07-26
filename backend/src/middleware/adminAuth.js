const User = require('../models/User');

const adminAuth = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId);
        
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        next();
    } catch (error) {
        res.status(500).json({ message: 'Authorization failed' });
    }
};

module.exports = adminAuth;