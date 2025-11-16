// Elriel - A haunted terminal-based social network
// Main application entry point

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Import security middleware
const {
  generalLimiter,
  authLimiter,
  createLimiter,
  apiLimiter,
  helmetConfig,
  sanitizeInput
} = require('./middleware/security');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Apply security headers
app.use(helmetConfig);

// Apply general rate limiting
app.use(generalLimiter);

// Configure middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Apply input sanitization
app.use(sanitizeInput);
const publicPath = path.join(__dirname, 'public');
console.log('Serving static files from:', publicPath);
app.use(express.static(publicPath));

// Add CORS headers for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.url.startsWith('/css/') || req.url.startsWith('/js/') || req.url.match(/\.(css|js|png|jpg|ico)$/)) {
    console.log(`[STATIC ASSET] ${req.method} ${req.url}`);
  } else {
    console.log(`Request: ${req.method} ${req.url}`);
  }
  next();
});

// Configure session
app.use(session({
  secret: process.env.SESSION_SECRET || 'elriel_default_secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).redirect('/auth/login');
  }
  next();
};

// Configure file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Create uploads directory if it doesn't exist
if (!fs.existsSync('./public/uploads')) {
  fs.mkdirSync('./public/uploads', { recursive: true });
}

// Import routes - ALL using Supabase versions for production compatibility
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth_supabase');
const profileRoutes = require('./routes/profile'); // Already uses Supabase
const glyphRoutes = require('./routes/glyph_supabase');
const feedRoutes = require('./routes/feed_supabase');
const whisperRoutes = require('./routes/whisper_supabase');
const forumRoutes = require('./routes/forum_supabase');
const cryptoRoutes = require('./routes/crypto_supabase');
const apiRoutes = require('./routes/api_supabase');
const scrapyardRoutes = require('./routes/scrapyard_supabase');
const activityRoutes = require('./routes/activity_supabase');
const preferencesRoutes = require('./routes/preferences_supabase');
const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');
const usersRoutes = require('./routes/users');

// Use routes
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/glyph', glyphRoutes);
app.use('/feed', feedRoutes);
app.use('/whisper', whisperRoutes);
app.use('/forum', forumRoutes);
app.use('/crypto', cryptoRoutes);
app.use('/api', apiRoutes);
app.use('/scrapyard', scrapyardRoutes);
app.use('/activity', activityRoutes);
app.use('/preferences', preferencesRoutes);
app.use('/search', searchRoutes);
app.use('/admin', adminRoutes);
app.use('/users', usersRoutes);

// Alias route for /bleedstream/new (redirects to /feed/new for backward compatibility)
app.get('/bleedstream/new', isAuthenticated, (req, res) => {
  res.redirect('/feed/new');
});

// Health check endpoint for deployment monitoring
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  console.error('Error URL:', req.originalUrl);
  console.error('Error Method:', req.method);
  console.error('Error Headers:', JSON.stringify(req.headers, null, 2));
  res.status(500).sendFile(path.join(__dirname, 'views', 'error.html'));
});

// 404 handler - with ARG-style mysterious error page
app.use((req, res) => {
  console.warn('404 Not Found:', req.originalUrl);
  console.warn('Referrer:', req.get('Referrer') || 'None');
  console.warn('User Agent:', req.get('User-Agent') || 'None');
  res.status(404).sendFile(path.join(__dirname, 'views', '404.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Elriel network node activated on port ${PORT}`);
  console.log(`Terminal access: http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Using Supabase database: ${process.env.SUPABASE_URL}`);
});

module.exports = app;