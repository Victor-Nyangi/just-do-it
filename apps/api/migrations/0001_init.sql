-- Journey *definitions* deliberately do not live here. The repo is
-- authoritative for what a journey is — the client merges fixture definitions
-- over stored state, so a commit that edits `journeys.json` reaches a browser
-- that already has data. This database stores only what a person did about
-- them: which journeys they started, and which activities they ticked.

CREATE TABLE IF NOT EXISTS enrollments (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  journey_id  TEXT NOT NULL,
  start_date  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS enrollments_by_user ON enrollments (user_id);

-- (enrollment_id, day_index, activity_id) is the natural key, which is what
-- makes a toggle safe to retry: the same request twice cannot produce two rows.
-- `user_id` is carried for scoping and is written from the verified session,
-- never from the request body.
CREATE TABLE IF NOT EXISTS completions (
  enrollment_id TEXT NOT NULL,
  day_index     INTEGER NOT NULL,
  activity_id   TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  completed_at  TEXT NOT NULL,
  PRIMARY KEY (enrollment_id, day_index, activity_id)
);

CREATE INDEX IF NOT EXISTS completions_by_user ON completions (user_id);
CREATE INDEX IF NOT EXISTS completions_by_enrollment ON completions (enrollment_id);
