-- ============================================
-- FILE: 004_create_questions.sql
-- ============================================
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(50) NOT NULL CHECK (question_type IN ('multiple_choice', 'text', 'rating')),
  options JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_organization_id ON questions(organization_id);
CREATE INDEX idx_questions_is_active ON questions(is_active);
CREATE INDEX idx_questions_type ON questions(question_type);
CREATE INDEX idx_questions_created_at ON questions(created_at DESC);

COMMENT ON TABLE questions IS 'Stores survey questions for CAPTCHA';
COMMENT ON COLUMN questions.question_type IS 'Type: multiple_choice, text, or rating';
COMMENT ON COLUMN questions.options IS 'JSON array of options for multiple choice questions';
COMMENT ON COLUMN questions.is_active IS 'Whether this question is currently in use';
