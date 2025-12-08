-- ============================================
-- FILE: 014_migrate_captcha_to_microsurvey.sql
-- Safe migration from CAPTCHA terminology to Micro-Survey
-- Does NOT drop any existing data
-- ============================================

-- Step 1: Create new Micro-Survey response tables
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  session_id VARCHAR(255),
  response_data JSONB NOT NULL,
  ip_address INET,
  user_agent TEXT,
  country_code VARCHAR(2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_survey_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX idx_survey_responses_created_at ON survey_responses(created_at DESC);
CREATE INDEX idx_survey_responses_session ON survey_responses(session_id) WHERE session_id IS NOT NULL;

COMMENT ON TABLE survey_responses IS 'User responses to Micro-Survey surveys';

-- Step 2: Create mapping table (if needed to track old CAPTCHA IDs)
CREATE TABLE IF NOT EXISTS legacy_captcha_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  captcha_site_id UUID,
  survey_id UUID REFERENCES surveys(id),
  migrated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE legacy_captcha_mapping IS 'Maps old CAPTCHA site IDs to new survey IDs for reference';

-- Step 3: Migrate data from captcha_sites to surveys (if surveys table exists)
DO $$
DECLARE
  captcha_rec RECORD;
  new_survey_id UUID;
BEGIN
  -- Only proceed if captcha_sites table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'captcha_sites') THEN
    
    FOR captcha_rec IN SELECT * FROM captcha_sites LOOP
      -- Check if already migrated
      IF NOT EXISTS (
        SELECT 1 FROM legacy_captcha_mapping WHERE captcha_site_id = captcha_rec.id
      ) THEN
        
        -- Create corresponding survey
        INSERT INTO surveys (
          id, tenant_id, organization_id, survey_key, title, description,
          survey_type, status, created_at, updated_at
        )
        VALUES (
          gen_random_uuid(),
          (SELECT id FROM tenants WHERE owner_id = captcha_rec.organization_id LIMIT 1),
          captcha_rec.organization_id,
          captcha_rec.site_key,
          captcha_rec.site_name,
          'Migrated from legacy CAPTCHA site: ' || captcha_rec.site_url,
          'feedback',
          CASE WHEN captcha_rec.is_active THEN 'published' ELSE 'draft' END,
          captcha_rec.created_at,
          NOW()
        )
        RETURNING id INTO new_survey_id;
        
        -- Record migration
        INSERT INTO legacy_captcha_mapping (captcha_site_id, survey_id)
        VALUES (captcha_rec.id, new_survey_id);
        
        RAISE NOTICE 'Migrated CAPTCHA site % to survey %', captcha_rec.site_name, new_survey_id;
      END IF;
    END LOOP;
    
  END IF;
END $$;

-- Step 4: Rename old tables (preserve data, just rename for safety)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'captcha_sites') THEN
    ALTER TABLE captcha_sites RENAME TO legacy_captcha_sites;
    RAISE NOTICE 'Renamed captcha_sites to legacy_captcha_sites';
  END IF;
EXCEPTION
  WHEN duplicate_table THEN
    RAISE NOTICE 'legacy_captcha_sites already exists, skipping rename';
END $$;

-- Step 5: Add helpful view for backwards compatibility
CREATE OR REPLACE VIEW captcha_sites_view AS
SELECT 
  s.id,
  s.title as site_name,
  '' as site_url,
  s.survey_key as site_key,
  '' as site_secret,
  s.organization_id,
  (s.status = 'published') as is_active,
  s.created_at,
  s.updated_at
FROM surveys s;

COMMENT ON VIEW captcha_sites_view IS 'Backwards-compatible view mapping surveys to old CAPTCHA site structure';

-- Step 6: Success message
DO $$
BEGIN
  RAISE NOTICE '✅ CAPTCHA to Micro-Survey migration completed successfully';
  RAISE NOTICE 'Old tables renamed with legacy_ prefix and preserved';
  RAISE NOTICE 'Use legacy_captcha_mapping to trace migrated records';
END $$;
