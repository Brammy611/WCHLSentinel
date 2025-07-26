import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const PreExam = ({ onStart }) => {
  const [biodata, setBiodata] = useState({
    fullName: '',
    studentId: '',
    phoneNumber: ''
  });
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [screenShareReady, setScreenShareReady] = useState(false);
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [step, setStep] = useState(1); // 1: Rules, 2: Setup, 3: Face Registration, 4: Ready
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      stopAllStreams();
    };
  }, []);

  const stopAllStreams = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: true 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraReady(true);
        setMicReady(true);
      }
    } catch (error) {
      console.error('Camera/Microphone access error:', error);
      setError('Camera and microphone access is required for AI proctoring. Please allow access and try again.');
    }
  };

  const requestScreenShare = async () => {
    try {
      await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenShareReady(true);
    } catch (error) {
      console.error('Screen share error:', error);
      setError('Screen sharing is required for monitoring. Please allow access.');
    }
  };

  const captureAndRegisterFace = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      
      // Convert canvas to blob
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      
      // Create form data
      const formData = new FormData();
      formData.append('faceImage', blob);
      formData.append('studentId', biodata.studentId);
      
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/exams/register-face',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        setFaceRegistered(true);
        setStep(4);
      } else {
        setError(response.data.message || 'Failed to register face');
      }
    } catch (error) {
      console.error('Face registration error:', error);
      setError('Failed to register face. Please ensure your face is clearly visible and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
      startCamera();
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleStartExam = () => {
    if (!cameraReady || !micReady || !faceRegistered) {
      setError('Please complete all setup steps before starting the exam');
      return;
    }
    if (!biodata.fullName || !biodata.studentId || !biodata.phoneNumber) {
      setError('Please fill in all required information');
      return;
    }
    onStart(biodata);
  };

  if (step === 1) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h2 className="text-3xl font-bold mb-6 text-center">AI Proctored Exam Rules</h2>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-semibold text-red-800 mb-4">⚠️ Important: AI Proctoring is Active</h3>
          <p className="text-red-700">This exam uses advanced AI technology to monitor your behavior and ensure exam integrity.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-green-600">✅ Allowed</h3>
            <ul className="space-y-2 text-sm">
              <li>• Looking at your screen</li>
              <li>• Normal head movements</li>
              <li>• Drinking water (clear container)</li>
              <li>• Using provided scratch paper</li>
              <li>• Asking technical questions via chat</li>
            </ul>
          </div>
          
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-red-600">❌ Prohibited</h3>
            <ul className="space-y-2 text-sm">
              <li>• Looking away from screen frequently</li>
              <li>• Multiple people in frame</li>
              <li>• Using phones or other devices</li>
              <li>• Talking or communicating with others</li>
              <li>• Leaving the camera view</li>
              <li>• Opening other applications</li>
            </ul>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">🔍 AI Monitoring Features</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <strong>Face Detection:</strong> Ensures only you are taking the exam
            </div>
            <div>
              <strong>Eye Tracking:</strong> Monitors where you're looking
            </div>
            <div>
              <strong>Behavior Analysis:</strong> Detects suspicious activities
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 text-sm">
            <strong>Note:</strong> All proctoring data is processed securely and used only for exam integrity purposes. 
            Your privacy is protected and recordings are automatically deleted after 30 days.
          </p>
        </div>

        <div className="text-center">
          <button
            onClick={handleNext}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 text-lg font-medium"
          >
            I Understand - Proceed to Setup
          </button>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">System Setup & Verification</h2>
        
        <div className="space-y-6">
          {/* Personal Information */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Student Information</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={biodata.fullName}
                  onChange={(e) => setBiodata({ ...biodata, fullName: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student ID *
                </label>
                <input
                  type="text"
                  value={biodata.studentId}
                  onChange={(e) => setBiodata({ ...biodata, studentId: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                value={biodata.phoneNumber}
                onChange={(e) => setBiodata({ ...biodata, phoneNumber: e.target.value })}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Camera Test */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Camera & Microphone Test</h3>
            <div className="relative aspect-video mb-4 bg-gray-100 rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${cameraReady ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">{cameraReady ? 'Camera: Ready' : 'Camera: Not Ready'}</span>
              </div>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${micReady ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">{micReady ? 'Microphone: Ready' : 'Microphone: Not Ready'}</span>
              </div>
            </div>
          </div>

          {/* Screen Share */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Screen Monitoring</h3>
            <p className="text-gray-600 mb-4">
              We need permission to monitor your screen activity during the exam to ensure integrity.
            </p>
            <button
              onClick={requestScreenShare}
              className={`px-4 py-2 rounded-lg ${
                screenShareReady 
                  ? 'bg-green-600 text-white' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              disabled={screenShareReady}
            >
              {screenShareReady ? '✓ Screen Access Granted' : 'Grant Screen Access'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="text-center">
            <button
              onClick={handleNext}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={!cameraReady || !micReady || !biodata.fullName || !biodata.studentId || !biodata.phoneNumber}
            >
              Continue to Face Registration
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">Face Registration for AI Proctoring</h2>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800">
            <strong>Face Registration:</strong> We need to register your face for identity verification during the exam. 
            Please look directly at the camera and ensure good lighting.
          </p>
        </div>

        <div className="bg-white border rounded-lg p-6">
          <div className="relative aspect-video mb-4 bg-gray-100 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="text-center">
            <button
              onClick={captureAndRegisterFace}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
              disabled={loading || !cameraReady}
            >
              {loading ? 'Registering Face...' : 'Register My Face'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">Ready to Start Exam</h2>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-green-800 mb-4">✅ All Systems Ready</h3>
          <div className="space-y-2 text-green-700">
            <div>• Camera and microphone are active</div>
            <div>• Face registration completed</div>
            <div>• AI proctoring system initialized</div>
            <div>• Student information verified</div>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Final Reminders</h3>
          <ul className="space-y-2 text-gray-700">
            <li>• Keep your face visible throughout the exam</li>
            <li>• Avoid looking away from the screen frequently</li>
            <li>• Ensure no one else enters the camera view</li>
            <li>• Do not minimize or switch windows</li>
            <li>• If you encounter technical issues, use the help chat</li>
          </ul>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="text-center">
          <button
            onClick={handleStartExam}
            className="bg-red-600 text-white px-8 py-4 rounded-lg hover:bg-red-700 text-lg font-medium"
          >
            Start Proctored Exam
          </button>
        </div>
      </div>
    );
  }
};

export default PreExam;