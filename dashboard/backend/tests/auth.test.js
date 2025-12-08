import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/server.js';
import db from '../src/config/db.js';

describe('Authentication Flow', () => {
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPass123!',
    fullName: 'Test User',
  };

  let accessToken, refreshToken, csrfToken;

  after(async () => {
    await db.query('DELETE FROM users WHERE email = $1', [testUser.email]);
    await db.pool.end();
  });

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.accessToken);
    accessToken = res.body.data.accessToken;
  });

  it('should login existing user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.accessToken);
    
    // Extract cookies
    const cookies = res.headers['set-cookie'];
    refreshToken = cookies.find(c => c.startsWith('refreshToken='));
    csrfToken = res.body.data.csrfToken;
  });

  it('should refresh access token with cookie', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshToken)
      .set('x-csrf-token', csrfToken)
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.accessToken);
  });

  it('should get current user with token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    assert.strictEqual(res.body.data.user.email, testUser.email);
  });

  it('should logout and clear cookies', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', refreshToken)
      .set('x-csrf-token', csrfToken)
      .expect(200);

    assert.strictEqual(res.body.success, true);
  });
});
