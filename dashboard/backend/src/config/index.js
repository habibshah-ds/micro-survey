// ============================================
// FILE: backend/src/config/index.js (UPDATED)
// Configuration with image processing support
// ============================================
import dotenv from "dotenv";
import Joi from "joi";

dotenv.config();

// Configuration Schema
const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(5000),
  
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),
  
  JWT_SECRET: Joi.string().min(32).required(),
  ACCESS_TOKEN_EXP: Joi.string().default('15m'),
  REFRESH_TOKEN_EXP: Joi.string().default('7d'),
  
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),
  TRUST_PROXY: Joi.boolean().default(false),
  API_KEY_PEPPER: Joi.string().min(16).required(),
  
  MICROSURVEY_BASE_URL: Joi.string().uri().required(),
  MICROSURVEY_API_KEY: Joi.string().required(),
  MICROSURVEY_TIMEOUT_MS: Joi.number().default(5000),
  MICROSURVEY_RETRY_ATTEMPTS: Joi.number().default(3),
  MICROSURVEY_CIRCUIT_BREAKER_THRESHOLD: Joi.number().default(5),
  MICROSURVEY_CIRCUIT_BREAKER_TIMEOUT: Joi.number().default(60000),
  
  USE_MOCK_MICROSURVEY: Joi.boolean().default(true),
  ENABLE_WEBHOOKS: Joi.boolean().default(true),
  
  QUEUE_CONCURRENCY: Joi.number().default(5),
  QUEUE_PREFIX: Joi.string().default('dashboard'),
  
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'pretty').default('json'),
  
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  RATE_LIMIT_AUTH_MAX: Joi.number().default(5),
  
  // Image processing configuration
  IMAGE_STORAGE: Joi.string().valid('local', 's3').default('local'),
  IMAGE_MAX_SIZE: Joi.number().default(8 * 1024 * 1024), // 8MB
  IMAGE_QUALITY: Joi.number().min(1).max(100).default(60),
  IMAGE_MAX_WIDTH: Joi.number().default(1024),
  IMAGE_MAX_HEIGHT: Joi.number().default(1024),
  IMAGE_THUMBNAIL_SIZE: Joi.number().default(400),
  IMAGE_PARALLEL: Joi.number().default(2),
  IMAGE_ASYNC: Joi.boolean().default(false),
  IMAGE_UPLOAD_DIR: Joi.string().default('uploads'),
  
  // S3 configuration (required if IMAGE_STORAGE=s3)
  S3_ACCESS_KEY_ID: Joi.string().when('IMAGE_STORAGE', {
    is: 's3',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  S3_SECRET_ACCESS_KEY: Joi.string().when('IMAGE_STORAGE', {
    is: 's3',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  S3_BUCKET: Joi.string().when('IMAGE_STORAGE', {
    is: 's3',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  S3_REGION: Joi.string().default('us-east-1'),
  S3_ENDPOINT: Joi.string().uri().optional(),
  S3_FORCE_PATH_STYLE: Joi.boolean().default(false),
  S3_PUBLIC_URL: Joi.string().uri().optional(),
}).unknown(true);

const { error, value: env } = envSchema.validate(process.env);

if (error) {
  console.error('❌ Configuration validation failed:');
  console.error(error.details.map(d => `  - ${d.message}`).join('\n'));
  process.exit(1);
}

// Production Security Checks
if (env.NODE_ENV === 'production') {
  const weakSecrets = ['secret', 'changeme', 'password', 'CHANGE_THIS'];
  
  if (weakSecrets.some(weak => env.JWT_SECRET.toLowerCase().includes(weak))) {
    console.error('❌ FATAL: Weak JWT_SECRET in production!');
    console.error('Generate strong secret: openssl rand -base64 64');
    process.exit(1);
  }
  
  if (env.API_KEY_PEPPER.length < 32) {
    console.error('❌ FATAL: API_KEY_PEPPER must be at least 32 characters in production!');
    process.exit(1);
  }
  
  if (env.CORS_ORIGINS === '*') {
    console.error('❌ FATAL: CORS_ORIGINS cannot be * in production!');
    process.exit(1);
  }
}

// Parse Redis URL
const redisUrl = new URL(env.REDIS_URL);

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  
  database: {
    url: env.DATABASE_URL,
    poolMax: 10,
    poolMin: 2,
    idleTimeout: 30000,
    connectionTimeout: 2000,
  },
  
  redis: {
    url: env.REDIS_URL,
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port, 10) || 6379,
  },
  
  jwt: {
    secret: env.JWT_SECRET,
    accessTokenExpiry: env.ACCESS_TOKEN_EXP,
    refreshTokenExpiry: env.REFRESH_TOKEN_EXP,
  },
  
  cors: {
    origins: env.CORS_ORIGINS.split(',').map(o => o.trim()),
    credentials: true,
  },
  
  security: {
    trustProxy: env.TRUST_PROXY,
    apiKeyPepper: env.API_KEY_PEPPER,
  },
  
  microSurvey: {
    baseUrl: env.MICROSURVEY_BASE_URL,
    apiKey: env.MICROSURVEY_API_KEY,
    timeout: env.MICROSURVEY_TIMEOUT_MS,
    retryAttempts: env.MICROSURVEY_RETRY_ATTEMPTS,
    circuitBreaker: {
      threshold: env.MICROSURVEY_CIRCUIT_BREAKER_THRESHOLD,
      timeout: env.MICROSURVEY_CIRCUIT_BREAKER_TIMEOUT,
    },
  },
  
  features: {
    useMockMicroSurvey: env.USE_MOCK_MICROSURVEY,
    enableWebhooks: env.ENABLE_WEBHOOKS,
  },
  
  queue: {
    concurrency: env.QUEUE_CONCURRENCY,
    prefix: env.QUEUE_PREFIX,
    imageQueueName: `${env.QUEUE_PREFIX}:images`,
  },
  
  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
  },
  
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    authMax: env.RATE_LIMIT_AUTH_MAX,
    uploadMax: 10, // 10 uploads per 15 minutes
  },
  
  image: {
    storage: env.IMAGE_STORAGE,
    maxSize: env.IMAGE_MAX_SIZE,
    quality: env.IMAGE_QUALITY,
    maxWidth: env.IMAGE_MAX_WIDTH,
    maxHeight: env.IMAGE_MAX_HEIGHT,
    thumbnailSize: env.IMAGE_THUMBNAIL_SIZE,
    parallel: env.IMAGE_PARALLEL,
    async: env.IMAGE_ASYNC,
    uploadDir: env.IMAGE_UPLOAD_DIR,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  
  s3: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    publicUrl: env.S3_PUBLIC_URL,
  },
};

// Legacy exports (backward compatibility)
export const DATABASE_URL = config.database.url;
export const JWT_SECRET = config.jwt.secret;
export const ACCESS_TOKEN_EXP = config.jwt.accessTokenExpiry;
export const REFRESH_TOKEN_EXP = config.jwt.refreshTokenExpiry;
