ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(email COLLATE NOCASE) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_email_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('email_verify', 'password_reset')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_email_tokens_expiry_idx ON auth_email_tokens(expires_at);
CREATE INDEX IF NOT EXISTS auth_email_tokens_user_idx ON auth_email_tokens(user_id, purpose);
