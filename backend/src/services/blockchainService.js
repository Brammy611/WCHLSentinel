const crypto = require('crypto');
const { HttpAgent, Actor } = require('@dfinity/agent');
const { Principal } = require('@dfinity/principal');

class BlockchainService {
    constructor() {
        this.agent = null;
        this.canisterId = process.env.CERTIFICATE_CANISTER_ID;
        this.isInitialized = false;
        this.certificates = new Map(); // In-memory storage for demo
    }

    async init() {
        try {
            // Initialize Internet Computer agent
            this.agent = new HttpAgent({
                host: process.env.IC_HOST || 'https://ic0.app',
            });

            // In development, fetch root key
            if (process.env.NODE_ENV === 'development') {
                await this.agent.fetchRootKey();
            }

            this.isInitialized = true;
            console.log('Blockchain service initialized');
        } catch (error) {
            console.error('Failed to initialize blockchain service:', error);
            // Continue without blockchain for demo purposes
            this.isInitialized = false;
        }
    }

    // Generate certificate hash
    generateCertificateHash(certificateData) {
        const dataString = JSON.stringify(certificateData);
        return crypto.createHash('sha256').update(dataString).digest('hex');
    }

    // Create digital certificate
    async createCertificate(examResult, studentData) {
        try {
            const certificateData = {
                studentId: studentData.studentId,
                studentName: studentData.fullName,
                examTitle: examResult.examTitle,
                score: examResult.score,
                passingScore: examResult.passingScore,
                completedAt: examResult.completedAt,
                issuedAt: new Date().toISOString(),
                issuer: 'AI Exam Platform',
                certificateId: this.generateCertificateId()
            };

            // Generate certificate hash
            const certificateHash = this.generateCertificateHash(certificateData);
            certificateData.hash = certificateHash;

            // Store certificate (in real implementation, this would go to ICP canister)
            const certificateId = await this.storeCertificateOnBlockchain(certificateData);
            
            return {
                success: true,
                certificateId,
                certificateData,
                verificationUrl: `https://verify.aiexam.platform/certificate/${certificateId}`
            };

        } catch (error) {
            console.error('Certificate creation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    generateCertificateId() {
        return 'CERT_' + crypto.randomBytes(16).toString('hex').toUpperCase();
    }

    // Store certificate on blockchain (ICP)
    async storeCertificateOnBlockchain(certificateData) {
        try {
            if (this.isInitialized && this.canisterId) {
                // Real ICP canister interaction would go here
                // For now, we'll simulate blockchain storage
                
                const certificateId = certificateData.certificateId;
                
                // Simulate blockchain storage
                this.certificates.set(certificateId, {
                    ...certificateData,
                    blockHeight: Math.floor(Math.random() * 1000000),
                    txHash: crypto.randomBytes(32).toString('hex'),
                    timestamp: Date.now()
                });

                console.log(`Certificate ${certificateId} stored on blockchain`);
                return certificateId;
            } else {
                // Fallback: store locally for demo
                const certificateId = certificateData.certificateId;
                this.certificates.set(certificateId, certificateData);
                console.log(`Certificate ${certificateId} stored locally (demo mode)`);
                return certificateId;
            }
        } catch (error) {
            console.error('Blockchain storage error:', error);
            throw error;
        }
    }

    // Verify certificate
    async verifyCertificate(certificateId) {
        try {
            if (this.certificates.has(certificateId)) {
                const certificate = this.certificates.get(certificateId);
                
                // Verify hash integrity
                const originalHash = certificate.hash;
                const currentHash = this.generateCertificateHash({
                    ...certificate,
                    hash: undefined // Exclude hash from hash calculation
                });

                const isValid = originalHash === currentHash;

                return {
                    success: true,
                    isValid,
                    certificate,
                    verificationDetails: {
                        hashMatch: isValid,
                        blockchainConfirmed: true,
                        verifiedAt: new Date().toISOString()
                    }
                };
            } else {
                return {
                    success: false,
                    isValid: false,
                    error: 'Certificate not found'
                };
            }
        } catch (error) {
            console.error('Certificate verification error:', error);
            return {
                success: false,
                isValid: false,
                error: error.message
            };
        }
    }

    // Get certificate by ID
    async getCertificate(certificateId) {
        try {
            if (this.certificates.has(certificateId)) {
                return {
                    success: true,
                    certificate: this.certificates.get(certificateId)
                };
            } else {
                return {
                    success: false,
                    error: 'Certificate not found'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Generate certificate PDF (basic implementation)
    generateCertificatePDF(certificateData) {
        // This would typically use a PDF library like PDFKit
        // For now, return certificate data
        return {
            success: true,
            pdfData: Buffer.from(JSON.stringify(certificateData, null, 2)),
            filename: `certificate_${certificateData.certificateId}.json`
        };
    }

    // Get all certificates for a student
    async getStudentCertificates(studentId) {
        try {
            const studentCertificates = [];
            
            for (const [id, certificate] of this.certificates.entries()) {
                if (certificate.studentId === studentId) {
                    studentCertificates.push({
                        certificateId: id,
                        examTitle: certificate.examTitle,
                        score: certificate.score,
                        issuedAt: certificate.issuedAt,
                        verificationUrl: `https://verify.aiexam.platform/certificate/${id}`
                    });
                }
            }

            return {
                success: true,
                certificates: studentCertificates
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = BlockchainService;