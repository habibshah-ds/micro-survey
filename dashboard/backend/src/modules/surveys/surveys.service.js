// ============================================
// FILE: backend/src/modules/surveys/surveys.service.js (ENHANCED)
// Add publish, unpublish, duplicate methods
// ============================================
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import microSurveyClient from '../../services/microSurveyClient.js';
import questionsService from '../questions/questions.service.js';
import { logger } from '../../lib/logger.js';
import { config } from '../../config/index.js';

class SurveysService {
  async create(userId, { tenantId, organizationId, title, description, surveyType, questions }) {
    // Verify tenant access
    const tenantCheck = await db.query(
      'SELECT id, microsurvey_base_url FROM tenants WHERE id = $1 AND owner_id = $2',
      [tenantId, userId]
    );

    if (tenantCheck.rows.length === 0) {
      throw ApiError.forbidden('Tenant not found or access denied');
    }

    const tenant = tenantCheck.rows[0];

    try {
      // Create survey in Micro-Survey
      const microSurveyData = {
        title,
        description,
        type: surveyType,
        questions: questions || [],
      };

      const microSurveyResponse = await microSurveyClient.createSurvey(
        microSurveyData,
        config.microSurvey.apiKey
      );

      // Generate unique survey key
      const surveyKey = `survey_${Date.now()}_${uuidv4().substring(0, 8)}`;

      // Store in dashboard database
      const result = await db.query(
        `INSERT INTO surveys (
          id, tenant_id, organization_id, microsurvey_id, survey_key,
          title, description, survey_type, status, config, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, NOW(), NOW())
        RETURNING *`,
        [
          uuidv4(),
          tenantId,
          organizationId || null,
          microSurveyResponse.id || microSurveyResponse.surveyId,
          surveyKey,
          title,
          description,
          surveyType,
          JSON.stringify(microSurveyResponse),
        ]
      );

      // Create questions if provided
      if (questions && questions.length > 0 && organizationId) {
        await questionsService.bulkCreate(userId, organizationId, 
          questions.map((q, idx) => ({
            ...q,
            surveyId: result.rows[0].id,
            position: q.position !== undefined ? q.position : idx,
          }))
        );
      }

      logger.info('Survey created', {
        surveyId: result.rows[0].id,
        microsurveyId: result.rows[0].microsurvey_id,
        tenantId,
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create survey in Micro-Survey', {
        error: error.message,
        tenantId,
      });
      throw new ApiError(`Failed to create survey: ${error.message}`, 500);
    }
  }

  async getAll(userId, filters = {}, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE t.owner_id = $1';
    const params = [userId];
    let paramIndex = 2;

    if (filters.tenantId) {
      whereClause += ` AND s.tenant_id = $${paramIndex}`;
      params.push(filters.tenantId);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND s.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.search) {
      whereClause += ` AND (s.title ILIKE $${paramIndex} OR s.description ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM surveys s
       JOIN tenants t ON s.tenant_id = t.id
       ${whereClause}`,
      params
    );

    params.push(limit, offset);

    const result = await db.query(
      `SELECT s.*, t.name as tenant_name, o.name as organization_name,
        (SELECT COUNT(*) FROM questions WHERE survey_id = s.id) as question_count,
        (SELECT COUNT(*) FROM survey_responses WHERE survey_id = s.id) as response_count
       FROM surveys s
       JOIN tenants t ON s.tenant_id = t.id
       LEFT JOIN organizations o ON s.organization_id = o.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return {
      surveys: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async getById(surveyId, userId) {
    const result = await db.query(
      `SELECT s.*, t.name as tenant_name, o.name as organization_name,
        (SELECT COUNT(*) FROM questions WHERE survey_id = s.id) as question_count,
        (SELECT COUNT(*) FROM survey_responses WHERE survey_id = s.id) as response_count
       FROM surveys s
       JOIN tenants t ON s.tenant_id = t.id
       LEFT JOIN organizations o ON s.organization_id = o.id
       WHERE s.id = $1 AND t.owner_id = $2`,
      [surveyId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Survey not found');
    }

    return result.rows[0];
  }

  async update(surveyId, userId, updates) {
    const survey = await this.getById(surveyId, userId);

    // Don't allow updates to published surveys
    if (survey.status === 'published' && !updates.allowPublishedUpdate) {
      throw ApiError.badRequest('Cannot update published survey. Unpublish first or create a new version.');
    }

    // Update in Micro-Survey if needed
    if (updates.title || updates.description || updates.questions) {
      try {
        await microSurveyClient.updateSurvey(survey.microsurvey_id, updates);
      } catch (error) {
        logger.error('Failed to update survey in Micro-Survey', {
          error: error.message,
          surveyId,
        });
      }
    }

    // Update in dashboard
    const result = await db.query(
      `UPDATE surveys 
       SET 
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         config = COALESCE($3, config),
         updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [updates.title, updates.description, updates.config ? JSON.stringify(updates.config) : null, surveyId]
    );

    return result.rows[0];
  }

  async delete(surveyId, userId) {
    await this.getById(surveyId, userId);
    
    // Soft delete - set status to archived
    await db.query(
      `UPDATE surveys SET status = 'archived', archived_at = NOW() WHERE id = $1`,
      [surveyId]
    );
  }

  /**
   * Publish survey - create snapshot and update status
   */
  async publish(surveyId, userId, snapshotId) {
    const survey = await this.getById(surveyId, userId);

    if (survey.status === 'published') {
      throw ApiError.badRequest('Survey is already published');
    }

    try {
      // Update Micro-Survey status
      await microSurveyClient.updateSurvey(survey.microsurvey_id, {
        status: 'published',
      });

      // Update survey in dashboard
      const result = await db.query(
        `UPDATE surveys 
         SET status = 'published', 
             published_snapshot_id = $1,
             published_at = NOW(),
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [snapshotId, surveyId]
      );

      logger.info('Survey published', { surveyId, snapshotId });

      return result.rows[0];
    } catch (error) {
      throw ApiError.internal(`Failed to publish survey: ${error.message}`);
    }
  }

  /**
   * Unpublish survey - revert to draft
   */
  async unpublish(surveyId, userId) {
    const survey = await this.getById(surveyId, userId);

    if (survey.status !== 'published') {
      throw ApiError.badRequest('Survey is not published');
    }

    try {
      // Update Micro-Survey status
      await microSurveyClient.updateSurvey(survey.microsurvey_id, {
        status: 'draft',
      });

      // Update survey in dashboard
      const result = await db.query(
        `UPDATE surveys 
         SET status = 'draft',
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [surveyId]
      );

      logger.info('Survey unpublished', { surveyId });

      return result.rows[0];
    } catch (error) {
      throw ApiError.internal(`Failed to unpublish survey: ${error.message}`);
    }
  }

  /**
   * Duplicate survey
   */
  async duplicate(surveyId, userId, options = {}) {
    const original = await this.getById(surveyId, userId);
    const { newTitle, includeQuestions = true } = options;

    const title = newTitle || `Copy of ${original.title}`;

    // Create new survey
    const newSurveyData = {
      tenantId: original.tenant_id,
      organizationId: original.organization_id,
      title,
      description: original.description,
      surveyType: original.survey_type,
      questions: [],
    };

    // Get questions if including them
    if (includeQuestions && original.organization_id) {
      const questionsResult = await db.query(
        `SELECT * FROM questions WHERE survey_id = $1 ORDER BY position ASC`,
        [surveyId]
      );

      newSurveyData.questions = questionsResult.rows.map(q => ({
        questionText: q.label,
        questionType: q.type,
        options: q.meta?.options || [],
        required: q.required,
        position: q.position,
      }));
    }

    const duplicated = await this.create(userId, newSurveyData);

    logger.info('Survey duplicated', {
      originalId: surveyId,
      duplicatedId: duplicated.id,
      includeQuestions,
    });

    return duplicated;
  }

  /**
   * Get survey preview data
   */
  async getPreview(surveyId, userId) {
    const survey = await this.getById(surveyId, userId);

    // Get questions
    const questionsResult = await db.query(
      `SELECT * FROM questions WHERE survey_id = $1 ORDER BY position ASC`,
      [surveyId]
    );

    return {
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        type: survey.survey_type,
        config: survey.config,
      },
      questions: questionsResult.rows.map(q => ({
        id: q.id,
        key: q.key,
        text: q.label,
        type: q.type,
        options: q.meta?.options || [],
        required: q.required,
        position: q.position,
      })),
    };
  }

  async getResults(surveyId, userId, filters = {}) {
    const survey = await this.getById(surveyId, userId);

    // Check cache first
    const cacheResult = await db.query(
      `SELECT analytics_data FROM survey_analytics_cache
       WHERE survey_id = $1 AND expires_at > NOW()
       ORDER BY cached_at DESC LIMIT 1`,
      [surveyId]
    );

    if (cacheResult.rows.length > 0) {
      logger.debug('Returning cached analytics', { surveyId });
      return cacheResult.rows[0].analytics_data;
    }

    // Fetch from Micro-Survey
    try {
      const results = await microSurveyClient.getResults(survey.microsurvey_id, filters);

      // Cache for 5 minutes
      await db.query(
        `INSERT INTO survey_analytics_cache (
          id, survey_id, analytics_data, cached_at, expires_at
        )
        VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '5 minutes')`,
        [uuidv4(), surveyId, JSON.stringify(results)]
      );

      return results;
    } catch (error) {
      throw ApiError.internal(`Failed to fetch results: ${error.message}`);
    }
  }

  async requestExport(surveyId, userId, options) {
    const survey = await this.getById(surveyId, userId);

    try {
      const exportResponse = await microSurveyClient.requestExport(
        survey.microsurvey_id,
        options
      );

      // Create export job record
      const result = await db.query(
        `INSERT INTO export_jobs (
          id, survey_id, tenant_id, status, export_type,
          requested_by, created_at
        )
        VALUES ($1, $2, $3, 'pending', $4, $5, NOW())
        RETURNING *`,
        [uuidv4(), surveyId, survey.tenant_id, options.format || 'csv', userId]
      );

      return result.rows[0];
    } catch (error) {
      throw ApiError.internal(`Failed to request export: ${error.message}`);
    }
  }

  async getEmbedCode(surveyId, userId) {
    const survey = await this.getById(surveyId, userId);

    if (survey.status !== 'published') {
      throw ApiError.badRequest('Survey must be published to get embed code');
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const apiUrl = process.env.API_URL || 'http://localhost:5000';
    const surveyKey = survey.survey_key;

    return {
      iframe: `<iframe src="${baseUrl}/embed/${surveyKey}" width="100%" height="600" frameborder="0"></iframe>`,
      script: `<div id="microsurvey-${surveyKey}"></div>
<script src="${apiUrl}/embed/widget.js" data-survey-key="${surveyKey}"></script>`,
      link: `${baseUrl}/s/${surveyKey}`,
      surveyKey,
    };
  }
}

export default new SurveysService();
