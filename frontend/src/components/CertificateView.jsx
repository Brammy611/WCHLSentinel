import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const CertificateView = () => {
  const { certificateId } = useParams();
  const [certificate, setCertificate] = useState(null);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCertificate = async () => {
      try {
        // Fetch certificate data
        const certResponse = await axios.get(`/api/exams/certificate/${certificateId}`);
        if (certResponse.data.success) {
          setCertificate(certResponse.data.certificate);
        }

        // Verify certificate on blockchain
        const verifyResponse = await axios.get(`/api/exams/certificate/${certificateId}/verify`);
        if (verifyResponse.data.success) {
          setVerification(verifyResponse.data);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching certificate:', error);
        setError('Certificate not found or invalid');
        setLoading(false);
      }
    };

    if (certificateId) {
      fetchCertificate();
    }
  }, [certificateId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying certificate...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">Certificate Not Found</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Verification Status */}
          {verification && (
            <div className={`mb-8 p-4 rounded-lg border ${
              verification.isValid 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-center">
                <div className="text-2xl mr-3">
                  {verification.isValid ? '✅' : '❌'}
                </div>
                <div>
                  <h2 className={`text-lg font-bold ${
                    verification.isValid ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {verification.isValid ? 'Certificate Verified' : 'Certificate Invalid'}
                  </h2>
                  <p className={`text-sm ${
                    verification.isValid ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {verification.isValid 
                      ? 'This certificate is authentic and verified on the blockchain'
                      : 'This certificate could not be verified or has been tampered with'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Certificate Display */}
          {certificate && (
            <div className="bg-white shadow-2xl rounded-lg overflow-hidden">
              {/* Certificate Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-6">
                <div className="text-center text-white">
                  <div className="text-6xl mb-4">🎓</div>
                  <h1 className="text-3xl font-bold">CERTIFICATE OF COMPLETION</h1>
                  <p className="text-blue-100 mt-2">AI Exam Platform</p>
                </div>
              </div>

              {/* Certificate Body */}
              <div className="px-12 py-8">
                <div className="text-center mb-8">
                  <p className="text-lg text-gray-600 mb-4">This is to certify that</p>
                  <h2 className="text-4xl font-bold text-gray-900 mb-4">{certificate.studentName}</h2>
                  <p className="text-lg text-gray-600 mb-2">has successfully completed</p>
                  <h3 className="text-2xl font-semibold text-blue-600 mb-6">{certificate.examTitle}</h3>
                </div>

                {/* Achievement Details */}
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{certificate.score}%</div>
                    <div className="text-sm text-gray-600">Final Score</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{certificate.passingScore}%</div>
                    <div className="text-sm text-gray-600">Passing Score</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">PASSED</div>
                    <div className="text-sm text-gray-600">Status</div>
                  </div>
                </div>

                {/* Certificate Details */}
                <div className="border-t pt-6">
                  <div className="grid md:grid-cols-2 gap-6 text-sm">
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Certificate Details</h4>
                      <p><strong>Certificate ID:</strong> {certificate.certificateId}</p>
                      <p><strong>Student ID:</strong> {certificate.studentId}</p>
                      <p><strong>Completion Date:</strong> {new Date(certificate.completedAt).toLocaleDateString()}</p>
                      <p><strong>Issue Date:</strong> {new Date(certificate.issuedAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Verification</h4>
                      <p><strong>Issuer:</strong> {certificate.issuer}</p>
                      <p><strong>Blockchain Hash:</strong></p>
                      <p className="font-mono text-xs break-all text-gray-600">{certificate.hash}</p>
                      <p><strong>Status:</strong> <span className="text-green-600">Verified ✓</span></p>
                    </div>
                  </div>
                </div>

                {/* QR Code and Actions */}
                <div className="border-t pt-6 mt-6">
                  <div className="flex flex-col md:flex-row justify-between items-center">
                    <div className="mb-4 md:mb-0">
                      <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                        <span className="text-xs text-gray-500">QR Code</span>
                      </div>
                      <p className="text-xs text-gray-500 text-center mt-1">Scan to verify</p>
                    </div>
                    
                    <div className="space-x-4">
                      <button
                        onClick={() => window.print()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
                        Print Certificate
                      </button>
                      <button
                        onClick={() => {
                          const url = window.location.href;
                          navigator.clipboard.writeText(url);
                          alert('Certificate link copied to clipboard!');
                        }}
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                      >
                        Share Certificate
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Certificate Footer */}
              <div className="bg-gray-100 px-8 py-4 text-center">
                <p className="text-xs text-gray-600">
                  This certificate is digitally signed and secured on the blockchain. 
                  Verify authenticity at verify.aiexam.platform
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Certificate ID: {certificate.certificateId} | Generated on {new Date(certificate.issuedAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Verification Details */}
          {verification && verification.isValid && (
            <div className="mt-8 bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Blockchain Verification Details</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p><strong>Hash Verification:</strong> {verification.verificationDetails.hashMatch ? '✅ Passed' : '❌ Failed'}</p>
                  <p><strong>Blockchain Status:</strong> {verification.verificationDetails.blockchainConfirmed ? '✅ Confirmed' : '❌ Not Found'}</p>
                </div>
                <div>
                  <p><strong>Verified At:</strong> {new Date(verification.verificationDetails.verifiedAt).toLocaleString()}</p>
                  <p><strong>Network:</strong> Internet Computer Protocol (ICP)</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CertificateView;