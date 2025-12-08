import pino from 'pino';
import { config } from '../config/index.js';

const logger = pino({
  level: config.logging.level,
  transport: config.nodeEnv === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

export { logger };
