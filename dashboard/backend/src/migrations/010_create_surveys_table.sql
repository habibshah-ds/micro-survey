-- ============================================
-- FILE: backend/src/migrations/010_create_surveys_table.sql
-- ============================================
CREATE TABLE IF NOT EXISTS surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  microsurvey_id VARCHAR(255) UNIQUE,
  survey_key VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  survey_type VARCHAR(50) NOT NULL CHECK (survey_type IN ('poll', 'quiz', 'feedback', 'nps')),
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  published_at TIMESTAMP,
  archived_at TIMESTAMP
);

CREATE INDEX idx_surveys_tenant_id ON surveys(tenant_id);
CREATE INDEX idx_surveys_organization_id ON surveys(organization_id);
CREATE INDEX idx_surveys_microsurvey_id ON surveys(microsurvey_id);
CREATE INDEX idx_surveys_survey_key ON surveys(survey_key);
CREATE INDEX idx_surveys_status ON surveys(status);
CREATE INDEX idx_surveys_created_at ON surveys(created_at DESC);

COMMENT ON TABLE surveys IS 'Surveys managed by Dashboard that integrate with Micro-Survey';
COMMENT ON COLUMN surveys.microsurvey_id IS 'ID returned from Micro-Survey service';
COMMENT ON COLUMN surveys.survey_key IS 'Public key for embedding (from Micro-Survey)';
