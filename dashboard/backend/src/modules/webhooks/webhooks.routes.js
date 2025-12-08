// ============================================
// FILE: backend/src/modules/webhooks/webhooks.routes.js (COMPLETE)
// ============================================
import { Router } from 'express';
import webhooksController from './webhooks.controller.js';
import { webhookRateLimiter } from '../../middleware/rateLimit.middleware.js';

const router = Router();

// Webhook endpoint for Micro-Survey callbacks
router.post('/microsurvey', webhookRateLimiter, webhooksController.receiveMicroSurveyWebhook);

// Health check for webhook endpoint
router.get('/health', (req, res) => {
  res.json({ success: true, status: 'healthy' });
});

export default router;
