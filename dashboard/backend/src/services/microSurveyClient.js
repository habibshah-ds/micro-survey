// ============================================
// Micro-Survey API Client
// Resilient integration with retries, circuit breaker, timeout
// ============================================
import axios from 'axios';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

class CircuitBreaker {
  constructor(threshold, timeout) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.failures = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  recordSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  recordFailure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      logger.warn('Circuit breaker opened', { failures: this.failures });
    }
  }

  canAttempt() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN' && Date.now() > this.nextAttempt) {
      this.state = 'HALF_OPEN';
      logger.info('Circuit breaker half-open, attempting request');
      return true;
    }
    return false;
  }
}

class MicroSurveyClient {
  constructor() {
    this.baseUrl = config.microSurvey.baseUrl;
    this.apiKey = config.microSurvey.apiKey;
    this.timeout = config.microSurvey.timeout;
    this.retryAttempts = config.microSurvey.retryAttempts;
    this.useMock = config.features.useMockMicroSurvey;
    
    this.circuitBreaker = new CircuitBreaker(
      config.microSurvey.circuitBreaker.threshold,
      config.microSurvey.circuitBreaker.timeout
    );

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Dashboard-Backend/2.0',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('MicroSurvey API request', {
          method: config.method,
          url: config.url,
          useMock: this.useMock,
        });
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        this.circuitBreaker.recordSuccess();
        logger.debug('MicroSurvey API response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        this.circuitBreaker.recordFailure();
        logger.error('MicroSurvey API error', {
          message: error.message,
          status: error.response?.status,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Retry logic with exponential backoff
   */
  async retryRequest(fn, attempt = 1) {
    try {
      if (!this.circuitBreaker.canAttempt()) {
        throw new Error('Circuit breaker is open');
      }
      return await fn();
    } catch (error) {
      if (attempt >= this.retryAttempts) {
        logger.error('Max retry attempts reached', { attempt, error: error.message });
        throw error;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      logger.warn(`Retry attempt ${attempt}/${this.retryAttempts} after ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retryRequest(fn, attempt + 1);
    }
  }

  /**
   * Get authorization header (can be overridden per-tenant)
   */
  getAuthHeader(tenantApiKey = null) {
    const key = tenantApiKey || this.apiKey;
    return { 'x-api-key': key };
  }

  /**
   * Create a new survey
   */
  async createSurvey(surveyData, tenantApiKey = null) {
    return this.retryRequest(async () => {
      const response = await this.client.post('/v1/surveys', surveyData, {
        headers: this.getAuthHeader(tenantApiKey),
      });
      return response.data;
    });
  }

  /**
   * Get survey by ID
   */
  async getSurvey(surveyId, tenantApiKey = null) {
    return this.retryRequest(async () => {
      const response = await this.client.get(`/v1/surveys/${surveyId}`, {
        headers: this.getAuthHeader(tenantApiKey),
      });
      return response.data;
    });
  }

  /**
   * Update survey (publish, unpublish, edit)
   */
  async updateSurvey(surveyId, updates, tenantApiKey = null) {
    return this.retryRequest(async () => {
      const response = await this.client.put(`/v1/surveys/${surveyId}`, updates, {
        headers: this.getAuthHeader(tenantApiKey),
      });
      return response.data;
    });
  }

  /**
   * Submit a response (public endpoint, usually no auth needed)
   */
  async submitResponse(surveyKey, responseData) {
    return this.retryRequest(async () => {
      const response = await this.client.post(
        `/v1/surveys/${surveyKey}/responses`,
        responseData
      );
      return response.data;
    });
  }

  /**
   * Get aggregated analytics/results
   */
  async getResults(surveyId, filters = {}, tenantApiKey = null) {
    return this.retryRequest(async () => {
      const response = await this.client.get(`/v1/surveys/${surveyId}/results`, {
        headers: this.getAuthHeader(tenantApiKey),
        params: filters,
      });
      return response.data;
    });
  }

  /**
   * Request CSV export
   */
  async requestExport(surveyId, options = {}, tenantApiKey = null) {
    return this.retryRequest(async () => {
      const response = await this.client.post(
        `/v1/surveys/${surveyId}/export`,
        options,
        {
          headers: this.getAuthHeader(tenantApiKey),
        }
      );
      return response.data;
    });
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health', { timeout: 2000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
export const microSurveyClient = new MicroSurveyClient();
export default microSurveyClient;
