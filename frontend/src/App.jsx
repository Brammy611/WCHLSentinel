import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ExamRoom from './pages/ExamRoom';
import Result from './pages/Result';
import Login from './pages/Login';
import Navbar from './components/Navbar';
import ProtectedRoute from './routes/ProtectedRoute';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/exam/:id" element={
            <ProtectedRoute>
              <ExamRoom />
            </ProtectedRoute>
          } />
          <Route path="/result/:id" element={
            <ProtectedRoute>
              <Result />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
