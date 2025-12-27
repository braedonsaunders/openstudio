-- Add ownership and activity tracking fields to user_tracks table
-- This allows tracks to persist when users leave and be reassigned or deleted

-- Add owner tracking columns
ALTER TABLE user_tracks
ADD COLUMN IF NOT EXISTS owner_user_id TEXT,
ADD COLUMN IF NOT EXISTS owner_user_name TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Set owner_user_id to user_id for existing records
UPDATE user_tracks SET owner_user_id = user_id WHERE owner_user_id IS NULL;

-- Create index for active tracks lookup
CREATE INDEX IF NOT EXISTS idx_user_tracks_active ON user_tracks(room_id, is_active);

-- Create index for owner lookup (for reassigning on rejoin)
CREATE INDEX IF NOT EXISTS idx_user_tracks_owner ON user_tracks(room_id, owner_user_id);
