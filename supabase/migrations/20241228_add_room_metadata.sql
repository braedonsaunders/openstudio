-- Add missing metadata columns to rooms table
-- These columns are used for room discovery and browsing features

-- Add description column for room descriptions
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS description TEXT;

-- Add genre column for music genre categorization
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS genre TEXT;

-- Add tags column for searchable tags (stored as JSONB array)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS tags JSONB;

-- Add rules column for room-specific rules
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS rules TEXT;

-- Add creator_name column for displaying creator's display name
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS creator_name TEXT;

-- Add creator_username column for displaying creator's username
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS creator_username TEXT;

-- Add last_activity column for tracking when room was last active
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW();

-- Create index on genre for faster filtering
CREATE INDEX IF NOT EXISTS idx_rooms_genre ON rooms(genre);

-- Create index on last_activity for sorting by activity
CREATE INDEX IF NOT EXISTS idx_rooms_last_activity ON rooms(last_activity DESC);

-- Create index on is_public for faster public room queries
CREATE INDEX IF NOT EXISTS idx_rooms_is_public ON rooms(is_public) WHERE is_public = true;
