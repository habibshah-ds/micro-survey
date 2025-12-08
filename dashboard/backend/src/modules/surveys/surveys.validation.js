// ============================================
// FILE: backend/src/modules/surveys/surveys.validation.js
// ============================================
import Joi from 'joi';

export const createSurveySchema = Joi.object({
  tenantId: Joi.string().uuid().required(),
  organizationId: Joi.string().uuid().optional(),
  title: Joi.string().min(3).max(500).required(),
  description: Joi.string().max(2000).optional(),
  surveyType: Joi.string().valid('poll', 'quiz', 'feedback', 'nps').required(),
  questions: Joi.array().items(Joi.object()).optional(),
});

export const updateSurveySchema = Joi.object({
  title: Joi.string().min(3).max(500).optional(),
  description: Joi.string().max(2000).optional(),
  questions: Joi.array().items(Joi.object()).optional(),
});
