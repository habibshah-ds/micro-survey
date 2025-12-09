// ============================================
// FILE: backend/src/workers/responseQueue.js (COMPLETED)
// ============================================
import { Queue, Worker } from 'bullmq';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import integrationService from '../modules/integration/integration.service.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

const queueName = `${config.queue.prefix}:responses`;

// Create queue
const responseQueue = new Queue(queueName, { connection });

/**
 * Enqueue response processing job
 */
export async function enqueueResponseProcessing(data) {
  const job = await responseQueue.add('process-response', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 1000,
    },
  });

  logger.info('Response processing job enqueued', { jobId: job.id });
  return job.id;
}

// Worker process
if (config.nodeEnv !== 'test') {
  const worker = new Worker(
    queueName,
    async (job) => {
      logger.info('Processing response job', { jobId: job.id });

      const { siteKey, responses } = job.data;

      try {
        await integrationService.pushResponses(siteKey, responses);
        return { processed: responses.length };
      } catch (error) {
        logger.error('Response processing failed', {
          jobId: job.id,
          error: error.message,
        });
        throw error;
      }
    },
    {
      connection,
      concurrency: config.queue.concurrency,
    }
  );

  worker.on('completed', (job) => {
    logger.info('Response job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Response job failed', {
      jobId: job?.id,
      error: err.message,
    });
  });

  logger.info('Response worker started', { queue: queueName });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing response worker...');
    await worker.close();
    process.exit(0);
  });
}

export { responseQueue };
export default worker;
