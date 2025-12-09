import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/db.js';
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { ApiError } from '../../utils/ApiError.js';

class WebhooksService {
  verifySignature(payload, signature) {
    if (!config.features.enableWebhooks) return true;
    
    const secret = config.microSurvey.webhookSecret || config.microSurvey.apiKey;
    const computed = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
  }

  async process(payload, signature) {
    const verified = this.verifySignature(payload, signature);
    
    // Log webhook
    await db.query(
      `INSERT INTO webhook_logs (
        id, webhook_type, payload, signature, verified, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), payload.type, JSON.stringify(payload), signature, verified]
    );

    if (!verified) {
      throw new ApiError('Invalid webhook signature', 401);
    }

    // Process based on type
    switch (payload.type) {
      case 'export.completed':
        await this.handleExportCompleted(payload);
        break;
      case 'response.received':
        await this.handleResponseReceived(payload);
        break;
      default:
        logger.warn('Unknown webhook type', { type: payload.type });
    }

    return { processed: true };
  }

  async handleExportCompleted(payload) {
    const { surveyId, exportUrl } = payload.data;
    
    await db.query(
      `UPDATE export_jobs 
       SET status = 'completed', file_url = $1, completed_at = NOW()
       WHERE survey_id = (SELECT id FROM surveys WHERE microsurvey_id = $2)
       AND status = 'pending'`,
      [exportUrl, surveyId]
    );

    logger.info('Export completed', { surveyId, exportUrl });
  }

  async handleResponseReceived(payload) {
    // Invalidate analytics cache for this survey
    const { surveyId } = payload.data;
    
    await db.query(
      `DELETE FROM survey_analytics_cache
       WHERE survey_id = (SELECT id FROM surveys WHERE microsurvey_id = $1)`,
      [surveyId]
    );

    logger.info('Analytics cache invalidated', { surveyId });
  }
}

export default new WebhooksService();
