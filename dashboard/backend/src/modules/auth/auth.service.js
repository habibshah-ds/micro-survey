// ============================================
// FILE: backend/src/modules/auth/auth.service.js (ENHANCED)
// Complete auth service using new token and email utilities
// ============================================
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { hashPassword, comparePassword } from './password.utils.js';
import { generateAccessToken, verifyAccessToken } from './jwt.utils.js';
import {
  generateSecureToken,
  hashToken,
  storeRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} from './tokens.utils.js';
import { sendPasswordReset, sendWelcome } from './email.utils.js';
import { logger } from '../../lib/logger.js';

/**
 * Register new user with organization
 */
export async function signup({ email, password, fullName }, req) {
  // Check existing user
  const existing = await db.query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  
  if (existing.rows.length > 0) {
    throw ApiError.conflict('Email already registered');
  }
  
  // Hash password
  const passwordHash = await hashPassword(password);
  
  // Create user and organization in transaction
  const result = await db.transaction(async (client) => {
    // Create user
    const userResult = await client.query(
      `INSERT INTO users (
        id, email, password_hash, full_name, role,
        is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
      RETURNING id, email, full_name, role, created_at`,
      [uuidv4(), email.toLowerCase(), passwordHash, fullName, 'user']
    );
    
    const user = userResult.rows[0];
    
    // Create default organization
    const orgSlug = `${fullName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${Date.now()}`;
    await client.query(
      `INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [uuidv4(), `${fullName}'s Organization`, orgSlug, user.id]
    );
    
    return user;
  });
  
  const user = result;
  
  // Generate tokens
  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  
  const refreshToken = generateSecureToken();
  await storeRefreshToken(user.id, refreshToken, req.ip);
  
  // Send welcome email (async, don't wait)
  sendWelcome(user.email, user.full_name).catch(err => {
    logger.error('Failed to send welcome email', { error: err.message });
  });
  
  logger.info('User registered', { userId: user.id, email: user.email });
  
  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
}

/**
 * Login existing user
 */
export async function login({ email, password }, req) {
  // Get user
  const result = await db.query(
    `SELECT id, email, password_hash, full_name, role, is_active
     FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );
  
  const user = result.rows[0];
  
  if (!user) {
    logger.warn('Login failed - user not found', { email });
    throw ApiError.unauthorized('Invalid email or password');
  }
  
  if (!user.is_active) {
    logger.warn('Login failed - account disabled', { userId: user.id });
    throw ApiError.forbidden('Account is disabled');
  }
  
  // Verify password
  const isValid = await comparePassword(password, user.password_hash);
  
  if (!isValid) {
    logger.warn('Login failed - invalid password', { userId: user.id });
    throw ApiError.unauthorized('Invalid email or password');
  }
  
  // Update last login
  await db.query(
    'UPDATE users SET last_login_at = NOW() WHERE id = $1',
    [user.id]
  );
  
  // Generate tokens
  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  
  const refreshToken = generateSecureToken();
  await storeRefreshToken(user.id, refreshToken, req.ip);
  
  logger.info('User logged in', { userId: user.id });
  
  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
}

/**
 * Refresh access token with token rotation
 */
export async function refreshAccessToken(refreshToken, req) {
  if (!refreshToken) {
    throw ApiError.unauthorized('Refresh token required');
  }
  
  // Verify token
  const tokenData = await verifyRefreshToken(refreshToken);
  
  if (!tokenData) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }
  
  // Get user
  const userResult = await db.query(
    'SELECT id, email, role, is_active FROM users WHERE id = $1',
    [tokenData.user_id]
  );
  
  if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
    throw ApiError.unauthorized('User not found or inactive');
  }
  
  const user = userResult.rows[0];
  
  // Rotate token (revoke old, create new)
  const newRefreshToken = await rotateRefreshToken(
    refreshToken,
    user.id,
    req.ip
  );
  
  // Generate new access token
  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  
  logger.info('Token refreshed', { userId: user.id });
  
  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Logout - revoke refresh token
 */
export async function logout(refreshToken, req) {
  if (!refreshToken) {
    return;
  }
  
  await revokeRefreshToken(refreshToken, req.ip);
  logger.info('User logged out');
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email, req) {
  // Get user (but don't reveal if email exists)
  const result = await db.query(
    'SELECT id, email, full_name FROM users WHERE email = $1 AND is_active = true',
    [email.toLowerCase()]
  );
  
  if (result.rows.length === 0) {
    // For security, always return success
    logger.warn('Password reset requested for non-existent email', { email });
    return { message: 'If email exists, reset link will be sent' };
  }
  
  const user = result.rows[0];
  
  // Generate reset token (6-hour expiry)
  const resetToken = generateSecureToken();
  const tokenHash = hashToken(resetToken);
  const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours
  
  // Store token
  await db.query(
    `INSERT INTO password_reset_tokens (
      id, user_id, token_hash, expires_at, created_at, created_by_ip
    ) VALUES ($1, $2, $3, $4, NOW(), $5)`,
    [uuidv4(), user.id, tokenHash, expiresAt, req.ip]
  );
  
  // Send email (async, don't block)
  sendPasswordReset(user.email, user.full_name, resetToken).catch(err => {
    logger.error('Failed to send password reset email', { 
      error: err.message,
      userId: user.id,
    });
  });
  
  logger.info('Password reset requested', { userId: user.id });
  
  return { message: 'If email exists, reset link will be sent' };
}

/**
 * Reset password with token
 */
export async function resetPassword(token, newPassword, req) {
  const tokenHash = hashToken(token);
  
  // Get reset token
  const result = await db.query(
    `SELECT id, user_id, expires_at, used_at
     FROM password_reset_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );
  
  if (result.rows.length === 0) {
    throw ApiError.badRequest('Invalid or expired reset token');
  }
  
  const resetData = result.rows[0];
  
  // Check if already used
  if (resetData.used_at) {
    throw ApiError.badRequest('Reset token already used');
  }
  
  // Check if expired
  if (new Date(resetData.expires_at) < new Date()) {
    throw ApiError.badRequest('Reset token expired');
  }
  
  // Hash new password
  const passwordHash = await hashPassword(newPassword);
  
  // Update password and revoke all refresh tokens
  await db.transaction(async (client) => {
    // Update password
    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, resetData.user_id]
    );
    
    // Mark reset token as used
    await client.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
      [resetData.id]
    );
  });
  
  // Revoke all refresh tokens (force re-login everywhere)
  await revokeAllUserTokens(resetData.user_id, 'password_reset');
  
  logger.info('Password reset completed', { userId: resetData.user_id });
  
  return { message: 'Password reset successful' };
}

/**
 * Get current user profile
 */
export async function getCurrentUser(userId) {
  const result = await db.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.is_email_verified, 
            u.created_at, u.last_login_at,
            COUNT(o.id) as organization_count
     FROM users u
     LEFT JOIN organizations o ON o.owner_id = u.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  );
  
  if (result.rows.length === 0) {
    throw ApiError.notFound('User not found');
  }
  
  const user = result.rows[0];
  
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    isEmailVerified: user.is_email_verified,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
    organizationCount: parseInt(user.organization_count, 10),
  };
}

/**
 * Change password (requires current password)
 */
export async function changePassword(userId, currentPassword, newPassword) {
  const result = await db.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    throw ApiError.notFound('User not found');
  }
  
  const user = result.rows[0];
  const isValid = await comparePassword(currentPassword, user.password_hash);
  
  if (!isValid) {
    throw ApiError.badRequest('Current password is incorrect');
  }
  
  const newPasswordHash = await hashPassword(newPassword);
  
  await db.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [newPasswordHash, userId]
  );
  
  // Revoke all refresh tokens (force re-login everywhere)
  await revokeAllUserTokens(userId, 'password_change');
  
  logger.info('Password changed', { userId });
  
  return { message: 'Password changed successfully' };
}
