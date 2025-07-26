import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import PreExam from '../components/PreExam';

const ExamRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  
  // Add missing state declarations
  const [examStarted, setExamStarted] = useState(false);
  const [biodata, setBiodata] = useState(null);
  const [exam, setExam] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);

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
        setLoading(false);
      } catch (error) {
        console.error('Error starting exam:', error);
        navigate('/dashboard');
      }
    };

    startExam();
  }, [id, navigate]);

  const handleAnswerChange = (questionId, value, type) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        answer: value,
        type: type,
        questionId: questionId // Add questionId to the answer object
      }
    }));
  };

  const handleSubmit = async () => {
    try {
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
          sessionId: sessionId, // Add sessionId to the request
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
      }
    } catch (error) {
      console.error('Error submitting exam:', error);
      alert('Error submitting exam. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const handleExamStart = async (biodataInput) => {
    setBiodata(biodataInput);
    setExamStarted(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera error:', error);
      alert('Camera is required during the exam');
      navigate('/dashboard');
    }
  };

  if (!examStarted) {
    return <PreExam onStart={handleExamStart} />;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <h1 className="text-2xl font-bold mb-4">{exam?.title}</h1>
          <div className="space-y-6">
            {exam?.questions?.map((question, index) => (
              <div key={question._id} className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">
                  {index + 1}. {question.question}
                </h3>
                
                {question.type === 'multiple-choice' ? (
                  <div className="space-y-2">
                    {question.options.map((option, optIndex) => (
                      <label key={optIndex} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="radio"
                          name={`question-${question._id}`}
                          value={option}
                          onChange={() => handleAnswerChange(question._id, option, 'multiple-choice')}
                          className="mr-3"
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[150px]"
                    placeholder="Type your answer here..."
                    onChange={(e) => handleAnswerChange(question._id, e.target.value, 'essay')}
                    value={answers[question._id]?.answer || ''}
                  />
                )}
              </div>
            ))}
          </div>
          
          <button
            onClick={handleSubmit}
            className="mt-6 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 w-full"
          >
            Submit Exam
          </button>
        </div>
        <div className="sticky top-4">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg mb-4"
            />
            <div className="text-sm text-gray-600">
              <p>Name: {biodata?.fullName}</p>
              <p>Student ID: {biodata?.studentId}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamRoom;