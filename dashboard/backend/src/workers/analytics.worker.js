// ============================================
// FILE: backend/src/workers/analytics.worker.js
// Background worker for analytics aggregation
// Runs periodically to update cached analytics
// ============================================
import { Worker, Queue } from 'bullmq';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import db from '../config/db.js';
import analyticsService from '../modules/analytics/analytics.service.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

const queueName = `${config.queue.prefix}:analytics`;

// Create queue for analytics jobs
const analyticsQueue = new Queue(queueName, { connection });

/**
 * Enqueue analytics aggregation for a survey
 */
export async function enqueueAnalyticsAggregation(surveyId) {
  const job = await analyticsQueue.add(
    'aggregate-analytics',
    { surveyId },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep for 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      },
    }
  );

  logger.info('Analytics aggregation job enqueued', {
    jobId: job.id,
    surveyId,
  });

  return job.id;
}

/**
 * Enqueue aggregation for all active surveys
 */
export async function enqueueAllSurveys() {
  const result = await db.query(
    `SELECT id FROM surveys WHERE status = 'published'`
  );

  const surveys = result.rows;
  logger.info(`Enqueueing analytics for ${surveys.length} surveys`);

  for (const survey of surveys) {
    await enqueueAnalyticsAggregation(survey.id);
  }

  return surveys.length;
}

// Worker process
if (config.nodeEnv !== 'test') {
  const worker = new Worker(
    queueName,
    async (job) => {
      logger.info('Processing analytics aggregation job', {
        jobId: job.id,
        surveyId: job.data.surveyId,
      });

      const { surveyId } = job.data;

      try {
        // Update progress
        await job.updateProgress(10);

        // Fetch events and aggregate
        const events = await db.query(
          `SELECT 
            event_type,
            COUNT(*) as count,
            MAX(created_at) as last_event
          FROM survey_events
          WHERE survey_id = $1
          GROUP BY event_type`,
          [surveyId]
        );

        await job.updateProgress(30);

        // Get response count
        const responsesResult = await db.query(
          `SELECT COUNT(*) as count FROM survey_responses WHERE survey_id = $1`,
          [surveyId]
        );

        const views = events.rows.find(e => e.event_type === 'survey_view')?.count || 0;
        const starts = events.rows.find(e => e.event_type === 'survey_start')?.count || 0;
        const completions = parseInt(responsesResult.rows[0]?.count || 0);

        await job.updateProgress(60);

        // Aggregate question stats
        const questionStats = await aggregateQuestionStats(surveyId);

        await job.updateProgress(80);

        // Update cache
        const analyticsData = {
          surveyId,
          views: parseInt(views),
          starts: parseInt(starts),
          completions,
          completionRate: starts > 0 ? ((completions / starts) * 100).toFixed(2) : 0,
          questionStats,
          lastUpdated: new Date().toISOString(),
        };

        // Clear old cache and insert new
        await db.query(
          'DELETE FROM survey_analytics_cache WHERE survey_id = $1',
          [surveyId]
        );

        await db.query(
          `INSERT INTO survey_analytics_cache (
            id, survey_id, views, starts, completions, question_stats,
            analytics_data, cached_at, expires_at
          ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW() + INTERVAL '1 hour')`,
          [
            surveyId,
            analyticsData.views,
            analyticsData.starts,
            analyticsData.completions,
            JSON.stringify(analyticsData.questionStats),
            JSON.stringify(analyticsData),
          ]
        );

        await job.updateProgress(100);

        logger.info('Analytics aggregation completed', {
          jobId: job.id,
          surveyId,
          views: analyticsData.views,
          starts: analyticsData.starts,
          completions: analyticsData.completions,
        });

        return analyticsData;
      } catch (error) {
        logger.error('Analytics aggregation failed', {
          jobId: job.id,
          surveyId,
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }
    },
    {
      connection,
      concurrency: config.queue.concurrency,
    }
  );

  // Event handlers
  worker.on('completed', (job) => {
    logger.info('Analytics job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Analytics job failed', {
      jobId: job?.id,
      error: err.message,
      surveyId: job?.data?.surveyId,
    });
  });

  worker.on('error', (err) => {
    logger.error('Analytics worker error', { error: err.message });
  });

  logger.info('Analytics worker started', {
    queue: queueName,
    concurrency: config.queue.concurrency,
  });

  // Schedule periodic aggregation (every 10 minutes)
  setInterval(async () => {
    try {
      const count = await enqueueAllSurveys();
      logger.info(`Scheduled analytics aggregation for ${count} surveys`);
    } catch (error) {
      logger.error('Failed to schedule analytics', { error: error.message });
    }
  }, 10 * 60 * 1000); // 10 minutes

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing analytics worker...');
    await worker.close();
    process.exit(0);
  });
}

/**
 * Helper: Aggregate question-level statistics
 */
async function aggregateQuestionStats(surveyId) {
  const survey = await db.query(
    `SELECT ss.snapshot FROM surveys s
     LEFT JOIN survey_snapshots ss ON s.published_snapshot_id = ss.id
     WHERE s.id = $1`,
    [surveyId]
  );

  if (survey.rows.length === 0 || !survey.rows[0].snapshot) {
    return {};
  }

  const questions = survey.rows[0].snapshot.questions || [];
  const stats = {};

  for (const question of questions) {
    const responses = await db.query(
      `SELECT response_data FROM survey_responses 
       WHERE survey_id = $1`,
      [surveyId]
    );

    // Simple aggregation per question
    const questionResponses = responses.rows
      .map(r => r.response_data?.answers?.find(a => a.questionId === question.id))
      .filter(Boolean);

    stats[question.id] = {
      totalResponses: questionResponses.length,
      type: question.type,
    };

    // Type-specific aggregation
    if (question.type === 'multiple_choice') {
      const optionCounts = {};
      questionResponses.forEach(r => {
        const answer = r.answer;
        optionCounts[answer] = (optionCounts[answer] || 0) + 1;
      });
      stats[question.id].optionCounts = optionCounts;
    } else if (question.type === 'rating') {
      const ratings = questionResponses.map(r => r.answer).filter(a => typeof a === 'number');
      if (ratings.length > 0) {
        const sum = ratings.reduce((acc, val) => acc + val, 0);
        stats[question.id].average = (sum / ratings.length).toFixed(2);
      }
    }
  }

  return stats;
}

export { analyticsQueue };
export default worker;
