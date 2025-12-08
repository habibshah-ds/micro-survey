// ============================================
// organizations.validation.js
// ============================================
import Joi from 'joi';

export const createOrganizationSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).min(2).max(50).optional(),
});

export const updateOrganizationSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
});
