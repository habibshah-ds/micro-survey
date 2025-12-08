// ============================================
// FILE: backend/src/middleware/rateLimit.middleware.js (UPDATED)
// Add upload rate limiter
// ============================================
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

// Redis client for rate limiting
let redisClient;
try {
  redisClient = new Redis(config.redis.url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });
  
  redisClient.on('error', (err) => {
    logger.warn('Redis rate limit store unavailable, using memory store', { error: err.message });
  });
  
  redisClient.on('connect', () => {
    logger.info('Redis rate limit store connected');
  });
} catch (error) {
  logger.warn('Failed to initialize Redis for rate limiting, using memory store');
}

// Store factory
function getStore() {
  if (redisClient && redisClient.status === 'ready') {
    return new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: `${config.queue.prefix}:ratelimit:`,
    });
  }
  return undefined; // Use memory store
}

/**
 * General rate limiter for all routes
 */
export const rateLimitMiddleware = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  store: getStore(),
  message: {
    success: false,
    message: 'Too many requests, please try again later',
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/api/health',
});

/**
 * Strict rate limiter for authentication routes
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.rateLimit.authMax,
  store: getStore(),
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
    },
  },
  skipSuccessfulRequests: true,
});

/**
 * Rate limiter for password reset routes
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  store: getStore(),
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later',
    error: {
      code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
    },
  },
});

/**
 * Rate limiter for API key operations
 */
export const apiKeyRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  store: getStore(),
  message: {
    success: false,
    message: 'Too many API key operations, please try again later',
    error: {
      code: 'API_KEY_RATE_LIMIT_EXCEEDED',
    },
  },
});

/**
 * Rate limiter for webhook endpoints
 */
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  store: getStore(),
  message: {
    success: false,
    message: 'Too many webhook requests',
    error: {
      code: 'WEBHOOK_RATE_LIMIT_EXCEEDED',
    },
  },
  skip: (req) => {
    // Skip rate limit if valid webhook signature
    return req.webhookVerified === true;
  },
});

/**
 * Rate limiter for image uploads
 * Stricter limits per IP and per site_key
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.rateLimit.uploadMax,
  store: getStore(),
  message: {
    success: false,
    message: 'Too many upload requests. Please try again in 15 minutes.',
    error: {
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Key by both IP and user
  keyGenerator: (req) => {
    const userId = req.user?.userId || 'anonymous';
    return `upload:${req.ip}:${userId}`;
  },
});
