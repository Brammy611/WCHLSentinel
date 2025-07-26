// Load environment variables first
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const mongoose = require('mongoose');

// Config and routes
const { config } = require('./config');
const userRoutes = require('./routes/userRoutes');
const examRoutes = require('./routes/examRoutes');

// Middleware & logger
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');

const app = express();

// Trust proxy (important for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS config
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || config.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cache-Control', 'Pragma'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Total-Pages']
};
app.use(cors(corsOptions));

// Rate limiter
const limiter = rateLimit({
  windowMs: config.rateLimiting.windowMs,
  max: config.rateLimiting.maxRequests,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.rateLimiting.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => req.path === '/api/health'
});
app.use('/api/', limiter);

// Logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: msg => logger.info(msg.trim()) }
  }));
}

// JSON parser
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch {
      res.status(400).json({ success: false, message: 'Invalid JSON' });
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    memory: process.memoryUsage(),
    version: process.version
  });
});

app.get('/api/health/db', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({
      status: 'OK',
      database: 'Connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      database: 'Disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/exams', examRoutes);

app.get('/api', (req, res) => {
  res.json({
    message: 'Exam System API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      users: '/api/users',
      exams: '/api/exams'
    }
  });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    startServer();
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

function startServer() {
  const PORT = config.port || 5000;
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🌐 CORS enabled for: ${config.allowedOrigins.join(', ')}`);
    console.log(`🔒 Security: Helmet enabled`);
    console.log(`⚡ Rate limiting: ${config.rateLimiting.maxRequests} requests per ${config.rateLimiting.windowMs / 1000}s`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('📊 HTTP server closed.');
      mongoose.connection.close();
    });
  });
}

module.exports = app;
