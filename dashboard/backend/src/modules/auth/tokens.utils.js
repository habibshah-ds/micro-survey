// ============================================
// FILE: backend/src/modules/auth/tokens.utils.js
// Refresh token hashing and rotation utilities
// ============================================
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/db.js';
import { logger } from '../../lib/logger.js';

/**
 * Generate cryptographically secure refresh token
 * @returns {string} 64-character hex string
 */
export function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash token using SHA-256
 * @param {string} token - Plain token
 * @returns {string} Hashed token (hex)
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Get expiry date for refresh token
 * @param {number} days - Days until expiry (default from env)
 * @returns {Date} Expiry date
 */
export function getRefreshTokenExpiry(days = null) {
  const expiryDays = days || parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30', 10);
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + expiryDays);
  return expiry;
}

/**
 * Store refresh token in database
 * @param {string} userId - User ID
 * @param {string} token - Plain refresh token
 * @param {string} ip - Client IP address
 * @returns {Promise<{id: string, token: string}>}
 */
export async function storeRefreshToken(userId, token, ip) {
  const tokenHash = hashToken(token);
  const expiresAt = getRefreshTokenExpiry();
  const tokenId = uuidv4();

  await db.query(
    `INSERT INTO refresh_tokens (
      id, token, token_hash, user_id, expires_at, created_at, created_by_ip
    ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
    [tokenId, token, tokenHash, userId, expiresAt, ip]
  );

  logger.debug('Refresh token stored', { tokenId, userId, expiresAt });

  return { id: tokenId, token };
}

/**
 * Verify and retrieve refresh token from database
 * @param {string} token - Plain refresh token
 * @returns {Promise<object|null>} Token data or null if invalid
 */
export async function verifyRefreshToken(token) {
  const tokenHash = hashToken(token);

  const result = await db.query(
    `SELECT id, user_id, expires_at, revoked_at, revoked_by_ip, replaced_by_token
     FROM refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    logger.warn('Refresh token not found', { tokenHash: tokenHash.substring(0, 8) });
    return null;
  }

  const tokenData = result.rows[0];

  // Check if revoked
  if (tokenData.revoked_at) {
    logger.warn('Refresh token was revoked', {
      tokenId: tokenData.id,
      revokedAt: tokenData.revoked_at,
    });
    return null;
  }

  // Check if expired
  if (new Date(tokenData.expires_at) < new Date()) {
    logger.warn('Refresh token expired', {
      tokenId: tokenData.id,
      expiresAt: tokenData.expires_at,
    });
    return null;
  }

  return tokenData;
}

/**
 * Rotate refresh token (revoke old, create new)
 * Implements refresh token rotation for replay attack prevention
 * 
 * @param {string} oldToken - Current refresh token
 * @param {string} userId - User ID
 * @param {string} ip - Client IP address
 * @returns {Promise<string>} New refresh token
 */
export async function rotateRefreshToken(oldToken, userId, ip) {
  const oldTokenData = await verifyRefreshToken(oldToken);

  if (!oldTokenData) {
    throw new Error('Invalid or expired refresh token');
  }

  // Generate new token
  const newToken = generateSecureToken();
  const newTokenHash = hashToken(newToken);
  const newTokenId = uuidv4();
  const expiresAt = getRefreshTokenExpiry();

  // Atomic operation: revoke old, create new
  await db.transaction(async (client) => {
    // Revoke old token
    await client.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW(),
           revoked_by_ip = $1,
           replaced_by_token = $2
       WHERE id = $3`,
      [ip, newTokenId, oldTokenData.id]
    );

    // Create new token
    await client.query(
      `INSERT INTO refresh_tokens (
        id, token, token_hash, user_id, expires_at, created_at, created_by_ip
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
      [newTokenId, newToken, newTokenHash, userId, expiresAt, ip]
    );
  });

  logger.info('Refresh token rotated', {
    oldTokenId: oldTokenData.id,
    newTokenId,
    userId,
  });

  return newToken;
}

/**
 * Revoke refresh token
 * @param {string} token - Refresh token to revoke
 * @param {string} ip - Client IP address
 * @returns {Promise<boolean>} True if revoked
 */
export async function revokeRefreshToken(token, ip) {
  const tokenHash = hashToken(token);

  const result = await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW(), revoked_by_ip = $1
     WHERE token_hash = $2 AND revoked_at IS NULL
     RETURNING id`,
    [ip, tokenHash]
  );

  if (result.rows.length > 0) {
    logger.info('Refresh token revoked', { tokenId: result.rows[0].id });
    return true;
  }

  return false;
}

/**
 * Revoke all refresh tokens for a user
 * @param {string} userId - User ID
 * @param {string} reason - Reason for revocation
 * @returns {Promise<number>} Number of tokens revoked
 */
export async function revokeAllUserTokens(userId, reason = 'user_action') {
  const result = await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL
     RETURNING id`,
    [userId]
  );

  const count = result.rows.length;
  
  if (count > 0) {
    logger.info('All user tokens revoked', { userId, count, reason });
  }

  return count;
}

/**
 * Cleanup expired tokens (should run periodically)
 * @param {number} daysOld - Delete tokens older than this many days
 * @returns {Promise<number>} Number of tokens deleted
 */
export async function cleanupExpiredTokens(daysOld = 30) {
  const result = await db.query(
    `DELETE FROM refresh_tokens
     WHERE expires_at < NOW() - INTERVAL '1 day' * $1
     RETURNING id`,
    [daysOld]
  );

  const count = result.rows.length;
  
  if (count > 0) {
    logger.info('Expired tokens cleaned up', { count, daysOld });
  }

  return count;
}

/**
 * Get active token count for user (for monitoring/security)
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of active tokens
 */
export async function getUserActiveTokenCount(userId) {
  const result = await db.query(
    `SELECT COUNT(*) as count
     FROM refresh_tokens
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()`,
    [userId]
  );

  return parseInt(result.rows[0].count, 10);
}
