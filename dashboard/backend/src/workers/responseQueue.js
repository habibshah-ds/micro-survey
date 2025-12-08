import { Queue, Worker } from 'bullmq';
import { config } from '../config/index.js';
import * as integrationService from '../modules/integration/integration.service.js';

const responseQueue = new Queue('responses', {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
  },
});

const worker = new Worker
