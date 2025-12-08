// ============================================
// organizations.controller.js
// ============================================
import organizationsService from './organizations.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

class OrganizationsController {
  create = asyncHandler(async (req, res) => {
    const organization = await organizationsService.create(
      req.user.userId,
      req.body
    );

    ApiResponse.created(res, 'Organization created successfully', { organization });
  });

  getAll = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    
    const { organizations, total } = await organizationsService.getAll(
      req.user.userId,
      parseInt(page, 10),
      parseInt(limit, 10)
    );

    ApiResponse.paginated(
      res,
      organizations,
      page,
      limit,
      total,
      'Organizations retrieved successfully'
    );
  });

  getById = asyncHandler(async (req, res) => {
    const organization = await organizationsService.getById(
      req.params.id,
      req.user.userId
    );

    ApiResponse.success(res, 200, 'Organization retrieved successfully', {
      organization,
    });
  });

  update = asyncHandler(async (req, res) => {
    const organization = await organizationsService.update(
      req.params.id,
      req.user.userId,
      req.body
    );

    ApiResponse.success(res, 200, 'Organization updated successfully', {
      organization,
    });
  });

  delete = asyncHandler(async (req, res) => {
    await organizationsService.delete(req.params.id, req.user.userId);

    ApiResponse.success(res, 200, 'Organization deleted successfully');
  });
}

export default new OrganizationsController();
