-- ============================================
-- FILE: backend/src/migrations/016_create_billing_tables.sql
-- Complete Lemon Squeezy billing schema
-- ============================================

-- Plans table (your pricing tiers)
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  
  -- Lemon Squeezy variant IDs (one for monthly, one for yearly)
  ls_monthly_variant_id VARCHAR(50),
  ls_yearly_variant_id VARCHAR(50),
  
  -- Pricing
  monthly_price_cents INTEGER NOT NULL,
  yearly_price_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Limits
  surveys_limit INTEGER DEFAULT 10,
  responses_limit INTEGER DEFAULT 1000,
  team_members_limit INTEGER DEFAULT 1,
  
  -- Features (JSON array)
  features JSONB DEFAULT '[]',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Owner (can be user or tenant)
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Plan
  plan_id UUID NOT NULL REFERENCES plans(id),
  
  -- Lemon Squeezy IDs
  ls_subscription_id VARCHAR(50) UNIQUE NOT NULL,
  ls_customer_id VARCHAR(50),
  ls_order_id VARCHAR(50),
  ls_variant_id VARCHAR(50) NOT NULL,
  ls_product_id VARCHAR(50),
  
  -- Subscription details
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  billing_cycle VARCHAR(20) NOT NULL, -- 'monthly' or 'yearly'
  
  -- Dates
  trial_ends_at TIMESTAMP,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  renews_at TIMESTAMP,
  ends_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  
  -- Payment
  payment_method VARCHAR(50),
  card_last4 VARCHAR(4),
  card_brand VARCHAR(20),
  
  -- Usage tracking
  surveys_used INTEGER DEFAULT 0,
  responses_used INTEGER DEFAULT 0,
  usage_reset_at TIMESTAMP DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT check_owner CHECK (user_id IS NOT NULL OR tenant_id IS NOT NULL),
  CONSTRAINT check_status CHECK (status IN ('active', 'past_due', 'cancelled', 'expired', 'paused', 'on_trial'))
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  
  -- Lemon Squeezy
  ls_order_id VARCHAR(50) UNIQUE NOT NULL,
  ls_invoice_url TEXT,
  
  -- Details
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) NOT NULL,
  
  -- Billing info
  billing_email VARCHAR(255),
  billing_name VARCHAR(255),
  billing_address JSONB,
  
  -- Dates
  invoice_date TIMESTAMP NOT NULL,
  paid_at TIMESTAMP,
  refunded_at TIMESTAMP,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT check_invoice_status CHECK (status IN ('pending', 'paid', 'failed', 'refunded'))
);

-- Webhook events log
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(100) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Usage logs (for detailed tracking)
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL, -- 'survey', 'response', 'team_member'
  resource_id UUID,
  amount INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_ls_subscription_id ON subscriptions(ls_subscription_id);
CREATE INDEX idx_subscriptions_renews_at ON subscriptions(renews_at);
CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed, created_at);
CREATE INDEX idx_usage_logs_subscription_id ON usage_logs(subscription_id, created_at DESC);

-- Add billing fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ls_customer_id VARCHAR(50);

-- Add billing fields to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ls_customer_id VARCHAR(50);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default plans
INSERT INTO plans (name, slug, description, monthly_price_cents, yearly_price_cents, surveys_limit, responses_limit, team_members_limit, features, sort_order, is_active) VALUES
  ('Free', 'free', 'Perfect for trying out', 0, 0, 3, 100, 1, '["3 surveys", "100 responses/month", "Basic analytics", "Email support"]', 0, true),
  ('Starter', 'starter', 'For small projects', 1900, 19200, 10, 1000, 3, '["10 surveys", "1,000 responses/month", "Advanced analytics", "Priority support", "Custom branding"]', 1, true),
  ('Pro', 'pro', 'For growing businesses', 4900, 49920, 50, 10000, 10, '["50 surveys", "10,000 responses/month", "Advanced analytics", "Priority support", "Custom branding", "API access", "Webhooks"]', 2, true),
  ('Enterprise', 'enterprise', 'For large organizations', 14900, 149040, -1, -1, -1, '["Unlimited surveys", "Unlimited responses", "Advanced analytics", "Dedicated support", "Custom branding", "API access", "Webhooks", "SSO", "SLA"]', 3, true)
ON CONFLICT (slug) DO NOTHING;

-- Comments
COMMENT ON TABLE plans IS 'Subscription plans and pricing tiers';
COMMENT ON TABLE subscriptions IS 'Active subscriptions from Lemon Squeezy';
COMMENT ON TABLE invoices IS 'Payment invoices and receipts';
COMMENT ON TABLE webhook_events IS 'Lemon Squeezy webhook event log';
COMMENT ON TABLE usage_logs IS 'Detailed usage tracking for billing';

COMMENT ON COLUMN subscriptions.status IS 'active, past_due, cancelled, expired, paused, on_trial';
COMMENT ON COLUMN subscriptions.surveys_used IS 'Surveys created this billing period';
COMMENT ON COLUMN subscriptions.responses_used IS 'Responses received this billing period';
