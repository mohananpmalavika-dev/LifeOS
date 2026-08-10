-- Calendar Intelligence Database Schema

-- Calendar Events Table
CREATE TABLE IF NOT EXISTS calendar_events (
  event_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  
  title TEXT,
  description TEXT,
  
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  timezone TEXT,
  
  location_name TEXT,
  location_address TEXT,
  location_latitude REAL,
  location_longitude REAL,
  
  organizer_name TEXT,
  organizer_email TEXT,
  
  status TEXT DEFAULT 'CONFIRMED',
  visibility TEXT DEFAULT 'PUBLIC',
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_state TEXT DEFAULT 'NEW',
  
  UNIQUE(source, source_event_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_source ON calendar_events(source);
CREATE INDEX IF NOT EXISTS idx_calendar_events_sync_state ON calendar_events(sync_state);

-- Calendar Event Attendees
CREATE TABLE IF NOT EXISTS calendar_event_attendees (
  event_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  response_status TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (event_id) REFERENCES calendar_events(event_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attendees_event_id ON calendar_event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_attendees_email ON calendar_event_attendees(email);

-- Travel History Table
CREATE TABLE IF NOT EXISTS travel_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  origin_place_id TEXT NOT NULL,
  destination_place_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  
  duration_minutes INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  day_of_week INTEGER,
  hour_of_day INTEGER,
  conditions TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (origin_place_id) REFERENCES entities(entity_id),
  FOREIGN KEY (destination_place_id) REFERENCES entities(entity_id)
);

CREATE INDEX IF NOT EXISTS idx_travel_history_route ON travel_history(origin_place_id, destination_place_id, mode);
CREATE INDEX IF NOT EXISTS idx_travel_history_timestamp ON travel_history(timestamp);

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
  document_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  path TEXT,
  
  expiry_date TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expiry_date);

-- Document Tags Table
CREATE TABLE IF NOT EXISTS document_tags (
  document_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  PRIMARY KEY (document_id, tag),
  FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag);

-- Document Usage History
CREATE TABLE IF NOT EXISTS document_usage_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  document_type TEXT NOT NULL,
  was_required INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_doc_usage_event_type ON document_usage_history(event_type);
CREATE INDEX IF NOT EXISTS idx_doc_usage_doc_type ON document_usage_history(document_type);

-- Calendar Event Enrichments (cached enrichment data)
CREATE TABLE IF NOT EXISTS calendar_event_enrichments (
  event_id TEXT PRIMARY KEY,
  
  event_type TEXT,
  event_type_confidence REAL,
  
  importance_score REAL,
  flexibility_score REAL,
  
  has_travel_requirement INTEGER DEFAULT 0,
  travel_duration_min INTEGER,
  
  has_preparation_required INTEGER DEFAULT 0,
  preparation_minutes INTEGER,
  
  enriched_at TEXT NOT NULL,
  enrichment_version TEXT NOT NULL,
  
  metadata TEXT, -- JSON blob for additional data
  
  FOREIGN KEY (event_id) REFERENCES calendar_events(event_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_enrichments_event_type ON calendar_event_enrichments(event_type);
CREATE INDEX IF NOT EXISTS idx_enrichments_importance ON calendar_event_enrichments(importance_score);

-- Schedule Conflicts (cached conflict data)
CREATE TABLE IF NOT EXISTS schedule_conflicts (
  conflict_id TEXT PRIMARY KEY,
  conflict_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence REAL NOT NULL,
  
  event1_id TEXT NOT NULL,
  event2_id TEXT,
  
  description TEXT NOT NULL,
  reason TEXT NOT NULL,
  
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved INTEGER DEFAULT 0,
  resolved_at TEXT,
  
  FOREIGN KEY (event1_id) REFERENCES calendar_events(event_id) ON DELETE CASCADE,
  FOREIGN KEY (event2_id) REFERENCES calendar_events(event_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conflicts_event1 ON schedule_conflicts(event1_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_event2 ON schedule_conflicts(event2_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_type ON schedule_conflicts(conflict_type);
CREATE INDEX IF NOT EXISTS idx_conflicts_severity ON schedule_conflicts(severity);
CREATE INDEX IF NOT EXISTS idx_conflicts_resolved ON schedule_conflicts(resolved);
