-- ============================================
-- FILE: 005_create_question_responses.sql
-- ============================================
CREATE TABLE IF NOT EXISTS question_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  response_text TEXT,
  response_data JSONB,
  session_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  country_code VARCHAR(2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_question_responses_question_id ON question_responses(question_id);
CREATE INDEX idx_question_responses_created_at ON question_responses(created_at DESC);
CREATE INDEX idx_question_responses_session_id ON question_responses(session_id);
CREATE INDEX idx_question_responses_country ON question_responses(country_code);

COMMENT ON TABLE question_responses IS 'Stores user responses to questions';
COMMENT ON COLUMN question_responses.response_text IS 'Text response for text-type questions';
COMMENT ON COLUMN question_responses.response_data IS 'JSON data for complex responses';
COMMENT ON COLUMN question_responses.session_id IS 'Anonymous session identifier';
