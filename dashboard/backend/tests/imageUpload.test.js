// ============================================
// FILE: backend/tests/imageUpload.test.js
// Integration tests for image upload
// ============================================
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../src/server.js';
import db from '../src/config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe.skip('Image Upload API (skipped - uploads removed)', () => {
  let accessToken;
  let userId;

  // Create test user and get token
  before(async () => {
    const testUser = {
      email: `imagetest-${Date.now()}@example.com`,
      password: 'TestPass123!',
      fullName: 'Image Test User',
    };

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    assert.strictEqual(registerRes.status, 201);
    accessToken = registerRes.body.data.accessToken;
    userId = registerRes.body.data.user.id;
  });

  after(async () => {
    // Cleanup test user
    if (userId) {
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    await db.pool.end();
  });

  describe('POST /api/uploads/image', () => {
    it('should upload a valid JPEG image', async () => {
      // Create a test image buffer (1x1 red JPEG)
      const testImage = Buffer.from(
        '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP/bAEMAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaWmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9/KKKKAP/2Q==',
        'base64'
      );

      const res = await request(app)
        .post('/api/uploads/image')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('image', testImage, 'test.jpg')
        .expect(201);

      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.image_url);
      assert.ok(res.body.data.thumbnail_url);
      assert.strictEqual(res.body.data.format, 'webp');
      assert.ok(res.body.data.size_bytes < testImage.length);
    });

    it('should reject file that is too large', async () => {
      // Create a mock large file (9MB, over default 8MB limit)
      const largeBuffer = Buffer.alloc(9 * 1024 * 1024, 0xFF);

      const res = await request(app)
        .post('/api/uploads/image')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('image', largeBuffer, 'large.jpg')
        .expect(400);

      assert.ok(res.body.message.includes('too large'));
    });

    it('should reject non-image file', async () => {
      const textFile = Buffer.from('This is not an image');

      const res = await request(app)
        .post('/api/uploads/image')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('image', textFile, 'test.txt')
        .expect(400);

      assert.ok(res.body.message.toLowerCase().includes('invalid'));
    });

    it('should reject request without authentication', async () => {
      const testImage = Buffer.from('fake-image');

      const res = await request(app)
        .post('/api/uploads/image')
        .attach('image', testImage, 'test.jpg')
        .expect(401);

      assert.strictEqual(res.body.success, false);
    });

    it('should respect rate limiting', async () => {
      // Create minimal valid JPEG
      const testImage = Buffer.from(
        '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP/bAEMAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaWmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9/KKKKAP/2Q==',
        'base64'
      );

      // Make 11 requests (limit is 10 per 15 minutes)
      for (let i = 0; i < 11; i++) {
        const res = await request(app)
          .post('/api/uploads/image')
          .set('Authorization', `Bearer ${accessToken}`)
          .attach('image', testImage, `test${i}.jpg`);

        if (i < 10) {
          assert.ok([201, 202].includes(res.status)); // Allow async response
        } else {
          assert.strictEqual(res.status, 429); // Too many requests
        }
      }
    });
  });

  describe('GET /api/uploads/config', () => {
    it('should return upload configuration', async () => {
      const res = await request(app)
        .get('/api/uploads/config')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.maxFileSize);
      assert.ok(Array.isArray(res.body.data.allowedTypes));
      assert.ok(res.body.data.storageType);
    });
  });

  describe('DELETE /api/uploads/image', () => {
    it('should delete uploaded image', async () => {
      // First upload an image
      const testImage = Buffer.from(
        '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP/bAEMAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaWmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9/KKKKAP/2Q==',
        'base64'
      );

      const uploadRes = await request(app)
        .post('/api/uploads/image')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('image', testImage, 'test.jpg');

      const imageUrl = uploadRes.body.data.image_url;

      // Then delete it
      const deleteRes = await request(app)
        .delete('/api/uploads/image')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ imageUrl })
        .expect(200);

      assert.strictEqual(deleteRes.body.success, true);
    });
  });
});
