// ============================================
// FILE: backend/src/modules/analytics/analytics.service.js
// Complete analytics service with aggregation and caching
// ============================================
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import microSurveyClient from '../../services/microSurveyClient.js';
import { logger } from '../../lib/logger.js';

class AnalyticsService {
  /**
   * Track event (survey_view, survey_start, survey_submit)
   */
  async trackEvent(eventData) {
    const { event, survey_id, tenant_id, metadata } = eventData;
    
    // Validate event type
    const validEvents = ['survey_view', 'survey_start', 'survey_submit'];
    if (!validEvents.includes(event)) {
      throw ApiError.badRequest('Invalid event type');
    }

    // Store event
    const result = await db.query(
      `INSERT INTO survey_events (
        id, event_type, survey_id, tenant_id, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id`,
      [uuidv4(), event, survey_id, tenant_id, JSON.stringify(metadata || {})]
    );

    // Invalidate cache for this survey
    await this.invalidateCache(survey_id);

    logger.info('Event tracked', { event, survey_id, eventId: result.rows[0].id });
    
    return result.rows[0];
  }

  /**
   * Get survey summary analytics
   */
  async getSurveySummary(surveyId, userId, options = {}) {
    const { useCache = true, forceRefresh = false } = options;

    // Verify ownership
    await this.verifySurveyAccess(surveyId, userId);

    // Try cache first
    if (useCache && !forceRefresh) {
      const cached = await this.getCachedAnalytics(surveyId);
      if (cached) {
        logger.debug('Returning cached analytics', { surveyId });
        return cached;
      }
    }

    // Fetch from Micro-Survey and local DB
    const [microSurveyData, localEvents] = await Promise.all([
      this.fetchMicroSurveyAnalytics(surveyId),
      this.fetchLocalEvents(surveyId),
    ]);

    // Aggregate data
    const summary = {
      surveyId,
      views: localEvents.views,
      starts: localEvents.starts,
      completions: microSurveyData.totalResponses || 0,
      completionRate: this.calculateCompletionRate(localEvents.starts, microSurveyData.totalResponses),
      avgTimeToComplete: microSurveyData.avgDuration || null,
      lastUpdated: new Date().toISOString(),
      
      // Device breakdown
      devices: this.aggregateDevices(localEvents.devices),
      
      // Browser breakdown
      browsers: this.aggregateBrowsers(localEvents.browsers),
      
      // Geographic data
      countries: this.aggregateCountries(microSurveyData.geography || []),
      
      // Time series (last 30 days)
      timeline: await this.getTimeline(surveyId, 30),
    };

    // Cache results
    await this.cacheAnalytics(surveyId, summary);

    return summary;
  }

  /**
   * Get question-level analytics
   */
  async getQuestionAnalytics(surveyId, userId) {
    await this.verifySurveyAccess(surveyId, userId);

    // Get survey with questions
    const survey = await db.query(
      `SELECT s.*, ss.snapshot
       FROM surveys s
       LEFT JOIN survey_snapshots ss ON s.published_snapshot_id = ss.id
       WHERE s.id = $1`,
      [surveyId]
    );

    if (survey.rows.length === 0) {
      throw ApiError.notFound('Survey not found');
    }

    const snapshot = survey.rows[0].snapshot;
    const questions = snapshot?.questions || [];

    // Fetch responses from Micro-Survey
    const responsesData = await microSurveyClient.getResults(
      survey.rows[0].microsurvey_id
    );

    // Aggregate question-level stats
    const questionStats = questions.map(question => {
      const responses = this.filterResponsesByQuestion(
        responsesData.responses || [],
        question.id
      );

      return {
        questionId: question.id,
        questionText: question.text,
        questionType: question.type,
        totalResponses: responses.length,
        ...this.aggregateQuestionResponses(question, responses),
      };
    });

    return {
      surveyId,
      totalQuestions: questions.length,
      questions: questionStats,
    };
  }

  /**
   * Get chart data for visualization
   */
  async getOverviewChart(surveyId, userId, options = {}) {
    await this.verifySurveyAccess(surveyId, userId);

    const { days = 30, granularity = 'day' } = options;

    // Time series: views vs completions
    const timeSeriesData = await this.getTimeline(surveyId, days, granularity);

    // Conversion funnel
    const funnelData = await this.getFunnelData(surveyId);

    return {
      surveyId,
      timeSeries: timeSeriesData,
      funnel: funnelData,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(surveyId, userId, format = 'csv') {
    await this.verifySurveyAccess(surveyId, userId);

    const [summary, questions] = await Promise.all([
      this.getSurveySummary(surveyId, userId, { useCache: false }),
      this.getQuestionAnalytics(surveyId, userId),
    ]);

    if (format === 'json') {
      return { summary, questions };
    }

    if (format === 'csv') {
      return this.generateCSV(summary, questions);
    }

    throw ApiError.badRequest('Unsupported export format');
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  async verifySurveyAccess(surveyId, userId) {
    const result = await db.query(
      `SELECT s.id FROM surveys s
       JOIN tenants t ON s.tenant_id = t.id
       WHERE s.id = $1 AND t.owner_id = $2`,
      [surveyId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.forbidden('Survey not found or access denied');
    }
  }

  async fetchMicroSurveyAnalytics(surveyId) {
    try {
      const survey = await db.query(
        'SELECT microsurvey_id FROM surveys WHERE id = $1',
        [surveyId]
      );

      if (survey.rows.length === 0) {
        throw new Error('Survey not found');
      }

      const data = await microSurveyClient.getResults(
        survey.rows[0].microsurvey_id
      );

      return data;
    } catch (error) {
      logger.error('Failed to fetch Micro-Survey analytics', {
        error: error.message,
        surveyId,
      });
      return { totalResponses: 0, responses: [] };
    }
  }

  async fetchLocalEvents(surveyId) {
    const result = await db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE event_type = 'survey_view') as views,
        COUNT(*) FILTER (WHERE event_type = 'survey_start') as starts,
        jsonb_agg(DISTINCT metadata->'device') FILTER (WHERE metadata->'device' IS NOT NULL) as devices,
        jsonb_agg(DISTINCT metadata->'browser') FILTER (WHERE metadata->'browser' IS NOT NULL) as browsers
      FROM survey_events
      WHERE survey_id = $1`,
      [surveyId]
    );

    const row = result.rows[0] || {};
    
    return {
      views: parseInt(row.views || 0),
      starts: parseInt(row.starts || 0),
      devices: row.devices || [],
      browsers: row.browsers || [],
    };
  }

  async getTimeline(surveyId, days = 30, granularity = 'day') {
    const dateFormat = granularity === 'hour' ? 'YYYY-MM-DD HH24:00:00' : 'YYYY-MM-DD';
    
    const result = await db.query(
      `SELECT 
        TO_CHAR(DATE_TRUNC($3, created_at), $4) as period,
        COUNT(*) FILTER (WHERE event_type = 'survey_view') as views,
        COUNT(*) FILTER (WHERE event_type = 'survey_start') as starts
      FROM survey_events
      WHERE survey_id = $1 
        AND created_at >= NOW() - INTERVAL '1 day' * $2
      GROUP BY period
      ORDER BY period ASC`,
      [surveyId, days, granularity, dateFormat]
    );

    // Also get completions from survey_responses
    const completionsResult = await db.query(
      `SELECT 
        TO_CHAR(DATE_TRUNC($3, created_at), $4) as period,
        COUNT(*) as completions
      FROM survey_responses
      WHERE survey_id = $1 
        AND created_at >= NOW() - INTERVAL '1 day' * $2
      GROUP BY period
      ORDER BY period ASC`,
      [surveyId, days, granularity, dateFormat]
    );

    // Merge data
    const completionsMap = new Map(
      completionsResult.rows.map(r => [r.period, parseInt(r.completions)])
    );

    return result.rows.map(row => ({
      date: row.period,
      views: parseInt(row.views || 0),
      starts: parseInt(row.starts || 0),
      completions: completionsMap.get(row.period) || 0,
    }));
  }

  async getFunnelData(surveyId) {
    const result = await db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE event_type = 'survey_view') as views,
        COUNT(*) FILTER (WHERE event_type = 'survey_start') as starts
      FROM survey_events
      WHERE survey_id = $1`,
      [surveyId]
    );

    const completionsResult = await db.query(
      'SELECT COUNT(*) as completions FROM survey_responses WHERE survey_id = $1',
      [surveyId]
    );

    const views = parseInt(result.rows[0]?.views || 0);
    const starts = parseInt(result.rows[0]?.starts || 0);
    const completions = parseInt(completionsResult.rows[0]?.completions || 0);

    return [
      { stage: 'Views', count: views, percentage: 100 },
      { stage: 'Starts', count: starts, percentage: views > 0 ? (starts / views) * 100 : 0 },
      { stage: 'Completions', count: completions, percentage: views > 0 ? (completions / views) * 100 : 0 },
    ];
  }

  calculateCompletionRate(starts, completions) {
    if (starts === 0) return 0;
    return ((completions / starts) * 100).toFixed(2);
  }

  aggregateDevices(devices) {
    const counts = {};
    devices.forEach(device => {
      if (device) {
        counts[device] = (counts[device] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }

  aggregateBrowsers(browsers) {
    const counts = {};
    browsers.forEach(browser => {
      if (browser) {
        counts[browser] = (counts[browser] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }

  aggregateCountries(geography) {
    return geography.map(g => ({
      countryCode: g.country,
      count: g.count,
      percentage: g.percentage,
    }));
  }

  filterResponsesByQuestion(responses, questionId) {
    return responses.filter(r => 
      r.answers && r.answers.some(a => a.questionId === questionId)
    );
  }

  aggregateQuestionResponses(question, responses) {
    switch (question.type) {
      case 'multiple_choice':
        return this.aggregateMultipleChoice(question, responses);
      case 'rating':
        return this.aggregateRating(question, responses);
      case 'text':
        return this.aggregateText(responses);
      case 'yes_no':
        return this.aggregateYesNo(responses);
      default:
        return {};
    }
  }

  aggregateMultipleChoice(question, responses) {
    const optionCounts = {};
    const options = question.options || [];
    
    // Initialize counts
    options.forEach(opt => {
      const optText = typeof opt === 'string' ? opt : opt.text;
      optionCounts[optText] = 0;
    });

    // Count responses
    responses.forEach(response => {
      const answer = response.answers?.find(a => a.questionId === question.id);
      if (answer && answer.answer) {
        optionCounts[answer.answer] = (optionCounts[answer.answer] || 0) + 1;
      }
    });

    const total = responses.length;
    
    return {
      optionBreakdown: Object.entries(optionCounts).map(([option, count]) => ({
        option,
        count,
        percentage: total > 0 ? ((count / total) * 100).toFixed(2) : 0,
      })),
    };
  }

  aggregateRating(question, responses) {
    const ratings = responses
      .map(r => r.answers?.find(a => a.questionId === question.id)?.answer)
      .filter(a => typeof a === 'number');

    if (ratings.length === 0) {
      return { average: 0, distribution: [] };
    }

    const sum = ratings.reduce((acc, val) => acc + val, 0);
    const average = (sum / ratings.length).toFixed(2);

    // Distribution
    const distribution = {};
    const min = question.options?.[0]?.min || 1;
    const max = question.options?.[0]?.max || 5;
    
    for (let i = min; i <= max; i++) {
      distribution[i] = ratings.filter(r => r === i).length;
    }

    return {
      average: parseFloat(average),
      distribution: Object.entries(distribution).map(([rating, count]) => ({
        rating: parseInt(rating),
        count,
        percentage: ((count / ratings.length) * 100).toFixed(2),
      })),
    };
  }

  aggregateText(responses) {
    const textResponses = responses
      .map(r => r.answers?.find(a => a.answer && typeof a.answer === 'string')?.answer)
      .filter(Boolean);

    return {
      sampleAnswers: textResponses.slice(0, 10),
      totalCount: textResponses.length,
    };
  }

  aggregateYesNo(responses) {
    const yes = responses.filter(r => 
      r.answers?.some(a => a.answer === 'yes')
    ).length;
    const no = responses.filter(r => 
      r.answers?.some(a => a.answer === 'no')
    ).length;
    const total = yes + no;

    return {
      yes: { count: yes, percentage: total > 0 ? ((yes / total) * 100).toFixed(2) : 0 },
      no: { count: no, percentage: total > 0 ? ((no / total) * 100).toFixed(2) : 0 },
    };
  }

  // ============================================
  // CACHING
  // ============================================

  async getCachedAnalytics(surveyId) {
    const result = await db.query(
      `SELECT analytics_data FROM survey_analytics_cache
       WHERE survey_id = $1 AND expires_at > NOW()
       ORDER BY cached_at DESC LIMIT 1`,
      [surveyId]
    );

    return result.rows[0]?.analytics_data || null;
  }

  async cacheAnalytics(surveyId, data, ttlMinutes = 5) {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    
    await db.query(
      `INSERT INTO survey_analytics_cache (
        id, survey_id, analytics_data, cached_at, expires_at
      ) VALUES ($1, $2, $3, NOW(), $4)`,
      [uuidv4(), surveyId, JSON.stringify(data), expiresAt]
    );
  }

  async invalidateCache(surveyId) {
    await db.query(
      'DELETE FROM survey_analytics_cache WHERE survey_id = $1',
      [surveyId]
    );
  }

  // ============================================
  // CSV EXPORT
  // ============================================

  generateCSV(summary, questions) {
    const lines = [];
    
    // Summary section
    lines.push('SURVEY SUMMARY');
    lines.push(`Survey ID,${summary.surveyId}`);
    lines.push(`Views,${summary.views}`);
    lines.push(`Starts,${summary.starts}`);
    lines.push(`Completions,${summary.completions}`);
    lines.push(`Completion Rate,${summary.completionRate}%`);
    lines.push('');

    // Questions section
    lines.push('QUESTION ANALYTICS');
    questions.questions.forEach((q, idx) => {
      lines.push('');
      lines.push(`Question ${idx + 1}: ${q.questionText}`);
      lines.push(`Type: ${q.questionType}`);
      lines.push(`Total Responses: ${q.totalResponses}`);
      
      if (q.optionBreakdown) {
        lines.push('Option,Count,Percentage');
        q.optionBreakdown.forEach(opt => {
          lines.push(`"${opt.option}",${opt.count},${opt.percentage}%`);
        });
      }
    });

    return lines.join('\n');
  }
}

export default new AnalyticsService();

// ============================================
// UPDATED analytics.controller.js
// ============================================
