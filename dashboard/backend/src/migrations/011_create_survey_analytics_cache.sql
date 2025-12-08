-- ============================================
-- FILE: backend/src/migrations/011_create_survey_analytics_cache.sql
-- ============================================
CREATE TABLE IF NOT EXISTS survey_analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  analytics_data JSONB NOT NULL,
  cached_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_survey_analytics_cache_survey_id ON survey_analytics_cache(survey_id);
CREATE INDEX idx_survey_analytics_cache_expires ON survey_analytics_cache(expires_at);

COMMENT ON TABLE survey_analytics_cache IS 'Cached analytics from Micro-Survey to reduce API calls';

-- Auto-delete expired cache
CREATE OR REPLACE FUNCTION delete_expired_analytics_cache()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM survey_analytics_cache WHERE expires_at < NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_delete_expired_analytics
  AFTER INSERT ON survey_analytics_cache
  EXECUTE FUNCTION delete_expired_analytics_cache();
