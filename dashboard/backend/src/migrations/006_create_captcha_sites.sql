-- ============================================
-- FILE: 006_create_captcha_sites.sql
-- ============================================
CREATE TABLE IF NOT EXISTS captcha_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name VARCHAR(255) NOT NULL,
  site_url VARCHAR(500) NOT NULL,
  site_key VARCHAR(100) UNIQUE NOT NULL,
  site_secret VARCHAR(100) NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_captcha_sites_site_key ON captcha_sites(site_key);
CREATE INDEX idx_captcha_sites_organization_id ON captcha_sites(organization_id);
CREATE INDEX idx_captcha_sites_is_active ON captcha_sites(is_active);

COMMENT ON TABLE captcha_sites IS 'Registered sites for captcha-API integration';
COMMENT ON COLUMN captcha_sites.site_key IS 'Public site key for API authentication';
COMMENT ON COLUMN captcha_sites.site_secret IS 'Secret key for secure operations';
