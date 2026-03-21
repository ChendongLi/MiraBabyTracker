-- Mira Baby Tracker — Database Schema
-- Run this in Neon SQL editor or via psql

CREATE TABLE IF NOT EXISTS babies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    chinese_name TEXT,
    birth_date DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    baby_id UUID NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('feed', 'diaper', 'sleep', 'outdoor', 'bath', 'unknown')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_minutes INT,
    raw_input TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feed_details (
    event_id UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    method TEXT CHECK (method IN ('breast', 'bottle', 'solid')),
    amount_ml INT
);

CREATE TABLE IF NOT EXISTS diaper_details (
    event_id UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    diaper_type TEXT CHECK (diaper_type IN ('wet', 'soiled', 'mixed')),
    color TEXT,
    notes TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_events_baby_id ON events(baby_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
