// Elriel - Security Middleware
// Handles rate limiting, CSRF protection, and security headers

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// General rate limiter for all requests
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Terminal overload. Please wait before trying again.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    error: 'Too many authentication attempts',
    message: 'Access denied. Terminal locked. Try again later.'
  },
  skipSuccessfulRequests: true
});

// Rate limiter for content creation
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 posts/comments/whispers per hour
  message: {
    error: 'Too many posts',
    message: 'Signal flood detected. Slow down your transmissions.'
  }
});

// Rate limiter for API endpoints
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 API requests per minute
  message: {
    error: 'Too many API requests',
    message: 'API rate limit exceeded. Please wait.'
  }
});

// Configure helmet for security headers
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for terminal themes
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts (needed for data injection)
      imgSrc: ["'self'", "data:", "https:", "blob:"], // Allow images from CDNs and data URIs
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "wss:", "https:"], // Allow WebSocket connections
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false, // Disable for better compatibility
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Sanitize common injection patterns in request body
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Remove potential script tags and SQL injection patterns
        req.body[key] = req.body[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=\s*["'][^"']*["']/gi, ''); // Remove inline event handlers
      }
    }
  }
  next();
};

// CSRF token validation (simple implementation)
const csrfProtection = (req, res, next) => {
  // Skip for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip for API endpoints (they should use token-based auth)
  if (req.path.startsWith('/api/')) {
    return next();
  }

  // In production, you'd want to implement proper CSRF tokens
  // For now, just check for session
  if (!req.session) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid session'
    });
  }

  next();
};

module.exports = {
  generalLimiter,
  authLimiter,
  createLimiter,
  apiLimiter,
  helmetConfig,
  sanitizeInput,
  csrfProtection
};
