import { describe, it, beforeAll as before, afterAll as after } from '@jest/globals';
import assert from 'node:assert';
import { pushResponses } from '../src/modules/integration/integration.service.js';
import db from '../src/config/db.js';

describe.skip('Batch Insert Performance', () => {
  let siteKey, orgId, questionId;

  before(async () => {
    // Create test data
    const org = await db.query(
      `INSERT INTO organizations (id, name, slug, owner_id) 
       VALUES (gen_random_uuid(), 'Test Org', 'test-org', gen_random_uuid()) 
       RETURNING id`
    );
    orgId = org.rows[0].id;

    const question = await db.query(
      `INSERT INTO questions (id, organization_id, question_text, question_type) 
       VALUES (gen_random_uuid(), $1, 'Test Question', 'text') 
       RETURNING id`,
      [orgId]
    );
    questionId = question.rows[0].id;

    const site = await db.query(
      `INSERT INTO captcha_sites (id, site_name, site_url, site_key, site_secret, organization_id) 
       VALUES (gen_random_uuid(), 'Test Site', 'http://test.com', 'test-key', 'test-secret', $1) 
       RETURNING site_key`,
      [orgId]
    );
    siteKey = site.rows[0].site_key;
  });

  after(async () => {
    await db.query('DELETE FROM organizations WHERE id = $1', [orgId]);
  });

  it('should batch insert 250 responses efficiently', async () => {
    const responses = Array.from({ length: 250 }, (_, i) => ({
      questionId,
      responseText: `Response ${i}`,
      sessionId: `session-${i}`,
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
    }));

    const start = Date.now();
    const result = await pushResponses(siteKey, responses);
    const duration = Date.now() - start;

    assert.strictEqual(result.inserted, 250);
    assert.strictEqual(result.batches, 3); // 100, 100, 50
    assert.ok(duration < 1000, `Batch insert took ${duration}ms (should be <1000ms)`);
  });
});
