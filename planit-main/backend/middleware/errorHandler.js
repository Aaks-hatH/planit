const mongoSanitize = require('express-mongo-sanitize');

// MongoDB sanitization middleware
const sanitizeData = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`Sanitized key: ${key} in request from ${req.ip}`);
  }
});

// Global error handler
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      error: 'Validation Error',
      details: errors
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      error: 'Duplicate Error',
      message: `A record with this ${field} already exists.`
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID',
      message: 'The provided ID is not valid.'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid Token',
      message: 'The authentication token is invalid.'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token Expired',
      message: 'The authentication token has expired.'
    });
  }

  // Multer errors (file upload)
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File Too Large',
        message: 'The uploaded file exceeds the size limit.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too Many Files',
        message: 'Too many files uploaded at once.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected File',
        message: 'An unexpected file field was encountered.'
      });
    }
  }

  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Origin not allowed.'
    });
  }

  // Cloudinary errors — the SDK sets http_code on the error object.
  // Without this case they fall through to the 500 default, and in production
  // the real message is hidden behind "An unexpected error occurred."
  // Now we surface a meaningful response and the correct HTTP status.
  if (err.http_code) {
    const status = err.http_code >= 400 && err.http_code < 600 ? err.http_code : 502;
    return res.status(status).json({
      error: 'Storage Error',
      // Cloudinary error messages are their API errors (invalid params, auth
      // failures, etc.) — not internal app state, so safe to expose in production.
      message: err.message || 'File storage service returned an error.'
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Server Error' : 'Error',
    message: process.env.NODE_ENV === 'production' 
      ? (statusCode === 500 ? 'An unexpected error occurred.' : message)
      : message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// 404 handler
const notFound = (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found.',
    path: req.originalUrl
  });
};

module.exports = { errorHandler, notFound, sanitizeData };
