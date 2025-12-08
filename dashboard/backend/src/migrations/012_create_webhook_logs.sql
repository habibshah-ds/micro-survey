-- ============================================
-- FILE: backend/src/migrations/012_create_webhook_logs.sql
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  signature VARCHAR(255),
  verified BOOLEAN DEFAULT FALSE,
  processed BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX idx_webhook_logs_type ON webhook_logs(webhook_type);
CREATE INDEX idx_webhook_logs_processed ON webhook_logs(processed, created_at);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

COMMENT ON TABLE webhook_logs IS 'Logs of incoming webhooks from Micro-Survey';
