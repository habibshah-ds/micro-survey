import { asyncHandler } from '../../utils/asyncHandler.js';
import webhooksService from './webhooks.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

class WebhooksController {
  receiveMicroSurveyWebhook = asyncHandler(async (req, res) => {
    const signature = req.headers['x-microsurvey-signature'];
    const result = await webhooksService.process(req.body, signature);
    ApiResponse.success(res, 200, 'Webhook processed', result);
  });
}

export default new WebhooksController();
