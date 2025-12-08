// ============================================
// FILE: backend/src/modules/tenants/tenants.validation.js
// ============================================
import Joi from 'joi';

export const createTenantSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).min(2).max(100).optional(),
  email: Joi.string().email().required(),
  microsurveyBaseUrl: Joi.string().uri().optional(),
});

export const updateTenantSchema = Joi.object({
  name: Joi.string().min(2).max(255).optional(),
  email: Joi.string().email().optional(),
  microsurveyBaseUrl: Joi.string().uri().allow(null).optional(),
  isActive: Joi.boolean().optional(),
});

export const createApiKeySchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
});
