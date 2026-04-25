-- Allow multiple Cloudflare Calls tracks per user in a room.
-- The application stores one row per published track name so listeners can pull
-- individual performer tracks instead of being limited to one mixed stream.

ALTER TABLE room_webrtc_sessions
  DROP CONSTRAINT IF EXISTS room_webrtc_sessions_room_id_user_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'room_webrtc_sessions_room_id_track_name_key'
  ) THEN
    ALTER TABLE room_webrtc_sessions
      ADD CONSTRAINT room_webrtc_sessions_room_id_track_name_key UNIQUE (room_id, track_name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_room_webrtc_sessions_room_user
  ON room_webrtc_sessions(room_id, user_id);
