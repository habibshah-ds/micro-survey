-- ============================================
-- FILE: 007_add_analytics_indexes.sql
-- Performance indexes for analytics queries
-- ============================================

-- Composite index for filtering by question and date range
CREATE INDEX IF NOT EXISTS idx_responses_question_date 
  ON question_responses(question_id, created_at DESC);

-- Index for country-based analytics
CREATE INDEX IF NOT EXISTS idx_responses_country_question 
  ON question_responses(country_code, question_id) 
  WHERE country_code IS NOT NULL;

-- Index for session-based analysis
CREATE INDEX IF NOT EXISTS idx_responses_session_date 
  ON question_responses(session_id, created_at DESC) 
  WHERE session_id IS NOT NULL;

-- Partial index for active questions only
CREATE INDEX IF NOT EXISTS idx_questions_active_org 
  ON questions(organization_id, created_at DESC) 
  WHERE is_active = true;

COMMENT ON INDEX idx_responses_question_date IS 'Speeds up analytics queries by question and date range';
