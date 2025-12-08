// ============================================
// FILE: backend/src/modules/auth/password.utils.js
// ============================================
import bcrypt from 'bcryptjs';
import { config } from '../../config/index.js';

const BCRYPT_COST = parseInt(process.env.BCRYPT_COST || '12', 10);

/**
 * Hash password with bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if match
 */
export async function comparePassword(password, hash) {
  if (!password || !hash) {
    return false;
  }
  
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validatePasswordStrength(password) {
  const errors = [];
  
  if (!password) {
    return { valid: false, errors: ['Password is required'] };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }
  
  // Optional: enforce complexity
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  if (!hasUppercase || !hasLowercase || !hasNumber) {
    errors.push('Password must contain uppercase, lowercase, and numbers');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
