// ============================================
// FILE: backend/tests/auth.integration.test.js
// Integration tests for auth flows
// ============================================
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.js';
import db from '../src/config/db.js';

describe('Auth Integration Tests', () => {
  let testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    fullName: 'Test User',
  };
  
  let accessToken;
  let refreshToken;
  
  afterAll(async () => {
    // Cleanup
    await db.query('DELETE FROM users WHERE email = $1', [testUser.email]);
    await db.pool.end();
  });
  
  describe('POST /api/auth/signup', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(testUser)
        .expect(201);
      
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.accessToken).toBeDefined();
      
      // Should set cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.startsWith('refreshToken='))).toBe(true);
      
      accessToken = res.body.data.accessToken;
    });
    
    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(testUser)
        .expect(409);
      
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already registered');
    });
    
    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ ...testUser, email: 'invalid-email' })
        .expect(400);
      
      expect(res.body.success).toBe(false);
    });
    
    it('should reject weak password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ ...testUser, email: 'new@test.com', password: 'weak' })
        .expect(400);
      
      expect(res.body.success).toBe(false);
    });
  });
  
  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      
      // Extract refresh token from cookie
      const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
      refreshToken = refreshCookie.split(';')[0].split('=')[1];
      
      accessToken = res.body.data.accessToken;
    });
    
    it('should reject invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123',
        })
        .expect(401);
      
      expect(res.body.success).toBe(false);
    });
  });
  
  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testUser.email);
    });
    
    it('should reject request without token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .expect(401);
      
      expect(res.body.success).toBe(false);
    });
    
    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
      
      expect(res.body.success).toBe(false);
    });
  });
  
  describe('POST /api/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.accessToken).not.toBe(accessToken);
      
      // Should set new refresh token cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      
      accessToken = res.body.data.accessToken;
    });
    
    it('should reject reuse of old refresh token', async () => {
      // Try to use the old refresh token again
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(401);
      
      expect(res.body.success).toBe(false);
    });
  });
  
  describe('POST /api/auth/logout', () => {
    it('should logout and clear cookie', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(200);
      
      expect(res.body.success).toBe(true);
      
      // Cookie should be cleared
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.includes('refreshToken=;'))).toBe(true);
    });
  });
  
  describe('Password Reset Flow', () => {
    it('should request password reset', async () => {
      const res = await request(app)
        .post('/api/auth/request-password-reset')
        .send({ email: testUser.email })
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBeDefined();
    });
    
    it('should not reveal if email does not exist', async () => {
      const res = await request(app)
        .post('/api/auth/request-password-reset')
        .send({ email: 'nonexistent@test.com' })
        .expect(200);
      
      // Same response for security
      expect(res.body.success).toBe(true);
    });
    
    // Note: Full password reset test would require accessing the reset token
    // from the database or email service. Left as TODO for comprehensive suite.
  });
});
