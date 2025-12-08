// ============================================
// FILE: backend/src/modules/surveys/surveys.routes.js (ENHANCED)
// Complete survey management routes
// ============================================
import { Router } from 'express';
import surveysController from './surveys.controller.js';
import { validate } from '../../middleware/validate.js';
import { authRequired } from '../../middleware/auth.js';
import {
  createSurveySchema,
  updateSurveySchema,
  reorderQuestionsSchema,
  duplicateSurveySchema,
  exportRequestSchema,
} from './surveys.validators.js';

const router = Router();

// All routes require authentication
router.use(authRequired);

// Basic CRUD
router.post('/', validate(createSurveySchema), surveysController.createSurvey);
router.get('/', surveysController.getAllSurveys);
router.get('/:id', surveysController.getSurveyById);
router.put('/:id', validate(updateSurveySchema), surveysController.updateSurvey);
router.delete('/:id', surveysController.deleteSurvey);

// Publish/Unpublish
router.post('/:id/publish', surveysController.publishSurvey);
router.post('/:id/unpublish', surveysController.unpublishSurvey);

// Duplicate
router.post('/:id/duplicate', validate(duplicateSurveySchema), surveysController.duplicateSurvey);

// Preview
router.get('/:id/preview', surveysController.getSurveyPreview);

// Results & Analytics
router.get('/:id/results', surveysController.getSurveyResults);

// Export
router.post('/:id/export', validate(exportRequestSchema), surveysController.requestExport);

// Embed code
router.get('/:id/embed', surveysController.getEmbedCode);

// Snapshot history
router.get('/:id/snapshots', surveysController.getSnapshotHistory);
router.get('/:id/snapshots/:snapshotId', surveysController.getSnapshot);

export default router;
