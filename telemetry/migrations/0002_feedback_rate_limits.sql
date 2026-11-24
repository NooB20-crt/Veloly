CREATE TABLE IF NOT EXISTS feedback_rate_limits (
  client_hash TEXT PRIMARY KEY,
  last_sent INTEGER NOT NULL
);
