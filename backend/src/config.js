const mongoose = require('mongoose');
const crypto = require('crypto');

// Generate secure JWT secret if not provided
const generateSecureSecret = () => {
  return crypto.randomBytes(64).toString('hex');
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Remove deprecated options and fix the typo
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

  } catch (error) {
    console.error(`❌ Database connection failed: ${error.message}`);
    
    // Retry connection after 5 seconds
    setTimeout(() => {
      console.log('🔄 Retrying database connection...');
      connectDB();
    }, 5000);
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  try {
    await mongoose.connection.close();
    console.log('📊 Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

const config = {
  // Security Configuration
  jwtSecret: process.env.JWT_SECRET || generateSecureSecret(),
  jwtExpiration: '24h',
  
  // CORS Configuration
  allowedOrigins: process.env.FRONTEND_URLS 
    ? process.env.FRONTEND_URLS.split(',').map(url => url.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  
  // Rate Limiting
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },
  
  // AI Proctoring Configuration
  aiProctoring: {
    minConfidence: 0.8,
    checkInterval: 1000, // milliseconds
    maxWarnings: 3
  },
  
  // Blockchain Configuration
  blockchain: {
    network: process.env.BLOCKCHAIN_NETWORK || 'localhost',
    contractAddress: process.env.CONTRACT_ADDRESS,
    gasLimit: 3000000
  },
  
  // IPFS Configuration
  ipfs: {
    host: process.env.IPFS_HOST || 'ipfs.infura.io',
    port: parseInt(process.env.IPFS_PORT) || 5001,
    protocol: process.env.IPFS_PROTOCOL || 'https'
  },

  // Server Configuration
  port: parseInt(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development'
};

// Warn if using generated JWT secret
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not found in environment variables. Using generated secret.');
  console.warn('🔒 For production, set a secure JWT_SECRET in your .env file');
}

module.exports = {
  connectDB,
  config,
  gracefulShutdown
};