// ============================================
// Error Handler Middleware - UNIFIED
// Centralized error processing and response
// ============================================
import { config } from "../config/index.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../lib/logger.js";

export function errorHandler(err, req, res, next) {
  // Convert non-ApiError to ApiError
  if (!(err instanceof ApiError)) {
    err = new ApiError(err.message || "Internal server error", err.statusCode || 500);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  // Log error
  const logMessage = `${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`;
  
  if (statusCode >= 500) {
    logger.error(logMessage, {
      error: message,
      stack: err.stack,
      details: err.details,
    });
  } else {
    logger.warn(logMessage, { error: message });
  }

  const response = {
    success: false,
    message,
  };

  if (config.nodeEnv === "development") {
    response.stack = err.stack;
    response.details = err.details;
  } else if (err.details && Object.keys(err.details).length > 0) {
    response.details = err.details;
  }

  res.status(statusCode).json(response);
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Export ApiError for backwards compatibility
export { ApiError } from "../utils/ApiError.js";
export const AppError = ApiError;
