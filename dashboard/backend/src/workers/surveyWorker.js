// backend/src/workers/surveyWorker.js
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import microSurveyClient from '../services/microSurveyClient.js';

const connection = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  `${config.queue.prefix}:surveys`,
  async (job) => {
    logger.info('Processing survey job', { jobId: job.id, type: job.name });

    switch (job.name) {
      case 'sync-analytics':
        return await syncAnalytics(job.data);
      case 'export-survey':
        return await exportSurvey(job.data);
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  },
  {
    connection,
    concurrency: config.queue.concurrency,
  }
);

async function syncAnalytics({ surveyId, microsurveyId }) {
  const results = await microSurveyClient.getResults(microsurveyId);
  // Cache results...
  return { synced: true, responseCount: results.totalResponses };
}

async function exportSurvey({ surveyId, microsurveyId, format }) {
  const result = await microSurveyClient.requestExport(microsurveyId, { format });
  return { exportId: result.exportId };
}

worker.on('completed', (job) => {
  logger.info('Job completed', { jobId: job.id });
});

worker.on('failed', (job, err) => {
  logger.error('Job failed', { jobId: job?.id, error: err.message });
});

logger.info('Survey worker started');

export default worker;
