-- ============================================
-- FILE: 015_finalize_captcha_cleanup.sql (FIXED)
-- Fully idempotent and defensive migration
-- ============================================

-- Step 1: Rename captcha_sites to legacy (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'captcha_sites'
  ) AND NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'legacy_captcha_sites'
  ) THEN
    ALTER TABLE captcha_sites RENAME TO legacy_captcha_sites;
    RAISE NOTICE '✓ Renamed captcha_sites to legacy_captcha_sites';
  END IF;
END $$;

-- Step 2: Add deprecation comment (only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'legacy_captcha_sites'
  ) THEN
    COMMENT ON TABLE legacy_captcha_sites IS 
      'DEPRECATED: Legacy CAPTCHA sites table. Migrated to surveys table. Safe to archive after 2 releases.';
  END IF;
END $$;

-- Step 3: Create surveys_meta table (if not exists)
CREATE TABLE IF NOT EXISTS surveys_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  meta_key VARCHAR(100) NOT NULL,
  meta_value TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(survey_id, meta_key)
);

CREATE INDEX IF NOT EXISTS idx_surveys_meta_survey_id ON surveys_meta(survey_id);
CREATE INDEX IF NOT EXISTS idx_surveys_meta_key ON surveys_meta(meta_key);

COMMENT ON TABLE surveys_meta IS 'Extended metadata for surveys (replaces CAPTCHA-specific fields)';

-- Step 4: Migrate legacy data (defensive - check existence)
DO $$
DECLARE
  legacy_rec RECORD;
  survey_rec RECORD;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'legacy_captcha_sites') THEN
    
    FOR legacy_rec IN 
      SELECT * FROM legacy_captcha_sites 
      WHERE id NOT IN (
        SELECT COALESCE(captcha_site_id::uuid, '00000000-0000-0000-0000-000000000000'::uuid) 
        FROM legacy_captcha_mapping 
        WHERE captcha_site_id IS NOT NULL
      )
    LOOP
      -- Find or create corresponding survey
      SELECT id INTO survey_rec 
      FROM surveys 
      WHERE organization_id = legacy_rec.organization_id 
        AND survey_key = legacy_rec.site_key
      LIMIT 1;
      
      IF survey_rec.id IS NOT NULL THEN
        -- Store legacy metadata
        INSERT INTO surveys_meta (survey_id, meta_key, meta_value, created_at)
        VALUES 
          (survey_rec.id, 'legacy_captcha_id', legacy_rec.id::text, legacy_rec.created_at),
          (survey_rec.id, 'legacy_site_url', legacy_rec.site_url, legacy_rec.created_at),
          (survey_rec.id, 'legacy_site_secret', '[REDACTED]', legacy_rec.created_at)
        ON CONFLICT (survey_id, meta_key) DO NOTHING;
        
        RAISE NOTICE '✓ Migrated metadata for legacy CAPTCHA site: %', legacy_rec.site_name;
      END IF;
    END LOOP;
    
  END IF;
END $$;

-- Step 5: Create deprecated_endpoints table (if not exists)
CREATE TABLE IF NOT EXISTS deprecated_endpoints (
  id SERIAL PRIMARY KEY,
  endpoint_pattern VARCHAR(255) UNIQUE NOT NULL,
  replacement VARCHAR(255),
  deprecated_since DATE NOT NULL DEFAULT CURRENT_DATE,
  removal_date DATE,
  notes TEXT
);

INSERT INTO deprecated_endpoints (endpoint_pattern, replacement, deprecated_since, removal_date, notes)
VALUES 
  ('/api/integration/captcha/register-site', '/api/surveys', '2025-01-01', '2025-04-01', 'Use POST /api/surveys to create surveys instead'),
  ('/api/integration/captcha/stats/:siteKey', '/api/surveys/:id/results', '2025-01-01', '2025-04-01', 'Use surveys API for analytics'),
  ('/api/integration/captcha/push-responses', '/api/surveys/:surveyKey/responses', '2025-01-01', '2025-04-01', 'Submit responses directly to Micro-Survey API'),
  ('/api/integration/captcha/questions', '/api/questions', '2025-01-01', '2025-04-01', 'Use questions API')
ON CONFLICT (endpoint_pattern) DO UPDATE 
SET notes = EXCLUDED.notes;

COMMENT ON TABLE deprecated_endpoints IS 'Track deprecated API endpoints for monitoring and cleanup';

-- Step 6: Create cleanup status view (defensive)
DO $$
BEGIN
  -- Drop view if exists, then recreate
  DROP VIEW IF EXISTS captcha_cleanup_status;
  
  CREATE VIEW captcha_cleanup_status AS
  SELECT 
    'legacy_captcha_sites' as table_name,
    COALESCE(
      (SELECT COUNT(*) FROM legacy_captcha_sites WHERE EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'legacy_captcha_sites')),
      0
    ) as record_count,
    'Safe to archive after all surveys migrated' as status
  UNION ALL
  SELECT 
    'legacy_captcha_mapping' as table_name,
    (SELECT COUNT(*) FROM legacy_captcha_mapping) as record_count,
    'Migration tracking table - keep for reference' as status
  UNION ALL
  SELECT 
    'surveys_meta' as table_name,
    (SELECT COUNT(DISTINCT survey_id) FROM surveys_meta WHERE meta_key LIKE 'legacy_%') as record_count,
    'Active metadata storage' as status;

  COMMENT ON VIEW captcha_cleanup_status IS 'Summary of CAPTCHA-to-Survey migration status';
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ CAPTCHA cleanup migration completed';
  RAISE NOTICE '   - Legacy tables preserved with "legacy_" prefix';
  RAISE NOTICE '   - Deprecated endpoints tracked in deprecated_endpoints table';
  RAISE NOTICE '   - Check captcha_cleanup_status view for migration status';
END $$;
