// ============================================
// FILE: backend/src/modules/surveys/surveys.validators.js
// Validation schemas for survey operations
// ============================================
import Joi from 'joi';

const questionSchema = Joi.object({
  key: Joi.string().optional(),
  questionText: Joi.string().min(5).max(500).required(),
  questionType: Joi.string().valid('multiple_choice', 'text', 'rating', 'yes_no').required(),
  options: Joi.array().items(
    Joi.alternatives().try(
      Joi.string(),
      Joi.object({
        text: Joi.string().required(),
        imageUrl: Joi.string().uri().allow('').optional(),
      })
    )
  ).when('questionType', {
    is: 'multiple_choice',
    then: Joi.array().min(2).required(),
    otherwise: Joi.array().optional(),
  }),
  required: Joi.boolean().default(false),
  position: Joi.number().integer().min(0).optional(),
  validation: Joi.object().optional(),
  conditional: Joi.object().optional(),
});

export const createSurveySchema = Joi.object({
  tenantId: Joi.string().uuid().required(),
  organizationId: Joi.string().uuid().optional(),
  title: Joi.string().min(3).max(500).required(),
  description: Joi.string().max(2000).allow('').optional(),
  surveyType: Joi.string().valid('poll', 'quiz', 'feedback', 'nps').required(),
  questions: Joi.array().items(questionSchema).min(1).optional(),
  config: Joi.object({
    theme: Joi.string().valid('light', 'dark', 'auto').optional(),
    showProgressBar: Joi.boolean().optional(),
    allowBack: Joi.boolean().optional(),
    shuffleQuestions: Joi.boolean().optional(),
    requireAll: Joi.boolean().optional(),
  }).optional(),
});

export const updateSurveySchema = Joi.object({
  title: Joi.string().min(3).max(500).optional(),
  description: Joi.string().max(2000).allow('').optional(),
  questions: Joi.array().items(questionSchema).min(1).optional(),
  config: Joi.object({
    theme: Joi.string().valid('light', 'dark', 'auto').optional(),
    showProgressBar: Joi.boolean().optional(),
    allowBack: Joi.boolean().optional(),
    shuffleQuestions: Joi.boolean().optional(),
    requireAll: Joi.boolean().optional(),
  }).optional(),
});

export const reorderQuestionsSchema = Joi.object({
  questionIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

export const duplicateSurveySchema = Joi.object({
  newTitle: Joi.string().min(3).max(500).optional(),
  includeQuestions: Joi.boolean().default(true),
});

export const exportRequestSchema = Joi.object({
  format: Joi.string().valid('csv', 'json', 'xlsx').default('csv'),
  dateRange: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }).optional(),
  includeMetadata: Joi.boolean().default(true),
});
