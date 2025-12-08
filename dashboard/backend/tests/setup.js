import { config } from '../src/config/index.js';

// Use test database
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/dashboard_test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

// Disable logging in tests
console.log = () => {};
console.info = () => {};
console.warn = () => {};
