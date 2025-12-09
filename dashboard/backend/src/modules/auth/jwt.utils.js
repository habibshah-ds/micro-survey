// ============================================
// FILE: backend/src/modules/auth/jwt.utils.js
// ============================================
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';

/**
 * Generate access token (short-lived)
 */
export function generateAccessToken(payload) {
  const expiresIn = `${process.env.ACCESS_TOKEN_EXPIRES_MIN || 15}m`;
  
  return jwt.sign(
    {
      sub: payload.userId,
      email: payload.email,
      role: payload.role,
      jti: uuidv4(),
      type: 'access',
    },
    config.jwt.secret,
    {
      expiresIn,
      issuer: 'dashboard-api',
      audience: 'dashboard-client',
    }
  );
}

/**
 * Generate refresh token (long-lived, stored in DB)
 */
export function generateRefreshToken() {
  // Generate cryptographically secure random token
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash token for storage (SHA-256)
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify JWT token
 */
export function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: 'dashboard-api',
      audience: 'dashboard-client',
    });
    
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }
    
    return {
      userId: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Get token expiry date
 */
export function getTokenExpiry(days) {
  const expiryDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || days || 30, 10);
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + expiryDays);
  return expiry;
}
