import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const Result = () => {
  const { id } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

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

  const getProctoringStatusColor = (recommendation) => {
    switch (recommendation) {
      case 'PASS': return 'text-green-600 bg-green-100';
      case 'FLAG': return 'text-yellow-600 bg-yellow-100';
      case 'REVIEW_REQUIRED': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getScoreColor = (score, passingScore) => {
    if (score >= passingScore) return 'text-green-600';
    if (score >= passingScore * 0.8) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Exam Results</h1>
          <p className="text-gray-600">Your detailed exam performance and AI proctoring report</p>
        </div>

        {result && (
          <>
            {/* Main Result Card */}
            <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Score Section */}
                <div className="text-center">
                  <div className={`text-6xl font-bold mb-2 ${getScoreColor(result.score, result.passingScore)}`}>
                    {result.score}%
                  </div>
                  <div className="text-xl mb-4">
                    {result.passed ? (
                      <span className="text-green-600 font-semibold">✅ PASSED</span>
                    ) : (
                      <span className="text-red-600 font-semibold">❌ FAILED</span>
                    )}
                  </div>
                  <p className="text-gray-600">
                    Passing Score: {result.passingScore}%
                  </p>
                </div>

                {/* Proctoring Report */}
                <div className="border-l pl-8">
                  <h3 className="text-lg font-semibold mb-4">AI Proctoring Report</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Violations Detected:</span>
                      <span className="font-semibold">{result.proctoringReport.violationCount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Risk Score:</span>
                      <span className="font-semibold">{result.proctoringReport.riskScore.toFixed(1)}/10</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Status:</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getProctoringStatusColor(result.proctoringReport.recommendation)}`}>
                        {result.proctoringReport.recommendation.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Certificate Section */}
            {result.certificateId && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-100 rounded-lg p-8 mb-8 border border-blue-200">
                <div className="text-center">
                  <div className="text-4xl mb-4">🎓</div>
                  <h2 className="text-2xl font-bold text-blue-800 mb-2">Digital Certificate Generated!</h2>
                  <p className="text-blue-700 mb-6">
                    Congratulations! Your certificate has been generated and secured on the blockchain.
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-800 mb-2">Certificate ID</h4>
                      <p className="text-sm font-mono text-gray-600">{result.certificateId}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-800 mb-2">Blockchain Verified</h4>
                      <p className="text-sm text-green-600">✅ Permanently Secured</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <a
                      href={`/certificate/${result.certificateId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium mr-4"
                    >
                      View Certificate
                    </a>
                    <a
                      href={`https://verify.aiexam.platform/certificate/${result.certificateId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium"
                    >
                      Verify on Blockchain
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Question Details */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Question-by-Question Analysis</h2>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  {showDetails ? 'Hide Details' : 'Show Details'}
                </button>
              </div>

              {showDetails && (
                <div className="space-y-6">
                  {result.questions?.map((question, index) => (
                    <div 
                      key={index} 
                      className={`p-6 rounded-lg border-l-4 ${
                        question.isCorrect 
                          ? 'bg-green-50 border-green-400' 
                          : 'bg-red-50 border-red-400'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-lg">
                          Question {index + 1}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          question.isCorrect 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {question.isCorrect ? '✅ Correct' : '❌ Incorrect'}
                        </span>
                      </div>
                      
                      <p className="text-gray-700 mb-4">{question.question}</p>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-gray-600 mb-1">Your Answer:</h4>
                          <p className={`p-3 rounded bg-white border ${
                            question.isCorrect ? 'border-green-300' : 'border-red-300'
                          }`}>
                            {question.userAnswer || 'No answer provided'}
                          </p>
                        </div>
                        
                        {question.type === 'multiple-choice' && (
                          <div>
                            <h4 className="font-medium text-gray-600 mb-1">Correct Answer:</h4>
                            <p className="p-3 rounded bg-green-50 border border-green-300 text-green-800">
                              {question.correctAnswer}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Proctoring Violations Details */}
            {result.proctoringReport.violations.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                <h2 className="text-xl font-bold mb-4 text-orange-600">Proctoring Violations</h2>
                <div className="space-y-3">
                  {result.proctoringReport.violations.map((violation, index) => (
                    <div key={index} className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-orange-800">
                            {violation.type.replace('_', ' ').toUpperCase()}
                          </h4>
                          <p className="text-orange-700 text-sm">{violation.description}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-orange-600 font-medium">
                            Severity: {(violation.severity * 10).toFixed(1)}/10
                          </div>
                          <div className="text-orange-500 text-xs">
                            {new Date(violation.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Performance Summary */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-xl font-bold mb-4">Performance Summary</h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.questions?.filter(q => q.isCorrect).length || 0}
                  </div>
                  <div className="text-sm text-blue-700">Correct Answers</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {result.questions?.filter(q => !q.isCorrect).length || 0}
                  </div>
                  <div className="text-sm text-red-700">Incorrect Answers</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">
                    {result.questions?.length || 0}
                  </div>
                  <div className="text-sm text-gray-700">Total Questions</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="text-center space-x-4">
              <Link
                to="/dashboard"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
              >
                Back to Dashboard
              </Link>
              
              {result.certificateId && (
                <button
                  onClick={() => window.print()}
                  className="inline-block bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium"
                >
                  Print Results
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Result;