// ============================================
// FILE: backend/src/modules/analytics/analytics.routes.js (COMPLETE)
// All analytics routes with rate limiting
// ============================================
import { Router } from 'express';
import analyticsController from './analytics.controller.js';
import { authRequired } from '../../middleware/auth.js';
import { rateLimitMiddleware } from '../../middleware/rateLimit.middleware.js';

const router = Router();

// Public endpoint for tracking events (with rate limit)
router.post('/event', rateLimitMiddleware, analyticsController.trackEvent);

// Protected endpoints (require authentication)
router.use(authRequired);

// Survey summary analytics
router.get('/surveys/:id/summary', analyticsController.getSurveySummary);

// Question-level analytics
router.get('/surveys/:id/questions', analyticsController.getQuestionAnalytics);

// Chart data for visualizations
router.get('/surveys/:id/overview-chart', analyticsController.getOverviewChart);

// Export analytics data
router.get('/surveys/:id/export', analyticsController.exportAnalytics);

// Cache management
router.delete('/surveys/:id/cache', analyticsController.invalidateCache);

export default router;
