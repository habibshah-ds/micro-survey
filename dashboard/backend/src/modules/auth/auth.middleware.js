// ============================================
// FILE: backend/src/modules/auth/auth.middleware.js
// Enhanced JWT middleware with better error handling
// ============================================
import { verifyAccessToken } from './jwt.utils.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Middleware to protect routes requiring authentication
 */
export function authRequired(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw ApiError.unauthorized('No authorization header provided');
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Invalid authorization header format');
    }
    
    const token = authHeader.substring(7);
    
    if (!token) {
      throw ApiError.unauthorized('No token provided');
    }
    
    const decoded = verifyAccessToken(token);
    
    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
    
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }
    
    // JWT verification errors
    if (error.message === 'Token expired') {
      return next(ApiError.unauthorized('Token expired. Please refresh.'));
    }
    
    return next(ApiError.unauthorized('Invalid token'));
  }
}

/**
 * Middleware to check specific roles
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('Insufficient permissions'));
    }
    
    next();
  };
}

/**
 * Optional auth - attaches user if token present, but doesn't fail
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  
  try {
    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (error) {
    // Silently fail for optional auth
  }
  
  next();
}
