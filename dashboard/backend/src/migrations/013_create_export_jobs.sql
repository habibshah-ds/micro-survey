-- ============================================
-- FILE: backend/src/migrations/013_create_export_jobs.sql
-- ============================================
CREATE TABLE IF NOT EXISTS export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  export_type VARCHAR(50) NOT NULL DEFAULT 'csv',
  file_url VARCHAR(1000),
  error_message TEXT,
  requested_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_export_jobs_survey_id ON export_jobs(survey_id);
CREATE INDEX idx_export_jobs_tenant_id ON export_jobs(tenant_id);
CREATE INDEX idx_export_jobs_status ON export_jobs(status, created_at);

COMMENT ON TABLE export_jobs IS 'Track export job requests to Micro-Survey';
