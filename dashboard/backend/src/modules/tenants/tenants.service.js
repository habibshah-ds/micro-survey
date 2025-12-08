// ============================================
// FILE: backend/src/modules/tenants/tenants.service.js
// ============================================
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';

class TenantsService {
  async create(userId, { name, slug, email, microsurveyBaseUrl }) {
    const tenantSlug = slug || name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const existing = await db.query(
      'SELECT id FROM tenants WHERE slug = $1',
      [tenantSlug]
    );

    if (existing.rows.length > 0) {
      throw new ApiError('Tenant slug already exists', 409);
    }

    const result = await db.query(
      `INSERT INTO tenants (
        id, name, slug, email, owner_id, microsurvey_base_url, 
        is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
      RETURNING *`,
      [uuidv4(), name, tenantSlug, email, userId, microsurveyBaseUrl || null]
    );

    return result.rows[0];
  }

  async getAll(userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const countResult = await db.query(
      'SELECT COUNT(*) FROM tenants WHERE owner_id = $1',
      [userId]
    );

    const result = await db.query(
      `SELECT * FROM tenants 
       WHERE owner_id = $1 
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      tenants: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async getById(tenantId, userId) {
    const result = await db.query(
      'SELECT * FROM tenants WHERE id = $1 AND owner_id = $2',
      [tenantId, userId]
    );

    if (result.rows.length === 0) {
      throw new ApiError('Tenant not found', 404);
    }

    return result.rows[0];
  }

  async update(tenantId, userId, updates) {
    await this.getById(tenantId, userId);

    const result = await db.query(
      `UPDATE tenants 
       SET 
         name = COALESCE($1, name),
         email = COALESCE($2, email),
         microsurvey_base_url = COALESCE($3, microsurvey_base_url),
         is_active = COALESCE($4, is_active),
         updated_at = NOW()
       WHERE id = $5 AND owner_id = $6
       RETURNING *`,
      [updates.name, updates.email, updates.microsurveyBaseUrl, updates.isActive, tenantId, userId]
    );

    return result.rows[0];
  }

  async delete(tenantId, userId) {
    await this.getById(tenantId, userId);
    await db.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  }
}

export default new TenantsService();
