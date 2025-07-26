import { useState, useRef, useEffect } from 'react';

const PreExam = ({ onStart }) => {
  const [biodata, setBiodata] = useState({
    fullName: '',
    studentId: '',
    phoneNumber: ''
  });
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraReady(true);
      }
    } catch (error) {
      console.error('Camera access error:', error);
      alert('Camera access is required to take the exam');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cameraReady) {
      alert('Please enable your camera to continue');
      return;
    }
    if (!biodata.fullName || !biodata.studentId || !biodata.phoneNumber) {
      alert('Please fill in all fields');
      return;
    }
    onStart(biodata);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Exam Preparation</h2>
      
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Camera Check</h3>
        <div className="relative aspect-video mb-4 bg-gray-100 rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>
        {!cameraReady && (
          <p className="text-red-600">Please enable your camera to continue</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={biodata.fullName}
            onChange={(e) => setBiodata({ ...biodata, fullName: e.target.value })}
            className="w-full p-2 border rounded-lg"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Student ID
          </label>
          <input
            type="text"
            value={biodata.studentId}
            onChange={(e) => setBiodata({ ...biodata, studentId: e.target.value })}
            className="w-full p-2 border rounded-lg"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            value={biodata.phoneNumber}
            onChange={(e) => setBiodata({ ...biodata, phoneNumber: e.target.value })}
            className="w-full p-2 border rounded-lg"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          disabled={!cameraReady}
        >
          Start Exam
        </button>
      </form>
    </div>
  );
};

export default PreExam;