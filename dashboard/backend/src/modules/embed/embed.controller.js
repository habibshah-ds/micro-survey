// ============================================
// FILE: backend/src/modules/embed/embed.controller.js (FIXED)
// ============================================
import db from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * GET /api/embed/:surveyKey
 * Returns published survey data for embedding
 */
export const getPublishedSurvey = asyncHandler(async (req, res) => {
  const { surveyKey } = req.params;
  
  if (!surveyKey) {
    throw ApiError.badRequest('surveyKey parameter is required');
  }

  const result = await db.query(
    `SELECT 
      s.id, s.title, s.description, s.config, s.status, 
      s.created_at, s.updated_at,
      ss.snapshot
     FROM surveys s
     LEFT JOIN survey_snapshots ss ON s.published_snapshot_id = ss.id
     WHERE s.survey_key = $1 AND s.status = 'published'
     LIMIT 1`,
    [surveyKey]
  );

  if (result.rows.length === 0) {
    throw ApiError.notFound('Published survey not found');
  }

  const survey = result.rows[0];
  
  // Return survey with questions from snapshot
  res.json({
    success: true,
    data: {
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        config: survey.config,
        questions: survey.snapshot?.questions || [],
      },
    },
  });
});

export default {
  getPublishedSurvey,
};
