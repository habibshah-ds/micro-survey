// ============================================
// FILE: backend/src/modules/tenants/tenants.routes.js
// ============================================
import { Router } from 'express';
import tenantsController from './tenants.controller.js';
import { validate } from '../../middleware/validate.js';
import { authRequired } from '../../middleware/auth.js';
import { apiKeyRateLimiter } from '../../middleware/rateLimit.middleware.js';
import { createTenantSchema, updateTenantSchema, createApiKeySchema } from './tenants.validation.js';

const router = Router();

router.use(authRequired);

// Tenant CRUD
router.post('/', validate(createTenantSchema), tenantsController.createTenant);
router.get('/', tenantsController.getAllTenants);
router.get('/:id', tenantsController.getTenantById);
router.put('/:id', validate(updateTenantSchema), tenantsController.updateTenant);
router.delete('/:id', tenantsController.deleteTenant);

// API Key Management
router.post('/:tenantId/keys', apiKeyRateLimiter, validate(createApiKeySchema), tenantsController.createApiKey);
router.get('/:tenantId/keys', tenantsController.listApiKeys);
router.delete('/:tenantId/keys/:keyId', tenantsController.revokeApiKey);
router.get('/:tenantId/keys/stats', tenantsController.getApiKeyStats);

export default router;
