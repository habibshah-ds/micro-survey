// ============================================
// FILE: backend/src/modules/surveys/snapshots.service.js
// Handles survey snapshot creation and retrieval
// ============================================
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../lib/logger.js';

class SnapshotsService {
  /**
   * Create a snapshot of the current survey state
   */
  async createSnapshot(surveyId, userId) {
    try {
      // Get full survey with questions
      const surveyResult = await db.query(
        `SELECT s.*, t.name as tenant_name
         FROM surveys s
         JOIN tenants t ON s.tenant_id = t.id
         WHERE s.id = $1`,
        [surveyId]
      );

      if (surveyResult.rows.length === 0) {
        throw ApiError.notFound('Survey not found');
      }

      const survey = surveyResult.rows[0];

      // Get all questions for this survey's organization
      const questionsResult = await db.query(
        `SELECT id, question_text, question_type, options, required, position
         FROM questions
         WHERE organization_id = $1 AND is_active = true
         ORDER BY position ASC, created_at ASC`,
        [survey.organization_id]
      );

      // Build snapshot data
      const snapshotData = {
        surveyId: survey.id,
        title: survey.title,
        description: survey.description,
        surveyType: survey.survey_type,
        config: survey.config,
        questions: questionsResult.rows.map(q => ({
          id: q.id,
          text: q.question_text,
          type: q.question_type,
          options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
          required: q.required || false,
          position: q.position,
        })),
        snapshotVersion: '1.0',
        createdAt: new Date().toISOString(),
      };

      // Store snapshot
      const result = await db.query(
        `INSERT INTO survey_snapshots (
          id, survey_id, snapshot, created_at, created_by
        ) VALUES ($1, $2, $3, NOW(), $4)
        RETURNING id, created_at`,
        [uuidv4(), surveyId, JSON.stringify(snapshotData), userId]
      );

      logger.info('Survey snapshot created', {
        surveyId,
        snapshotId: result.rows[0].id,
        questionsCount: snapshotData.questions.length,
      });

      return {
        id: result.rows[0].id,
        surveyId,
        snapshot: snapshotData,
        createdAt: result.rows[0].created_at,
      };
    } catch (error) {
      logger.error('Failed to create snapshot', {
        error: error.message,
        surveyId,
      });
      throw error;
    }
  }

  /**
   * Get the latest snapshot for a survey
   */
  async getLatestSnapshot(surveyId) {
    const result = await db.query(
      `SELECT id, survey_id, snapshot, created_at, created_by
       FROM survey_snapshots
       WHERE survey_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [surveyId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      surveyId: row.survey_id,
      snapshot: row.snapshot,
      createdAt: row.created_at,
      createdBy: row.created_by,
    };
  }

  /**
   * Get a specific snapshot by ID
   */
  async getSnapshotById(snapshotId) {
    const result = await db.query(
      `SELECT id, survey_id, snapshot, created_at, created_by
       FROM survey_snapshots
       WHERE id = $1`,
      [snapshotId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Snapshot not found');
    }

    const row = result.rows[0];
    return {
      id: row.id,
      surveyId: row.survey_id,
      snapshot: row.snapshot,
      createdAt: row.created_at,
      createdBy: row.created_by,
    };
  }

  /**
   * Get all snapshots for a survey (history)
   */
  async getSnapshotHistory(surveyId, limit = 10) {
    const result = await db.query(
      `SELECT id, survey_id, created_at, created_by
       FROM survey_snapshots
       WHERE survey_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [surveyId, limit]
    );

    return result.rows;
  }

  /**
   * Delete old snapshots (keep only N most recent)
   */
  async cleanupOldSnapshots(surveyId, keepCount = 5) {
    await db.query(
      `DELETE FROM survey_snapshots
       WHERE survey_id = $1
       AND id NOT IN (
         SELECT id FROM survey_snapshots
         WHERE survey_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       )`,
      [surveyId, keepCount]
    );

    logger.info('Cleaned up old snapshots', { surveyId, keepCount });
  }
}

export default new SnapshotsService();
