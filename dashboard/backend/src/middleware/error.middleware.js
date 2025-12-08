import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * Centralized error handling middleware
 * Catches all errors and sends standardized error responses
 */
export const errorMiddleware = (err, req, res, next) => {
  let error = err;

  // Convert non-ApiError errors to ApiError
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    error = new ApiError(statusCode, message, 'INTERNAL_ERROR', {}, false);
  }

  // Log error
  const logMessage = `${error.statusCode} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`;
  
  if (error.statusCode >= 500) {
    logger.error(logMessage, {
      error: error.message,
      stack: error.stack,
      code: error.code,
      details: error.details,
    });
  } else {
    logger.warn(logMessage, {
      error: error.message,
      code: error.code,
    });
  }

  // Send error response
  const response = {
    success: false,
    message: error.message,
    error: {
      code: error.code,
    },
  };

  // Include details in development mode
  if (config.nodeEnv === 'development') {
    response.error.details = error.details;
    response.error.stack = error.stack;
  } else if (Object.keys(error.details).length > 0) {
    // Include safe details in production
    response.error.details = error.details;
  }

  res.status(error.statusCode).json(response);
};

/**
 * Handle 404 errors for undefined routes
 */
export const notFoundMiddleware = (req, res, next) => {
  const error = ApiError.notFound(`Route ${req.originalUrl} not found`);
  next(error);
};
