import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const PreExam = ({ onStart }) => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [biodata, setBiodata] = useState({
    fullName: '',
    studentId: '',
    phoneNumber: ''
  });
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [screenShareReady, setScreenShareReady] = useState(false);
  const [step, setStep] = useState(1); // 1: Rules, 2: Setup, 3: Ready
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 }, 
          facingMode: 'user' 
        },
        audio: true 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
          setMicReady(true);
          console.log(`Camera stream loaded. Video dimensions: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
        };
      }
    } catch (error) {
      console.error('Camera/Microphone access error:', error);
      let errorMessage = 'Camera and microphone access is required for AI proctoring. ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera and microphone access in your browser settings and refresh the page.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera or microphone found. Please check your devices.';
      } else {
        errorMessage += 'Please check your camera and microphone settings.';
      }
      
      setError(errorMessage);
    }
  };

  const requestScreenShare = async () => {
    try {
      setError(null);
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true,
        audio: false
      });
      
      displayStream.getTracks().forEach(track => track.stop());
      setScreenShareReady(true);
    } catch (error) {
      console.error('Screen share error:', error);
      if (error.name === 'NotAllowedError') {
        setError('Screen sharing permission is required for exam monitoring. Please allow access when prompted.');
      } else {
        setError('Screen sharing is required for monitoring. Please try again.');
      }
    }
  };

  const validateBiodata = () => {
    if (!biodata.fullName.trim()) {
      setError('Please enter your full name');
      return false;
    }
    if (!biodata.studentId.trim()) {
      setError('Please enter your student ID');
      return false;
    }
    if (!biodata.phoneNumber.trim()) {
      setError('Please enter your phone number');
      return false;
    }
    return true;
  };

  const captureAndRegisterFace = async () => {
    if (!videoRef.current || !canvasRef.current) {
      setError('Camera is not ready. Please enable camera access.');
      return false;
    }

    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      setError('Camera stream not active. Please wait a moment and ensure your camera is on.');
      return false;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
  
      // Tampilkan gambar yang diambil di konsol untuk debug
      const imageDataUrl = canvas.toDataURL('image/jpeg');
      console.log('Captured image data URL:', imageDataUrl.substring(0, 50) + '...');
  
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));

      const formData = new FormData();
      formData.append('faceImage', blob, 'face.jpg');
      formData.append('studentId', biodata.studentId);
      
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:5000/api/exams/registerFace`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to register face.');
      }

      console.log("Face registered successfully:", data);
      return true;
    } catch (error) {
      console.error('Face registration error:', error);
      setError(error.message || 'Failed to register face. Please ensure you are in the camera frame.');
      return false;
    }
  };

  const handleNext = async () => {
    setError(null);
    if (step === 1) {
      setStep(2);
      setTimeout(() => startCamera(), 100);
    } else if (step === 2) {
      if (!validateBiodata()) {
        return;
      }
      if (!cameraReady || !micReady || !screenShareReady) {
        setError('Please ensure camera, microphone, and screen share are ready before proceeding.');
        return;
      }
      setLoading(true);
      const faceRegistered = await captureAndRegisterFace();
      setLoading(false);
      if (faceRegistered) {
        setStep(3);
      }
    }
  };

  const handleStartExam = async () => {
    if (!validateBiodata()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found. Please login again.");
      }

      const response = await fetch(`http://localhost:5000/api/exams/${id}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName: biodata.fullName.trim(),
          studentId: biodata.studentId.trim(),
          phoneNumber: biodata.phoneNumber.trim()
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      console.log("Exam started successfully:", data);
      
      if (onStart) {
        onStart({
          ...biodata,
          sessionId: data.sessionId,
          exam: data.exam
        });
      } else {
        navigate(`/exam/${id}`, { 
          state: { 
            biodata,
            sessionId: data.sessionId,
            exam: data.exam
          } 
        });
      }
    } catch (error) {
      console.error("Start exam error:", error);
      setError(error.message || "Failed to start exam. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  if (step === 1) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h2 className="text-3xl font-bold mb-6 text-center">AI Proctored Exam Rules</h2>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-semibold text-red-800 mb-4">Important: AI Proctoring is Active</h3>
          <p className="text-red-700">This exam uses advanced AI technology to monitor your behavior and ensure exam integrity.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-green-600">Allowed</h3>
            <ul className="space-y-2 text-sm">
              <li>• Looking at your screen</li>
              <li>• Normal head movements</li>
              <li>• Drinking water (clear container)</li>
              <li>• Using provided scratch paper</li>
              <li>• Asking technical questions via chat</li>
            </ul>
          </div>
          
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-red-600">Prohibited</h3>
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

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

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
          {/* Biodata */}
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
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your full name"
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
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your student ID"
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
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your phone number"
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
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                  <div className="text-center">
                    <div className="animate-pulse text-gray-500 mb-2">Starting camera...</div>
                    <button
                      onClick={startCamera}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      Retry Camera Access
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-4">
              <strong>Penting:</strong> Pastikan wajah Anda berada di tengah bingkai dengan pencahayaan yang cukup. Ini akan digunakan untuk verifikasi identitas Anda selama ujian.
            </p>
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
              {screenShareReady ? 'Screen Access Granted' : 'Grant Screen Access'}
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
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !cameraReady || !micReady || !biodata.fullName.trim() || !biodata.studentId.trim() || !biodata.phoneNumber.trim()}
            >
              {loading ? 'Registering Face...' : 'Continue to Start Exam'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">Ready to Start Exam</h2>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-green-800 mb-4">All Systems Ready</h3>
          <div className="space-y-2 text-green-700">
            <div>• Camera and microphone are active</div>
            <div>• AI proctoring system initialized</div>
            <div>• Student information verified</div>
            <div>• Name: {biodata.fullName}</div>
            <div>• Student ID: {biodata.studentId}</div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="text-center">
          <button
            onClick={handleStartExam}
            disabled={loading}
            className="bg-red-600 text-white px-8 py-4 rounded-lg hover:bg-red-700 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Starting Exam...' : 'Start Proctored Exam'}
          </button>
        </div>
      </div>
    );
  }
};

export default PreExam;
