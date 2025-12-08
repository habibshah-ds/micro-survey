-- ============================================
-- FILE: backend/src/migrations/019_create_survey_events.sql
-- Create events table for analytics tracking
-- ============================================

-- Survey events table for tracking user interactions
CREATE TABLE IF NOT EXISTS survey_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('survey_view', 'survey_start', 'survey_submit')),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_survey_events_survey_id ON survey_events(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_events_tenant_id ON survey_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_survey_events_type ON survey_events(event_type);
CREATE INDEX IF NOT EXISTS idx_survey_events_created_at ON survey_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_events_session ON survey_events(session_id) WHERE session_id IS NOT NULL;

-- Composite index for aggregation queries
CREATE INDEX IF NOT EXISTS idx_survey_events_survey_type_date 
  ON survey_events(survey_id, event_type, created_at DESC);

-- Enhance survey_analytics_cache table
ALTER TABLE survey_analytics_cache 
  ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS starts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS question_stats JSONB DEFAULT '{}';

-- Create index on survey_analytics_cache
CREATE INDEX IF NOT EXISTS idx_survey_analytics_cache_survey 
  ON survey_analytics_cache(survey_id, expires_at DESC);

-- Comments
COMMENT ON TABLE survey_events IS 'Tracks user interactions with surveys for analytics';
COMMENT ON COLUMN survey_events.event_type IS 'Type of event: survey_view, survey_start, survey_submit';
COMMENT ON COLUMN survey_events.metadata IS 'Additional event data: device, browser, IP, etc.';
COMMENT ON COLUMN survey_analytics_cache.views IS 'Cached view count';
COMMENT ON COLUMN survey_analytics_cache.starts IS 'Cached start count';
COMMENT ON COLUMN survey_analytics_cache.completions IS 'Cached completion count';
COMMENT ON COLUMN survey_analytics_cache.question_stats IS 'Cached question-level analytics';

-- Function to auto-cleanup old events (optional, run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_survey_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete events older than 90 days
  DELETE FROM survey_events 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_survey_events IS 'Cleanup survey events older than 90 days';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Analytics events table created successfully';
  RAISE NOTICE '   - survey_events table with indexes';
  RAISE NOTICE '   - Enhanced survey_analytics_cache';
  RAISE NOTICE '   - Cleanup function available';
END $$;
