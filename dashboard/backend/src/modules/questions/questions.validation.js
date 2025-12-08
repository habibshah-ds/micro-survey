// ============================================
// questions.validation.js
// ============================================
import Joi from 'joi';

export const createQuestionSchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  questionText: Joi.string().min(5).max(500).required(),
  questionType: Joi.string().valid('multiple_choice', 'text', 'rating').required(),
  options: Joi.array().items(Joi.string()).optional(),
  isActive: Joi.boolean().optional(),
});

export const updateQuestionSchema = Joi.object({
  questionText: Joi.string().min(5).max(500).optional(),
  questionType: Joi.string().valid('multiple_choice', 'text', 'rating').optional(),
  options: Joi.array().items(Joi.string()).optional(),
  isActive: Joi.boolean().optional(),
});
