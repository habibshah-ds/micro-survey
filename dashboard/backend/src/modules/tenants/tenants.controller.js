// ============================================
// FILE: backend/src/modules/tenants/tenants.controller.js
// ============================================
import { asyncHandler } from '../../utils/asyncHandler.js';
import tenantsService from './tenants.service.js';
import apiKeyService from '../../services/apiKeyService.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

class TenantsController {
  createTenant = asyncHandler(async (req, res) => {
    const tenant = await tenantsService.create(req.user.userId, req.body);
    ApiResponse.created(res, 'Tenant created successfully', { tenant });
  });

  getAllTenants = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const { tenants, total } = await tenantsService.getAll(
      req.user.userId,
      parseInt(page, 10),
      parseInt(limit, 10)
    );
    ApiResponse.paginated(res, tenants, page, limit, total, 'Tenants retrieved successfully');
  });

  getTenantById = asyncHandler(async (req, res) => {
    const tenant = await tenantsService.getById(req.params.id, req.user.userId);
    ApiResponse.success(res, 200, 'Tenant retrieved successfully', { tenant });
  });

  updateTenant = asyncHandler(async (req, res) => {
    const tenant = await tenantsService.update(req.params.id, req.user.userId, req.body);
    ApiResponse.success(res, 200, 'Tenant updated successfully', { tenant });
  });

  deleteTenant = asyncHandler(async (req, res) => {
    await tenantsService.delete(req.params.id, req.user.userId);
    ApiResponse.success(res, 200, 'Tenant deleted successfully');
  });

  // API Key Management
  createApiKey = asyncHandler(async (req, res) => {
    const { name } = req.body;
    const apiKey = await apiKeyService.createApiKey(req.params.tenantId, name, req.user.userId);
    ApiResponse.created(res, 'API key created successfully', {
      apiKey,
      warning: 'Store this key securely. It will not be shown again.',
    });
  });

  listApiKeys = asyncHandler(async (req, res) => {
    const keys = await apiKeyService.listApiKeys(req.params.tenantId);
    ApiResponse.success(res, 200, 'API keys retrieved successfully', { keys });
  });

  revokeApiKey = asyncHandler(async (req, res) => {
    const result = await apiKeyService.revokeApiKey(
      req.params.tenantId,
      req.params.keyId,
      req.user.userId
    );
    ApiResponse.success(res, 200, 'API key revoked successfully', result);
  });

  getApiKeyStats = asyncHandler(async (req, res) => {
    const stats = await apiKeyService.getApiKeyStats(req.params.tenantId);
    ApiResponse.success(res, 200, 'API key statistics retrieved', { stats });
  });
}

export default new TenantsController();
