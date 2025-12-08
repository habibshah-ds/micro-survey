import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';

/**
 * Bcrypt utility functions for password hashing
 */

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export const hashPassword = async (password) => {
  return bcrypt.hash(password, config.bcrypt.saltRounds);
};

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};
