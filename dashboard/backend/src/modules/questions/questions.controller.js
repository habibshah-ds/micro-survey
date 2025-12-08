// ============================================
// questions.controller.js
// ============================================
import questionsService from './questions.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

class QuestionsController {
  create = asyncHandler(async (req, res) => {
    const question = await questionsService.create(req.user.userId, req.body);
    ApiResponse.created(res, 'Question created successfully', { question });
  });

  getAll = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, organizationId, isActive } = req.query;
    
    const filters = {};
    if (organizationId) filters.organizationId = organizationId;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const { questions, total } = await questionsService.getAll(
      req.user.userId,
      filters,
      parseInt(page, 10),
      parseInt(limit, 10)
    );

    ApiResponse.paginated(
      res,
      questions,
      page,
      limit,
      total,
      'Questions retrieved successfully'
    );
  });

  getById = asyncHandler(async (req, res) => {
    const question = await questionsService.getById(
      req.params.id,
      req.user.userId
    );
    ApiResponse.success(res, 200, 'Question retrieved successfully', { question });
  });

  update = asyncHandler(async (req, res) => {
    const question = await questionsService.update(
      req.params.id,
      req.user.userId,
      req.body
    );
    ApiResponse.success(res, 200, 'Question updated successfully', { question });
  });

  delete = asyncHandler(async (req, res) => {
    await questionsService.delete(req.params.id, req.user.userId);
    ApiResponse.success(res, 200, 'Question deleted successfully');
  });
}

export default new QuestionsController();
