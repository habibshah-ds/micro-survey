-- ============================================
-- FILE: backend/src/migrations/009_create_tenant_api_keys.sql
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  last_used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_tenant_api_keys_tenant_id ON tenant_api_keys(tenant_id);
CREATE INDEX idx_tenant_api_keys_key_prefix ON tenant_api_keys(key_prefix);
CREATE INDEX idx_tenant_api_keys_revoked ON tenant_api_keys(revoked_at) WHERE revoked_at IS NULL;

COMMENT ON TABLE tenant_api_keys IS 'API keys for Micro-Survey integration per tenant';
COMMENT ON COLUMN tenant_api_keys.key_hash IS 'Peppered hash of the API key';
COMMENT ON COLUMN tenant_api_keys.key_prefix IS 'First 8 chars for identification';
