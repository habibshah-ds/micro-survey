// ============================================
// API Key Management Service
// ============================================
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/db.js';
import { config } from '../config/index.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../lib/logger.js';

class ApiKeyService {
  /**
   * Generate a secure API key
   */
  generateApiKey() {
    return `msk_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Hash API key with pepper
   */
  hashApiKey(key) {
    return crypto
      .createHmac('sha256', config.security.apiKeyPepper)
      .update(key)
      .digest('hex');
  }

  /**
   * Get key prefix for identification
   */
  getKeyPrefix(key) {
    return key.substring(0, 12); // "msk_" + 8 chars
  }

  /**
   * Create new API key for tenant
   */
  async createApiKey(tenantId, name, userId) {
    // Verify tenant exists
    const tenantCheck = await db.query(
      'SELECT id FROM tenants WHERE id = $1 AND is_active = true',
      [tenantId]
    );

    if (tenantCheck.rows.length === 0) {
      throw new ApiError('Tenant not found or inactive', 404);
    }

    // Generate key
    const apiKey = this.generateApiKey();
    const keyHash = this.hashApiKey(apiKey);
    const keyPrefix = this.getKeyPrefix(apiKey);

    // Store in database
    const result = await db.query(
      `INSERT INTO tenant_api_keys (
        id, tenant_id, name, key_hash, key_prefix, created_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, tenant_id, name, key_prefix, created_at`,
      [uuidv4(), tenantId, name, keyHash, keyPrefix, userId]
    );

    logger.info('API key created', {
      tenantId,
      keyPrefix,
      name,
      userId,
    });

    return {
      ...result.rows[0],
      key: apiKey, // Return raw key only once
    };
  }

  /**
   * List API keys for tenant (no raw keys)
   */
  async listApiKeys(tenantId) {
    const result = await db.query(
      `SELECT 
        id, tenant_id, name, key_prefix, last_used_at,
        revoked_at, created_at, created_by
      FROM tenant_api_keys
      WHERE tenant_id = $1
      ORDER BY created_at DESC`,
      [tenantId]
    );

    return result.rows.map(key => ({
      ...key,
      is_active: !key.revoked_at,
    }));
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(tenantId, keyId, userId) {
    const result = await db.query(
      `UPDATE tenant_api_keys
      SET revoked_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL
      RETURNING id, name, key_prefix`,
      [keyId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new ApiError('API key not found or already revoked', 404);
    }

    logger.info('API key revoked', {
      tenantId,
      keyId,
      keyPrefix: result.rows[0].key_prefix,
      userId,
    });

    return result.rows[0];
  }

  /**
   * Verify and get tenant from API key
   */
  async verifyApiKey(apiKey) {
    if (!apiKey || !apiKey.startsWith('msk_')) {
      throw new ApiError('Invalid API key format', 401);
    }

    const keyHash = this.hashApiKey(apiKey);
    const keyPrefix = this.getKeyPrefix(apiKey);

    const result = await db.query(
      `SELECT 
        k.id as key_id, 
        k.tenant_id, 
        k.name as key_name,
        t.name as tenant_name,
        t.slug as tenant_slug,
        t.is_active as tenant_active,
        k.revoked_at
      FROM tenant_api_keys k
      JOIN tenants t ON k.tenant_id = t.id
      WHERE k.key_hash = $1 AND k.key_prefix = $2`,
      [keyHash, keyPrefix]
    );

    if (result.rows.length === 0) {
      throw new ApiError('Invalid API key', 401);
    }

    const keyData = result.rows[0];

    if (keyData.revoked_at) {
      throw new ApiError('API key has been revoked', 401);
    }

    if (!keyData.tenant_active) {
      throw new ApiError('Tenant account is inactive', 403);
    }

    // Update last used timestamp (async, don't wait)
    db.query(
      'UPDATE tenant_api_keys SET last_used_at = NOW() WHERE id = $1',
      [keyData.key_id]
    ).catch(err => logger.error('Failed to update API key last_used_at', { error: err.message }));

    return {
      tenantId: keyData.tenant_id,
      tenantName: keyData.tenant_name,
      tenantSlug: keyData.tenant_slug,
      keyName: keyData.key_name,
    };
  }

  /**
   * Get API key statistics for tenant
   */
  async getApiKeyStats(tenantId) {
    const result = await db.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE revoked_at IS NULL) as active,
        COUNT(*) FILTER (WHERE revoked_at IS NOT NULL) as revoked,
        MAX(last_used_at) as last_activity
      FROM tenant_api_keys
      WHERE tenant_id = $1`,
      [tenantId]
    );

    return result.rows[0];
  }
}

export default new ApiKeyService();
