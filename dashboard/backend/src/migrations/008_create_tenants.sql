-- ============================================
-- FILE: backend/src/migrations/008_create_tenants.sql
-- ============================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  microsurvey_base_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_owner_id ON tenants(owner_id);
CREATE INDEX idx_tenants_is_active ON tenants(is_active);

COMMENT ON TABLE tenants IS 'Multi-tenant accounts for the dashboard';
COMMENT ON COLUMN tenants.microsurvey_base_url IS 'Optional custom Micro-Survey endpoint per tenant';
