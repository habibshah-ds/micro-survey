// ============================================
// FILE: backend/src/workers/imageWorker.js
// Async image processing with BullMQ
// ============================================
import { Worker, Queue } from 'bullmq';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import imageService from '../services/imageService.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

const queueName = config.queue.imageQueueName;

// Create queue for enqueueing jobs
const imageQueue = new Queue(queueName, { connection });

/**
 * Enqueue image processing job
 */
export async function enqueueImageProcessing(data) {
  const job = await imageQueue.add('process-image', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  });

  logger.info('Image processing job enqueued', {
    jobId: job.id,
    userId: data.userId,
  });

  return job.id;
}

/**
 * Worker process (run in separate process)
 */
if (config.image.async) {
  const worker = new Worker(
    queueName,
    async (job) => {
      logger.info('Processing image job', {
        jobId: job.id,
        userId: job.data.userId,
      });

      const { file, options, userId } = job.data;

      // Update progress
      await job.updateProgress(10);

      // Recreate file object from serialized data
      const fileObj = {
        buffer: Buffer.from(file.buffer),
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      };

      await job.updateProgress(25);

      // Process image
      const result = await imageService.upload(fileObj, options);

      await job.updateProgress(100);

      logger.info('Image processing completed', {
        jobId: job.id,
        userId,
        url: result.image_url,
      });

      return result;
    },
    {
      connection,
      concurrency: config.queue.concurrency,
    }
  );

  worker.on('completed', (job) => {
    logger.info('Image job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Image job failed', {
      jobId: job?.id,
      error: err.message,
      stack: err.stack,
    });
  });

  worker.on('error', (err) => {
    logger.error('Image worker error', { error: err.message });
  });

  logger.info('Image worker started', {
    queue: queueName,
    concurrency: config.queue.concurrency,
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing image worker...');
    await worker.close();
    process.exit(0);
  });
}

export { imageQueue };
