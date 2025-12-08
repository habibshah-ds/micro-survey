// ============================================
// FILE: backend/src/modules/surveys/surveys.controller.js
// ============================================
import { asyncHandler } from '../../utils/asyncHandler.js';
import surveysService from './surveys.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

class SurveysController {
  createSurvey = asyncHandler(async (req, res) => {
    const survey = await surveysService.create(req.user.userId, req.body);
    ApiResponse.created(res, 'Survey created successfully', { survey });
  });

  getAllSurveys = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, tenantId, status } = req.query;
    const filters = { tenantId, status };
    
    const { surveys, total } = await surveysService.getAll(
      req.user.userId,
      filters,
      parseInt(page, 10),
      parseInt(limit, 10)
    );
    
    ApiResponse.paginated(res, surveys, page, limit, total, 'Surveys retrieved successfully');
  });

  getSurveyById = asyncHandler(async (req, res) => {
    const survey = await surveysService.getById(req.params.id, req.user.userId);
    ApiResponse.success(res, 200, 'Survey retrieved successfully', { survey });
  });

  updateSurvey = asyncHandler(async (req, res) => {
    const survey = await surveysService.update(req.params.id, req.user.userId, req.body);
    ApiResponse.success(res, 200, 'Survey updated successfully', { survey });
  });

  deleteSurvey = asyncHandler(async (req, res) => {
    await surveysService.delete(req.params.id, req.user.userId);
    ApiResponse.success(res, 200, 'Survey deleted successfully');
  });

  publishSurvey = asyncHandler(async (req, res) => {
    const survey = await surveysService.publish(req.params.id, req.user.userId);
    ApiResponse.success(res, 200, 'Survey published successfully', { survey });
  });

  unpublishSurvey = asyncHandler(async (req, res) => {
    const survey = await surveysService.unpublish(req.params.id, req.user.userId);
    ApiResponse.success(res, 200, 'Survey unpublished successfully', { survey });
  });

  getSurveyResults = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const results = await surveysService.getResults(
      req.params.id,
      req.user.userId,
      { startDate, endDate }
    );
    ApiResponse.success(res, 200, 'Survey results retrieved successfully', { results });
  });

  requestExport = asyncHandler(async (req, res) => {
    const exportJob = await surveysService.requestExport(req.params.id, req.user.userId, req.body);
    ApiResponse.created(res, 'Export requested successfully', { exportJob });
  });

  getEmbedCode = asyncHandler(async (req, res) => {
    const embedCode = await surveysService.getEmbedCode(req.params.id, req.user.userId);
    ApiResponse.success(res, 200, 'Embed code generated', { embedCode });
  });
}

export default new SurveysController();
