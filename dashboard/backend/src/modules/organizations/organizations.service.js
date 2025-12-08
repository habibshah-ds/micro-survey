import { v4 as uuidv4 } from 'uuid';
import db from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';

class OrganizationsService {
  async create(userId, { name, slug }) {
    const orgSlug = slug || name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const existing = await db.query(
      'SELECT id FROM organizations WHERE slug = $1',
      [orgSlug]
    );

    if (existing.rows.length > 0) {
      throw new ApiError('Organization slug already exists', 409);
    }

    const result = await db.query(
      `INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [uuidv4(), name, orgSlug, userId]
    );

    return result.rows[0];
  }

  async getAll(userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const countResult = await db.query(
      'SELECT COUNT(*) FROM organizations WHERE owner_id = $1',
      [userId]
    );

    const result = await db.query(
      `SELECT * FROM organizations 
       WHERE owner_id = $1 
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      organizations: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async getById(orgId, userId) {
    const result = await db.query(
      'SELECT * FROM organizations WHERE id = $1 AND owner_id = $2',
      [orgId, userId]
    );

    if (result.rows.length === 0) {
      throw new ApiError('Organization not found', 404);
    }

    return result.rows[0];
  }

  async update(orgId, userId, updates) {
    await this.getById(orgId, userId);

    const result = await db.query(
      `UPDATE organizations 
       SET name = COALESCE($1, name), updated_at = NOW()
       WHERE id = $2 AND owner_id = $3
       RETURNING *`,
      [updates.name, orgId, userId]
    );

    return result.rows[0];
  }

  async delete(orgId, userId) {
    await this.getById(orgId, userId);
    await db.query('DELETE FROM organizations WHERE id = $1', [orgId]);
  }
}

export default new OrganizationsService();
