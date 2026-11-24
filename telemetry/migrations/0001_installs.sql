CREATE TABLE IF NOT EXISTS installs (
  install_hash TEXT PRIMARY KEY NOT NULL,
  first_seen INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS installs_first_seen_idx ON installs(first_seen);
