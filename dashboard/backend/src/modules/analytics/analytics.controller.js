// ============================================
// FILE: backend/src/modules/analytics/analytics.controller.js (COMPLETE)
// All analytics endpoints with validation
// ============================================
import { asyncHandler } from '../../utils/asyncHandler.js';
import analyticsService from './analytics.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';

class AnalyticsController {
  /**
   * POST /api/analytics/event
   * Track analytics event
   */
  trackEvent = asyncHandler(async (req, res) => {
    const { event, survey_id, tenant_id, metadata } = req.body;

    if (!event || !survey_id || !tenant_id) {
      throw ApiError.badRequest('Missing required fields: event, survey_id, tenant_id');
    }

    const result = await analyticsService.trackEvent({
      event,
      survey_id,
      tenant_id,
      metadata: metadata || {},
    });

    ApiResponse.created(res, 'Event tracked', { eventId: result.id });
  });

  /**
   * GET /api/analytics/surveys/:id/summary
   * Get survey summary analytics
   */
  getSurveySummary = asyncHandler(async (req, res) => {
    const { id: surveyId } = req.params;
    const { forceRefresh } = req.query;

    const summary = await analyticsService.getSurveySummary(
      surveyId,
      req.user.userId,
      { forceRefresh: forceRefresh === 'true' }
    );

    ApiResponse.success(res, 200, 'Survey summary retrieved', { summary });
  });

  /**
   * GET /api/analytics/surveys/:id/questions
   * Get question-level analytics
   */
  getQuestionAnalytics = asyncHandler(async (req, res) => {
    const { id: surveyId } = req.params;

    const questions = await analyticsService.getQuestionAnalytics(
      surveyId,
      req.user.userId
    );

    ApiResponse.success(res, 200, 'Question analytics retrieved', questions);
  });

  /**
   * GET /api/analytics/surveys/:id/overview-chart
   * Get chart data for overview
   */
  getOverviewChart = asyncHandler(async (req, res) => {
    const { id: surveyId } = req.params;
    const { days, granularity } = req.query;

    const chartData = await analyticsService.getOverviewChart(
      surveyId,
      req.user.userId,
      {
        days: parseInt(days) || 30,
        granularity: granularity || 'day',
      }
    );

    ApiResponse.success(res, 200, 'Chart data retrieved', chartData);
  });

  /**
   * GET /api/analytics/surveys/:id/export
   * Export analytics data
   */
  exportAnalytics = asyncHandler(async (req, res) => {
    const { id: surveyId } = req.params;
    const { format = 'json' } = req.query;

    const data = await analyticsService.exportAnalytics(
      surveyId,
      req.user.userId,
      format
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="survey-${surveyId}-analytics.csv"`);
      res.send(data);
    } else {
      ApiResponse.success(res, 200, 'Analytics exported', data);
    }
  });

  /**
   * DELETE /api/analytics/surveys/:id/cache
   * Invalidate analytics cache
   */
  invalidateCache = asyncHandler(async (req, res) => {
    const { id: surveyId } = req.params;

    await analyticsService.verifySurveyAccess(surveyId, req.user.userId);
    await analyticsService.invalidateCache(surveyId);

    ApiResponse.success(res, 200, 'Cache invalidated');
  });
}

export default new AnalyticsController();
