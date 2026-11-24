CREATE TABLE IF NOT EXISTS shared_playlists (
  share_id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  playlist_name TEXT NOT NULL,
  tracks_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS shared_playlists_owner_idx ON shared_playlists(owner_id, created_at);
