-- ============================================
-- FILE: backend/src/migrations/017_enhance_auth_security.sql (FIXED)
-- Enhanced authentication with token rotation and password reset
-- ============================================

-- Add token security columns to refresh_tokens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'refresh_tokens' AND column_name = 'token_hash'
  ) THEN
    ALTER TABLE refresh_tokens ADD COLUMN token_hash VARCHAR(64);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'refresh_tokens' AND column_name = 'created_by_ip'
  ) THEN
    ALTER TABLE refresh_tokens ADD COLUMN created_by_ip INET;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'refresh_tokens' AND column_name = 'revoked_at'
  ) THEN
    ALTER TABLE refresh_tokens ADD COLUMN revoked_at TIMESTAMP;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'refresh_tokens' AND column_name = 'revoked_by_ip'
  ) THEN
    ALTER TABLE refresh_tokens ADD COLUMN revoked_by_ip INET;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'refresh_tokens' AND column_name = 'replaced_by_token'
  ) THEN
    ALTER TABLE refresh_tokens ADD COLUMN replaced_by_token UUID;
  END IF;
END $$;

-- Create index on token_hash for fast lookups (FIXED - removed NOW() from predicate)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash 
  ON refresh_tokens(token_hash) 
  WHERE revoked_at IS NULL;

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked 
  ON refresh_tokens(revoked_at, expires_at);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by_ip INET
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user 
  ON password_reset_tokens(user_id);

-- FIXED: Removed NOW() from index predicate - use separate index
CREATE INDEX IF NOT EXISTS idx_password_reset_hash 
  ON password_reset_tokens(token_hash) 
  WHERE used_at IS NULL;

-- Additional index for expired tokens cleanup
CREATE INDEX IF NOT EXISTS idx_password_reset_expires 
  ON password_reset_tokens(expires_at);

COMMENT ON TABLE password_reset_tokens IS 'Secure password reset tokens';
COMMENT ON COLUMN password_reset_tokens.token_hash IS 'SHA-256 hash of reset token';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'Timestamp when token was used';

-- Cleanup function for expired tokens (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired refresh tokens older than 30 days
  DELETE FROM refresh_tokens 
  WHERE expires_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete expired/used password reset tokens older than 7 days
  DELETE FROM password_reset_tokens 
  WHERE (expires_at < NOW() - INTERVAL '7 days' OR used_at IS NOT NULL);
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_tokens IS 'Cleanup expired authentication tokens';

-- Migration for existing refresh_tokens (populate token_hash from token)
DO $$
BEGIN
  -- Only run if token_hash column is empty
  IF EXISTS (
    SELECT 1 FROM refresh_tokens WHERE token_hash IS NULL LIMIT 1
  ) THEN
    UPDATE refresh_tokens 
    SET token_hash = encode(digest(token, 'sha256'), 'hex')
    WHERE token_hash IS NULL AND token IS NOT NULL;
    
    RAISE NOTICE 'Migrated % existing refresh tokens', 
      (SELECT COUNT(*) FROM refresh_tokens WHERE token_hash IS NOT NULL);
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Authentication security enhancements applied';
  RAISE NOTICE '   - Token hashing enabled';
  RAISE NOTICE '   - Password reset tokens table created';
  RAISE NOTICE '   - Cleanup function created';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: Update your application code to use token hashing';
  RAISE NOTICE 'Run cleanup periodically: SELECT cleanup_expired_tokens();';
END $$;
