-- Add color and icon columns to rooms table for room appearance customization
-- These columns are used for visual customization in room listings and headers

-- Add color column for room color theme (defaults to 'indigo')
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'indigo';

-- Add icon column for room icon (defaults to 'music')
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'music';

-- Create index on color for potential filtering by color
CREATE INDEX IF NOT EXISTS idx_rooms_color ON rooms(color);
