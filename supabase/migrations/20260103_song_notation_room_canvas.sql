-- Add notation and lyrics columns to songs table (per-song data)
-- These store chord charts, tabs, sections, and synchronized lyrics

-- Notation data: chords, sections, tab measures, display settings
ALTER TABLE songs ADD COLUMN IF NOT EXISTS notation JSONB DEFAULT NULL;

-- Lyrics data: timed lyric lines for teleprompter
ALTER TABLE songs ADD COLUMN IF NOT EXISTS lyrics JSONB DEFAULT NULL;

-- Add canvas column to rooms table (per-room shared whiteboard)
-- Stores images, annotations, chord diagrams, shapes
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS canvas JSONB DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN songs.notation IS 'Chord charts, sections, and tab notation data for the song';
COMMENT ON COLUMN songs.lyrics IS 'Timed lyric lines for synchronized teleprompter display';
COMMENT ON COLUMN rooms.canvas IS 'Shared canvas elements (images, annotations, chord diagrams) for the room';
