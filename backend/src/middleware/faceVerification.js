const icpFaceRecognition = require('../services/icpFaceRecognitionService');

const verifyFace = async (req, res, next) => {
    try {
        if (!req.body.faceImage) {
            return res.status(400).json({
                success: false,
                message: 'Face image is required'
            });
        }

        const imageBuffer = Buffer.from(req.body.faceImage, 'base64');
        const faceDetection = await icpFaceRecognition.detectFace(imageBuffer);

        if (!faceDetection.faceDetected) {
            return res.status(400).json({
                success: false,
                message: 'No face detected in the image'
            });
        }

        if (faceDetection.faceCount > 1) {
            return res.status(400).json({
                success: false,
                message: 'Multiple faces detected in the image'
            });
        }

        next();
    } catch (error) {
        console.error('Face verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Face verification failed'
        });
    }
};

module.exports = verifyFace;