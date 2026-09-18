CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS club_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT,
    title TEXT NOT NULL,
    year INTEGER,
    runtime_min INTEGER,
    art_url TEXT,
    art_version TEXT,
    message TEXT,
    description TEXT,
    starts_at TEXT NOT NULL,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_club_events_when ON club_events (status, starts_at);

CREATE TABLE IF NOT EXISTS club_rsvps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    person TEXT NOT NULL,
    name TEXT NOT NULL,
    emby_user_id TEXT,
    answer TEXT NOT NULL,
    guests INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (event_id, person)
);

CREATE TABLE IF NOT EXISTS club_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT,
    title TEXT NOT NULL,
    year INTEGER,
    art_version TEXT,
    name TEXT NOT NULL,
    emby_user_id TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_club_suggestions_when ON club_suggestions (created_at);

CREATE TABLE IF NOT EXISTS club_polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    closed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS club_poll_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    item_id TEXT,
    title TEXT NOT NULL,
    year INTEGER,
    art_version TEXT,
    suggestion_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_club_poll_options_poll ON club_poll_options (poll_id, position);

CREATE TABLE IF NOT EXISTS club_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    option_id INTEGER NOT NULL,
    voter TEXT NOT NULL,
    name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (poll_id, voter)
);
