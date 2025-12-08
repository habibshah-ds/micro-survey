// ============================================
// FILE: backend/src/modules/questions/questions.service.js (ENHANCED)
// Question management for surveys
// ============================================
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';

class QuestionsService {
  /**
   * Validate question data
   */
  validateQuestion(data) {
    const validTypes = ['multiple_choice', 'text', 'rating', 'yes_no'];
    
    if (!validTypes.includes(data.questionType)) {
      throw ApiError.badRequest(`Invalid question type. Must be one of: ${validTypes.join(', ')}`);
    }

    if (data.questionType === 'multiple_choice' && (!data.options || data.options.length < 2)) {
      throw ApiError.badRequest('Multiple choice questions must have at least 2 options');
    }

    return true;
  }

  /**
   * Create a question (with survey context)
   */
  async create(userId, data) {
    this.validateQuestion(data);

    const orgCheck = await db.query(
      'SELECT id FROM organizations WHERE id = $1 AND owner_id = $2',
      [data.organizationId, userId]
    );

    if (orgCheck.rows.length === 0) {
      throw ApiError.forbidden('Organization not found or access denied');
    }

    const result = await db.query(
      `INSERT INTO questions (
        id, survey_id, organization_id, key, type, label, meta,
        position, required, created_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [
        uuidv4(),
        data.surveyId || null,
        data.organizationId,
        data.key || `q_${Date.now()}`,
        data.questionType,
        data.questionText,
        JSON.stringify({
          options: data.options || [],
          validation: data.validation || {},
          conditional: data.conditional || null,
        }),
        data.position || 0,
        data.required !== false,
      ]
    );

    const question = result.rows[0];
    return this.formatQuestion(question);
  }

  /**
   * Bulk create questions for a survey
   */
  async bulkCreate(userId, organizationId, questions) {
    const orgCheck = await db.query(
      'SELECT id FROM organizations WHERE id = $1 AND owner_id = $2',
      [organizationId, userId]
    );

    if (orgCheck.rows.length === 0) {
      throw ApiError.forbidden('Organization not found or access denied');
    }

    const results = [];
    
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      this.validateQuestion(q);

      const result = await db.query(
        `INSERT INTO questions (
          id, organization_id, key, type, label, meta, position, required, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *`,
        [
          uuidv4(),
          organizationId,
          q.key || `q_${Date.now()}_${i}`,
          q.questionType,
          q.questionText,
          JSON.stringify({
            options: q.options || [],
            validation: q.validation || {},
            conditional: q.conditional || null,
          }),
          q.position !== undefined ? q.position : i,
          q.required !== false,
        ]
      );

      results.push(this.formatQuestion(result.rows[0]));
    }

    return results;
  }

  /**
   * Update question
   */
  async update(questionId, userId, updates) {
    await this.getById(questionId, userId);

    if (updates.questionType) {
      this.validateQuestion(updates);
    }

    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (updates.questionText) {
      setClauses.push(`label = $${paramIndex}`);
      params.push(updates.questionText);
      paramIndex++;
    }

    if (updates.questionType) {
      setClauses.push(`type = $${paramIndex}`);
      params.push(updates.questionType);
      paramIndex++;
    }

    if (updates.options !== undefined) {
      // Get existing meta and update options
      const existing = await db.query('SELECT meta FROM questions WHERE id = $1', [questionId]);
      const meta = existing.rows[0]?.meta || {};
      meta.options = updates.options;
      
      setClauses.push(`meta = $${paramIndex}`);
      params.push(JSON.stringify(meta));
      paramIndex++;
    }

    if (updates.position !== undefined) {
      setClauses.push(`position = $${paramIndex}`);
      params.push(updates.position);
      paramIndex++;
    }

    if (updates.required !== undefined) {
      setClauses.push(`required = $${paramIndex}`);
      params.push(updates.required);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      throw ApiError.badRequest('No valid fields to update');
    }

    params.push(questionId);

    const result = await db.query(
      `UPDATE questions 
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    return this.formatQuestion(result.rows[0]);
  }

  /**
   * Reorder questions
   */
  async reorder(userId, organizationId, questionIds) {
    // Verify ownership
    const orgCheck = await db.query(
      'SELECT id FROM organizations WHERE id = $1 AND owner_id = $2',
      [organizationId, userId]
    );

    if (orgCheck.rows.length === 0) {
      throw ApiError.forbidden('Organization not found or access denied');
    }

    // Update positions
    await db.transaction(async (client) => {
      for (let i = 0; i < questionIds.length; i++) {
        await client.query(
          'UPDATE questions SET position = $1 WHERE id = $2 AND organization_id = $3',
          [i, questionIds[i], organizationId]
        );
      }
    });

    return { message: 'Questions reordered successfully' };
  }

  /**
   * Get all questions for a survey
   */
  async getAll(userId, filters = {}, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE o.owner_id = $1';
    const params = [userId];
    let paramIndex = 2;

    if (filters.organizationId) {
      whereClause += ` AND q.organization_id = $${paramIndex}`;
      params.push(filters.organizationId);
      paramIndex++;
    }

    if (filters.surveyId) {
      whereClause += ` AND q.survey_id = $${paramIndex}`;
      params.push(filters.surveyId);
      paramIndex++;
    }

    if (filters.type) {
      whereClause += ` AND q.type = $${paramIndex}`;
      params.push(filters.type);
      paramIndex++;
    }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM questions q
       JOIN organizations o ON q.organization_id = o.id
       ${whereClause}`,
      params
    );

    params.push(limit, offset);

    const result = await db.query(
      `SELECT q.*, o.name as organization_name
       FROM questions q
       JOIN organizations o ON q.organization_id = o.id
       ${whereClause}
       ORDER BY q.position ASC, q.created_at ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return {
      questions: result.rows.map(q => this.formatQuestion(q)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Get question by ID
   */
  async getById(questionId, userId) {
    const result = await db.query(
      `SELECT q.*, o.name as organization_name
       FROM questions q
       JOIN organizations o ON q.organization_id = o.id
       WHERE q.id = $1 AND o.owner_id = $2`,
      [questionId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Question not found');
    }

    return this.formatQuestion(result.rows[0]);
  }

  /**
   * Delete question
   */
  async delete(questionId, userId) {
    await this.getById(questionId, userId);
    await db.query('DELETE FROM questions WHERE id = $1', [questionId]);
  }

  /**
   * Format question for API response
   */
  formatQuestion(row) {
    const meta = row.meta || {};
    return {
      id: row.id,
      surveyId: row.survey_id,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      key: row.key,
      questionText: row.label,
      questionType: row.type,
      options: meta.options || [],
      validation: meta.validation || {},
      conditional: meta.conditional || null,
      position: row.position,
      required: row.required,
      createdAt: row.created_at,
    };
  }
}

export default new QuestionsService();
