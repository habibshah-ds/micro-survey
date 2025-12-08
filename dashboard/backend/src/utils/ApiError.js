// ============================================
// Custom Error Class for API Errors
// Standardized error handling across the app
// ============================================

export class ApiError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) { 
    return new ApiError(message, 400, details); 
  }
  
  static unauthorized(message) { 
    return new ApiError(message, 401); 
  }
  
  static forbidden(message) { 
    return new ApiError(message, 403); 
  }
  
  static notFound(message) { 
    return new ApiError(message, 404); 
  }
  
  static conflict(message) { 
    return new ApiError(message, 409); 
  }
}
