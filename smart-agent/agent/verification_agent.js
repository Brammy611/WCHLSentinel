const ethers = require('ethers');
const CertificateNFT = require('../../blockchain/artifacts/contracts/CertificateNFT.sol/CertificateNFT.json');

class VerificationAgent {
  constructor(provider, contractAddress) {
    this.provider = new ethers.providers.JsonRpcProvider(provider);
    this.contract = new ethers.Contract(contractAddress, CertificateNFT.abi, this.provider);
  }

  async verifyExamResult(examId, userId, score) {
    try {
      // Verify exam completion
      const examVerified = await this.verifyCompletion(examId, userId);
      
      if (examVerified) {
        // Issue certificate
        await this.issueCertificate(userId, examId, score);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Verification failed:', error);
      return false;
    }
  }

  async verifyCompletion(examId, userId) {
    try {
      // Check exam session data
      const examSession = await this.fetchExamSession(examId, userId);
      
      // Verify AI proctoring results
      const proctoringResults = await this.getProctoringResults(examId, userId);
      
      // Check if exam was completed within time limit
      const timeValid = this.validateExamTime(examSession);
      
      // Verify all questions were answered
      const answersComplete = this.validateAnswers(examSession);
      
      return timeValid && answersComplete && !proctoringResults.hasCheatingDetected;
    } catch (error) {
      console.error('Completion verification failed:', error);
      return false;
    }
  }

  async issueCertificate(userId, examId, score) {
    try {
      const metadataURI = await this.generateMetadataURI(examId, score);
      const signer = this.provider.getSigner();
      const tx = await this.contract.connect(signer).issueCertificate(
        userId,
        examId,
        score,
        metadataURI
      );
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error('Certificate issuance failed:', error);
      throw error;
    }
  }

  async fetchExamSession(examId, userId) {
    // Implement exam session fetching from database
    return {
      startTime: new Date(),
      endTime: new Date(),
      answers: [],
      timeLimit: 3600 // in seconds
    };
  }

  async getProctoringResults(examId, userId) {
    // Implement AI proctoring results fetching
    return {
      hasCheatingDetected: false,
      warnings: []
    };
  }

  validateExamTime(examSession) {
    const duration = (examSession.endTime - examSession.startTime) / 1000;
    return duration <= examSession.timeLimit;
  }

  validateAnswers(examSession) {
    return examSession.answers.every(answer => answer !== null);
  }

  async generateMetadataURI(examId, score) {
    // Implement metadata generation and IPFS upload
    return `ipfs://example/${examId}/${score}`;
  }
}

module.exports = VerificationAgent;