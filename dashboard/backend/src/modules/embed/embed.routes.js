// ============================================
// FILE: backend/src/modules/embed/embed.routes.js (NEW)
// ============================================
import { Router } from 'express';
import { getPublishedSurvey } from './embed.controller.js';

const router = Router();

// Public endpoint - no auth required
router.get('/:surveyKey', getPublishedSurvey);

export default router;
