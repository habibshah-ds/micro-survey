-- ============================================
-- FILE: backend/src/migrations/018_enhance_survey_snapshots.sql
-- Enhance survey snapshots and add missing constraints
-- ============================================

-- Add published_snapshot_id to surveys if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'surveys' AND column_name = 'published_snapshot_id'
  ) THEN
    ALTER TABLE surveys ADD COLUMN published_snapshot_id UUID REFERENCES survey_snapshots(id);
  END IF;
END $$;

-- Ensure survey_snapshots table exists with all fields
CREATE TABLE IF NOT EXISTS survey_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_survey_snapshots_survey_id 
  ON survey_snapshots(survey_id);

CREATE INDEX IF NOT EXISTS idx_survey_snapshots_created_at 
  ON survey_snapshots(created_at DESC);

-- Add questions.survey_id if not exists (for survey-scoped questions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'questions' AND column_name = 'survey_id'
  ) THEN
    ALTER TABLE questions ADD COLUMN survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE;
    CREATE INDEX idx_questions_survey_id ON questions(survey_id);
  END IF;
END $$;

-- Add questions.key field if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'questions' AND column_name = 'key'
  ) THEN
    ALTER TABLE questions ADD COLUMN key VARCHAR(50);
  END IF;
END $$;

-- Add questions.type field if not exists (rename from question_type)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'questions' AND column_name = 'type'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'questions' AND column_name = 'question_type'
    ) THEN
      ALTER TABLE questions RENAME COLUMN question_type TO type;
    ELSE
      ALTER TABLE questions ADD COLUMN type VARCHAR(50);
    END IF;
  END IF;
END $$;

-- Add questions.label field if not exists (rename from question_text)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'questions' AND column_name = 'label'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'questions' AND column_name = 'question_text'
    ) THEN
      ALTER TABLE questions RENAME COLUMN question_text TO label;
    ELSE
      ALTER TABLE questions ADD COLUMN label TEXT;
    END IF;
  END IF;
END $$;

-- Add questions.meta field if not exists (combines options, validation, etc)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'questions' AND column_name = 'meta'
  ) THEN
    ALTER TABLE questions ADD COLUMN meta JSONB DEFAULT '{}';
    
    -- Migrate existing options to meta if options column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'questions' AND column_name = 'options'
    ) THEN
      UPDATE questions 
      SET meta = jsonb_build_object('options', options::jsonb)
      WHERE options IS NOT NULL;
    END IF;
  END IF;
END $$;

-- Add questions.position field if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'questions' AND column_name = 'position'
  ) THEN
    ALTER TABLE questions ADD COLUMN position INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add questions.required field if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'questions' AND column_name = 'required'
  ) THEN
    ALTER TABLE questions ADD COLUMN required BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Create survey_responses table if not exists
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

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id 
  ON survey_responses(survey_id);

CREATE INDEX IF NOT EXISTS idx_survey_responses_created_at 
  ON survey_responses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_survey_responses_session 
  ON survey_responses(session_id) WHERE session_id IS NOT NULL;

-- Optional: Create access logs table for analytics
CREATE TABLE IF NOT EXISTS survey_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_access_logs_survey_id 
  ON survey_access_logs(survey_id);

CREATE INDEX IF NOT EXISTS idx_survey_access_logs_created_at 
  ON survey_access_logs(created_at DESC);

-- Add helpful comments
COMMENT ON TABLE survey_snapshots IS 'Frozen versions of surveys created when published';
COMMENT ON COLUMN survey_snapshots.snapshot IS 'Complete survey data including questions at publish time';

COMMENT ON TABLE survey_responses IS 'User responses to published surveys';
COMMENT ON COLUMN survey_responses.response_data IS 'JSON containing answers array and metadata';

COMMENT ON COLUMN questions.survey_id IS 'Optional: links question to specific survey (null means organization-wide)';
COMMENT ON COLUMN questions.key IS 'Unique identifier for question within survey';
COMMENT ON COLUMN questions.meta IS 'JSON containing options, validation rules, conditional logic';
COMMENT ON COLUMN questions.position IS 'Display order in survey (0-based)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Survey snapshots enhancement migration completed';
  RAISE NOTICE '   - survey_snapshots table ready';
  RAISE NOTICE '   - survey_responses table ready';
  RAISE NOTICE '   - questions table enhanced with survey_id, key, position, meta';
  RAISE NOTICE '   - All indexes created';
END $$;
