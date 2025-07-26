import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const Result = () => {
  const { id } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `http://localhost:5000/api/exams/result/${id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setResult(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching result:', error);
        setLoading(false);
      }
    };

    fetchResult();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-8">Exam Results</h1>
        
        {result && (
          <>
            <div className="text-center mb-8">
              <div className="text-6xl font-bold text-primary-600 mb-2">
                {result.score}%
              </div>
              <p className="text-xl text-gray-600">
                {result.score >= result.passingScore ? (
                  <span className="text-green-600">Passed</span>
                ) : (
                  <span className="text-red-600">Failed</span>
                )}
              </p>
            </div>

            <div className="space-y-6">
              {result.questions?.map((question, index) => (
                <div 
                  key={index} 
                  className={`p-6 rounded-lg ${
                    question.isCorrect ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  <h3 className="font-semibold mb-3">{question.question}</h3>
                  <div className="space-y-2 text-sm">
                    <p>Your answer: {question.userAnswer}</p>
                    <p>Correct answer: {question.correctAnswer}</p>
                  </div>
                </div>
              ))}
            </div>

            {result.certificateId && (
              <div className="mt-8 p-6 bg-blue-50 rounded-lg text-center">
                <h2 className="text-xl font-semibold mb-2">Certificate Generated</h2>
                <p className="text-gray-600 mb-4">
                  Congratulations! Your certificate has been generated and stored on the blockchain.
                </p>
                <a
                  href={`https://explorer.icp.xyz/certificate/${result.certificateId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  View Certificate
                </a>
              </div>
            )}
          </>
        )}

        <div className="mt-8 text-center">
          <Link
            to="/dashboard"
            className="inline-block bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Result;