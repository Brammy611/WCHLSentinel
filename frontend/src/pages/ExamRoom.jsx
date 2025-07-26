import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import PreExam from '../components/PreExam';
import Timer from '../components/Timer';

const ExamRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const proctoringIntervalRef = useRef(null);
  
  // States
  const [examStarted, setExamStarted] = useState(false);
  const [biodata, setBiodata] = useState(null);
  const [exam, setExam] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [violations, setViolations] = useState([]);
  const [proctoringActive, setProctoringActive] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const startExam = async () => {
      try {
        const token = localStorage.getItem('token');
        const startResponse = await axios.post(
          `http://localhost:5000/api/exams/${id}/start`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setSessionId(startResponse.data.sessionId);
        setExam(startResponse.data.exam);
        setTimeLeft(startResponse.data.exam.duration * 60); // Convert to seconds
        setLoading(false);
      } catch (error) {
        console.error('Error starting exam:', error);
        navigate('/dashboard');
      }
    };

    startExam();
  }, [id, navigate]);

  // Start AI proctoring monitoring
  const startProctoring = () => {
    if (proctoringIntervalRef.current) return;

    setProctoringActive(true);
    
    proctoringIntervalRef.current = setInterval(async () => {
      if (videoRef.current && sessionId) {
        await captureAndAnalyzeFrame();
      }
    }, 3000); // Analyze every 3 seconds
  };

  // Stop AI proctoring
  const stopProctoring = () => {
    if (proctoringIntervalRef.current) {
      clearInterval(proctoringIntervalRef.current);
      proctoringIntervalRef.current = null;
    }
    setProctoringActive(false);
  };

  // Capture frame and send for AI analysis
  const captureAndAnalyzeFrame = async () => {
    try {
      if (!videoRef.current || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      
      // Convert canvas to blob
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.7));
      
      // Send frame for analysis
      const formData = new FormData();
      formData.append('frame', blob);
      formData.append('sessionId', sessionId);
      
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/exams/proctoring/frame',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success && response.data.analysis.violations.length > 0) {
        const newViolations = response.data.analysis.violations;
        setViolations(prev => [...prev, ...newViolations]);
        setWarningCount(prev => prev + newViolations.length);
        
        // Show warning popup for serious violations
        newViolations.forEach(violation => {
          if (violation.severity > 0.8) {
            showViolationAlert(violation);
          }
        });
      }
    } catch (error) {
      console.error('Proctoring frame analysis error:', error);
    }
  };

  // Show violation alert to user
  const showViolationAlert = (violation) => {
    // Create and show a temporary alert
    const alertDiv = document.createElement('div');
    alertDiv.className = 'fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm';
    alertDiv.innerHTML = `
      <div class="flex items-center">
        <div class="mr-3">⚠️</div>
        <div>
          <div class="font-semibold">Proctoring Alert</div>
          <div class="text-sm">${violation.description}</div>
        </div>
      </div>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Remove alert after 5 seconds
    setTimeout(() => {
      if (document.body.contains(alertDiv)) {
        document.body.removeChild(alertDiv);
      }
    }, 5000);
  };

  const handleAnswerChange = (questionId, value, type) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        answer: value,
        type: type,
        questionId: questionId
      }
    }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // Stop proctoring before submitting
      stopProctoring();
      
      const token = localStorage.getItem('token');
      
      // Format answers as an array
      const formattedAnswers = Object.values(answers).map(answer => ({
        questionId: answer.questionId,
        answer: answer.answer,
        type: answer.type
      }));

      const response = await axios.post(
        `http://localhost:5000/api/exams/${id}/submit`,
        {
          sessionId: sessionId,
          answers: formattedAnswers
        },
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        // Stop the camera before navigating
        if (videoRef.current?.srcObject) {
          videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        }
        navigate(`/result/${response.data.session._id}`);
      } else {
        alert('Failed to submit exam. Please try again.');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error submitting exam:', error);
      alert('Error submitting exam. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleTimeUp = () => {
    alert('Time is up! The exam will be submitted automatically.');
    handleSubmit();
  };

  const handleExamStart = async (biodataInput) => {
    setBiodata(biodataInput);
    setExamStarted(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: true 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Start AI proctoring after a short delay
        setTimeout(() => {
          startProctoring();
        }, 2000);
      }
    } catch (error) {
      console.error('Camera error:', error);
      alert('Camera access is required for proctored exam');
      navigate('/dashboard');
    }
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopProctoring();
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (!examStarted) {
    return <PreExam onStart={handleExamStart} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Timer and Proctoring Status */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">{exam?.title}</h1>
          
          <div className="flex items-center space-x-6">
            {/* Proctoring Status */}
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${proctoringActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium">
                {proctoringActive ? 'AI Monitoring Active' : 'Monitoring Inactive'}
              </span>
            </div>
            
            {/* Warning Count */}
            {warningCount > 0 && (
              <div className="flex items-center space-x-2 text-orange-600">
                <span className="text-lg">⚠️</span>
                <span className="text-sm font-medium">{warningCount} Warnings</span>
              </div>
            )}
            
            {/* Timer */}
            <div className="bg-blue-100 px-4 py-2 rounded-lg">
              <Timer timeLeft={timeLeft} onTimeUp={handleTimeUp} />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4">
        <div className="grid grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="col-span-3">
            {/* Progress Bar */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Question {currentQuestion + 1} of {exam?.questions?.length}
                </span>
                <span className="text-sm text-gray-500">
                  {Math.round(((currentQuestion + 1) / exam?.questions?.length) * 100)}% Complete
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentQuestion + 1) / exam?.questions?.length) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Questions */}
            <div className="space-y-6">
              {exam?.questions?.map((question, index) => (
                <div key={question._id} className="bg-white p-6 rounded-lg shadow-sm">
                  <h3 className="text-lg font-semibold mb-4">
                    {index + 1}. {question.question}
                  </h3>
                  
                  {question.type === 'multiple-choice' ? (
                    <div className="space-y-3">
                      {question.options.map((option, optIndex) => (
                        <label key={optIndex} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                          <input
                            type="radio"
                            name={`question-${question._id}`}
                            value={option}
                            onChange={() => handleAnswerChange(question._id, option, 'multiple-choice')}
                            className="mr-3 text-blue-600"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      className="w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[200px] resize-vertical"
                      placeholder="Type your detailed answer here..."
                      onChange={(e) => handleAnswerChange(question._id, e.target.value, 'essay')}
                      value={answers[question._id]?.answer || ''}
                    />
                  )}
                  
                  <div className="mt-3 text-sm text-gray-500">
                    Points: {question.points || 10}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Submit Button */}
            <div className="mt-8 text-center">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-red-600 text-white px-8 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Exam'}
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Camera Feed */}
            <div className="bg-white rounded-lg shadow-sm p-4 sticky top-24">
              <h3 className="font-semibold mb-3">Live Monitoring</h3>
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full rounded-lg border"
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs">
                  LIVE
                </div>
              </div>
              
              {/* Student Info */}
              <div className="mt-4 text-sm text-gray-600">
                <p><strong>Name:</strong> {biodata?.fullName}</p>
                <p><strong>ID:</strong> {biodata?.studentId}</p>
              </div>
            </div>

            {/* Violations Log */}
            {violations.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="font-semibold mb-3 text-orange-600">Recent Alerts</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {violations.slice(-5).map((violation, index) => (
                    <div key={index} className="text-xs p-2 bg-orange-50 rounded border-l-2 border-orange-300">
                      <div className="font-medium">{violation.type.replace('_', ' ')}</div>
                      <div className="text-gray-600">{violation.description}</div>
                      <div className="text-gray-500 text-xs">
                        {new Date(violation.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Navigation */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold mb-3">Question Navigation</h3>
              <div className="grid grid-cols-5 gap-2">
                {exam?.questions?.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentQuestion(index)}
                    className={`p-2 text-xs rounded font-medium ${
                      answers[exam.questions[index]._id] 
                        ? 'bg-green-100 text-green-800 border-green-300' 
                        : 'bg-gray-100 text-gray-600 border-gray-300'
                    } border hover:bg-opacity-80 transition-colors`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Help */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-blue-800">Need Help?</h3>
              <p className="text-sm text-blue-700 mb-3">
                If you encounter technical issues, contact support immediately.
              </p>
              <button className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamRoom;