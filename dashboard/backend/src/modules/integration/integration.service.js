// ============================================
// FILE: backend/src/modules/integration/integration.service.js (FIXED)
// ============================================
import db from '../../config/db.js';
import crypto from 'crypto';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../lib/logger.js';

class IntegrationService {
  /**
   * Register a new CAPTCHA site
   */
  async registerSite(userId, data) {
    const { organizationId, siteName, siteUrl } = data;

    // Verify organization ownership
    const orgCheck = await db.query(
      'SELECT id FROM organizations WHERE id = $1 AND owner_id = $2',
      [organizationId, userId]
    );

    if (orgCheck.rows.length === 0) {
      throw ApiError.forbidden('Organization not found or access denied');
    }

    // Generate site keys
    const siteKey = `sk_${crypto.randomBytes(16).toString('hex')}`;
    const siteSecret = `ss_${crypto.randomBytes(32).toString('hex')}`;

    const result = await db.query(
      `INSERT INTO captcha_sites (
        id, site_name, site_url, site_key, site_secret, organization_id, created_at
      ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
      RETURNING *`,
      [siteName, siteUrl, siteKey, siteSecret, organizationId]
    );

    return result.rows[0];
  }

  /**
   * Get site statistics
   */
  async getSiteStats(siteKey) {
    const result = await db.query(
      `SELECT 
        cs.site_name,
        COUNT(qr.id) as total_responses,
        COUNT(DISTINCT qr.session_id) as unique_sessions
      FROM captcha_sites cs
      LEFT JOIN questions q ON q.organization_id = cs.organization_id
      LEFT JOIN question_responses qr ON qr.question_id = q.id
      WHERE cs.site_key = $1
      GROUP BY cs.id, cs.site_name`,
      [siteKey]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Site not found');
    }

    return result.rows[0];
  }

  /**
   * Push responses (batch insert)
   */
  async pushResponses(siteKey, responses) {
    if (!Array.isArray(responses) || responses.length === 0) {
      throw ApiError.badRequest('Responses array is required');
    }

    // Verify site exists
    const siteCheck = await db.query(
      'SELECT id, organization_id FROM captcha_sites WHERE site_key = $1',
      [siteKey]
    );

    if (siteCheck.rows.length === 0) {
      throw ApiError.notFound('Invalid site key');
    }

    // Build batched insert
    const values = [];
    const params = [];
    let paramIndex = 1;

    for (const response of responses) {
      if (!response.questionId) continue;

      values.push(
        `(gen_random_uuid(), $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, NOW())`
      );

      params.push(
        response.questionId,
        response.responseText || null,
        response.responseData ? JSON.stringify(response.responseData) : null,
        response.sessionId || null,
        response.ipAddress || null,
        response.userAgent || null,
        response.countryCode || null
      );
    }

    if (values.length === 0) {
      throw ApiError.badRequest('No valid responses to insert');
    }

    const insertSQL = `
      INSERT INTO question_responses
        (id, question_id, response_text, response_data, session_id, ip_address, user_agent, country_code, created_at)
      VALUES ${values.join(', ')}
    `;

    await db.query(insertSQL, params);

    logger.info('Batch responses inserted', {
      siteKey,
      count: values.length,
    });

    return { inserted: values.length };
  }

  /**
   * Get active questions for a site
   */
  async getActiveQuestions(siteKey) {
    const result = await db.query(
      `SELECT q.id, q.question_text, q.question_type, q.options
       FROM questions q
       JOIN captcha_sites cs ON q.organization_id = cs.organization_id
       WHERE cs.site_key = $1 AND q.is_active = true
       ORDER BY q.created_at DESC`,
      [siteKey]
    );

    return result.rows.map(q => ({
      ...q,
      options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
    }));
  }
}

const integrationService = new IntegrationService();

export default integrationService;

// Named exports for compatibility with modules importing specific functions
export const registerSite = integrationService.registerSite.bind(integrationService);
export const getSiteStats = integrationService.getSiteStats.bind(integrationService);
export const pushResponses = integrationService.pushResponses.bind(integrationService);
export const getActiveQuestions = integrationService.getActiveQuestions.bind(integrationService);
