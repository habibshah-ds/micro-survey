// ============================================
// Integration Service - FIXED
// Batched DB inserts for performance (10-100x faster)
// ============================================
import { v4 as uuidv4 } from "uuid";
import db from "../../config/db.js";
import { ApiError } from "../../utils/ApiError.js";

const BATCH_SIZE = 100; // Insert in chunks of 100

export async function registerSite(userId, { siteName, siteUrl, organizationId }) {
  // Verify organization ownership
  const orgCheck = await db.query(
    "SELECT id FROM organizations WHERE id = $1 AND owner_id = $2",
    [organizationId, userId]
  );

  if (orgCheck.rows.length === 0) {
    throw new ApiError("Organization not found", 403);
  }

  // Generate site key and secret
  const siteKey = `sk_${uuidv4().replace(/-/g, "")}`;
  const siteSecret = `ss_${uuidv4().replace(/-/g, "")}`;

  // Store site registration
  const result = await db.query(
    `INSERT INTO captcha_sites (
      id, site_name, site_url, site_key, site_secret,
      organization_id, is_active, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
    RETURNING id, site_name, site_url, site_key, is_active, created_at`,
    [uuidv4(), siteName, siteUrl, siteKey, siteSecret, organizationId]
  );

  return {
    ...result.rows[0],
    siteSecret, // Only return once during registration
  };
}

export async function getSiteStats(siteKey) {
  const siteResult = await db.query(
    "SELECT id, organization_id FROM captcha_sites WHERE site_key = $1 AND is_active = true",
    [siteKey]
  );

  if (siteResult.rows.length === 0) {
    throw new ApiError("Invalid site key", 404);
  }

  const site = siteResult.rows[0];

  // Get questions for this organization
  const questionsResult = await db.query(
    "SELECT COUNT(*) as count FROM questions WHERE organization_id = $1 AND is_active = true",
    [site.organization_id]
  );

  // Get total responses for this site
  const responsesResult = await db.query(
    `SELECT COUNT(*) as count FROM question_responses qr
     JOIN questions q ON qr.question_id = q.id
     WHERE q.organization_id = $1`,
    [site.organization_id]
  );

  return {
    siteId: site.id,
    totalQuestions: parseInt(questionsResult.rows[0].count, 10),
    totalResponses: parseInt(responsesResult.rows[0].count, 10),
  };
}

// FIXED: Batched inserts instead of row-by-row
export async function pushResponses(siteKey, responses) {
  // Verify site key
  const siteResult = await db.query(
    "SELECT id, organization_id FROM captcha_sites WHERE site_key = $1 AND is_active = true",
    [siteKey]
  );

  if (siteResult.rows.length === 0) {
    throw new ApiError("Invalid site key", 401);
  }

  if (!responses || !Array.isArray(responses) || responses.length === 0) {
    return { inserted: 0, responseIds: [] };
  }

  // Process in chunks to avoid parameter limit
  const allIds = [];
  
  for (let i = 0; i < responses.length; i += BATCH_SIZE) {
    const chunk = responses.slice(i, i + BATCH_SIZE);
    
    // Build parameterized batch insert
    const values = [];
    const params = [];
    let paramIndex = 1;
    
    chunk.forEach(response => {
      values.push(
        `(gen_random_uuid(), $${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, NOW())`
      );
      params.push(
        response.questionId,
        response.responseText,
        response.responseData ? JSON.stringify(response.responseData) : null,
        response.sessionId,
        response.ipAddress,
        response.userAgent,
        response.countryCode
      );
      paramIndex += 7;
    });
    
    const query = `
      INSERT INTO question_responses (
        id, question_id, response_text, response_data,
        session_id, ip_address, user_agent, country_code, created_at
      )
      VALUES ${values.join(', ')}
      RETURNING id
    `;
    
    try {
      const result = await db.query(query, params);
      allIds.push(...result.rows.map(r => r.id));
    } catch (error) {
      console.error('[pushResponses] Batch insert error:', error.message);
      // Continue with next chunk even if one fails
    }
  }

  return {
    inserted: allIds.length,
    responseIds: allIds,
    batches: Math.ceil(responses.length / BATCH_SIZE),
  };
}

export async function getActiveQuestions(siteKey) {
  // Verify site key
  const siteResult = await db.query(
    "SELECT organization_id FROM captcha_sites WHERE site_key = $1 AND is_active = true",
    [siteKey]
  );

  if (siteResult.rows.length === 0) {
    throw new ApiError("Invalid site key", 401);
  }

  const site = siteResult.rows[0];

  // Get active questions for this organization
  const result = await db.query(
    `SELECT id, question_text, question_type, options
     FROM questions
     WHERE organization_id = $1 AND is_active = true
     ORDER BY created_at DESC`,
    [site.organization_id]
  );

  return result.rows.map(q => ({
    id: q.id,
    questionText: q.question_text,
    questionType: q.question_type,
    options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
  }));
}
