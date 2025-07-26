import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function Dashboard() {
  const [exams, setExams] = useState([]);
  const [examHistory, setExamHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        
        // Fetch available exams
        const examsResponse = await axios.get('http://localhost:5000/api/exams', { headers });
        setExams(examsResponse.data);
        
        // Fetch exam history
        const historyResponse = await axios.get('http://localhost:5000/api/exams/history', { headers });
        setExamHistory(historyResponse.data);
        
        setError(null);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to fetch data');
        // Set empty arrays if fetch fails
        setExams([]);
        setExamHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome to AI Exam Platform. Choose an exam to get started.</p>
      </div>

      {error && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
          <p className="text-sm">⚠️ {error}. Showing demo data instead.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exams.map((exam) => (
          <div key={exam._id} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{exam.title}</h2>
            <p className="text-gray-600 mb-4 line-clamp-3">{exam.description}</p>
            <Link 
              to={`/exam/${exam._id}`}
              className="inline-block bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              Start Exam
            </Link>
          </div>
        ))}
      </div>

      {exams.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No exams available</h3>
          <p className="text-gray-600">Check back later for new exams.</p>
        </div>
      )}
      
      {/* Exam History Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Exam History</h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exam</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Certificate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {examHistory.map((history) => (
                <tr key={history._id}>
                  <td className="px-6 py-4">{history.examTitle}</td>
                  <td className="px-6 py-4">{new Date(history.completedAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">{history.score}%</td>
                  <td className="px-6 py-4">
                    {history.certificateId && (
                      <a
                        href={`https://explorer.icp.xyz/certificate/${history.certificateId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700"
                      >
                        View
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}