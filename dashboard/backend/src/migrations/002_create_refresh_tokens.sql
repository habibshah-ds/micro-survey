CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

COMMENT ON TABLE refresh_tokens IS 'Stores JWT refresh tokens for user sessions';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'Token expiration timestamp';

-- Auto-delete expired tokens (cleanup trigger)
CREATE OR REPLACE FUNCTION delete_expired_refresh_tokens() 
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM refresh_tokens WHERE expires_at < NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_delete_expired_tokens
  AFTER INSERT ON refresh_tokens
  EXECUTE FUNCTION delete_expired_refresh_tokens();
