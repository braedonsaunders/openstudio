-- Room Invitations System Migration
-- Adds support for inviting users to private rooms

-- ============================================
-- 1. Room Invitations Table
-- ============================================

CREATE TABLE IF NOT EXISTS room_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  invited_user_id TEXT,
  invited_email TEXT,
  invited_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  invite_code TEXT UNIQUE,
  message TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Either user_id, email, or invite_code must be set
  CONSTRAINT valid_invite_target CHECK (
    invited_user_id IS NOT NULL OR
    invited_email IS NOT NULL OR
    invite_code IS NOT NULL
  )
);

-- ============================================
-- 2. Indexes for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_room_invitations_room_id ON room_invitations(room_id);
CREATE INDEX IF NOT EXISTS idx_room_invitations_invited_user_id ON room_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_room_invitations_invited_email ON room_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_room_invitations_invite_code ON room_invitations(invite_code);
CREATE INDEX IF NOT EXISTS idx_room_invitations_status ON room_invitations(status);
CREATE INDEX IF NOT EXISTS idx_room_invitations_expires_at ON room_invitations(expires_at) WHERE status = 'pending';

-- ============================================
-- 3. Row Level Security (RLS)
-- ============================================

ALTER TABLE room_invitations ENABLE ROW LEVEL SECURITY;

-- Users can view invitations sent to them
CREATE POLICY "Users can view their own invitations"
  ON room_invitations FOR SELECT
  USING (
    invited_user_id = auth.uid()::TEXT OR
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Room moderators can view all invitations for their room
CREATE POLICY "Room moderators can view room invitations"
  ON room_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = room_invitations.room_id
      AND room_members.user_id = auth.uid()::TEXT
      AND room_members.role IN ('owner', 'co-host')
    )
  );

-- Room moderators can create invitations
CREATE POLICY "Room moderators can create invitations"
  ON room_invitations FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()::TEXT AND
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = room_invitations.room_id
      AND room_members.user_id = auth.uid()::TEXT
      AND room_members.role IN ('owner', 'co-host')
    )
  );

-- Invited users can update their invitation status (accept/decline)
CREATE POLICY "Invited users can respond to invitations"
  ON room_invitations FOR UPDATE
  USING (
    invited_user_id = auth.uid()::TEXT OR
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    status IN ('accepted', 'declined')
  );

-- Room moderators can revoke invitations
CREATE POLICY "Room moderators can revoke invitations"
  ON room_invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = room_invitations.room_id
      AND room_members.user_id = auth.uid()::TEXT
      AND room_members.role IN ('owner', 'co-host')
    )
  )
  WITH CHECK (
    status = 'revoked'
  );

-- Room moderators can delete invitations
CREATE POLICY "Room moderators can delete invitations"
  ON room_invitations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = room_invitations.room_id
      AND room_members.user_id = auth.uid()::TEXT
      AND room_members.role IN ('owner', 'co-host')
    )
  );

-- ============================================
-- 4. Helper Functions
-- ============================================

-- Function to generate invite codes (avoids confusing characters)
CREATE OR REPLACE FUNCTION generate_invite_code(length INT DEFAULT 12)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to check if an invitation is valid
CREATE OR REPLACE FUNCTION is_invitation_valid(invitation_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  inv RECORD;
BEGIN
  SELECT * INTO inv FROM room_invitations WHERE id = invitation_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF inv.status != 'pending' THEN
    RETURN FALSE;
  END IF;

  IF inv.expires_at IS NOT NULL AND inv.expires_at < NOW() THEN
    UPDATE room_invitations SET status = 'expired', updated_at = NOW()
    WHERE id = invitation_id;
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending invitations for current user
CREATE OR REPLACE FUNCTION get_my_pending_invitations()
RETURNS TABLE (
  id UUID,
  room_id TEXT,
  room_name TEXT,
  room_color TEXT,
  room_icon TEXT,
  invited_by TEXT,
  inviter_name TEXT,
  inviter_avatar TEXT,
  message TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ri.id,
    ri.room_id,
    r.name AS room_name,
    r.color AS room_color,
    r.icon AS room_icon,
    ri.invited_by,
    u.raw_user_meta_data->>'name' AS inviter_name,
    u.raw_user_meta_data->>'avatar_url' AS inviter_avatar,
    ri.message,
    ri.expires_at,
    ri.created_at
  FROM room_invitations ri
  JOIN rooms r ON r.id = ri.room_id
  JOIN auth.users u ON u.id::TEXT = ri.invited_by
  WHERE ri.status = 'pending'
  AND (
    ri.invited_user_id = auth.uid()::TEXT OR
    ri.invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  AND (ri.expires_at IS NULL OR ri.expires_at > NOW())
  ORDER BY ri.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup function for expired invitations (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE room_invitations
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending'
  AND expires_at IS NOT NULL
  AND expires_at < NOW();

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Comments
-- ============================================

COMMENT ON TABLE room_invitations IS 'Stores room invitations for private rooms';
COMMENT ON COLUMN room_invitations.invited_user_id IS 'User ID of invited user (if known)';
COMMENT ON COLUMN room_invitations.invited_email IS 'Email for inviting users not yet on platform';
COMMENT ON COLUMN room_invitations.invite_code IS 'Shareable code for link-based invitations';
COMMENT ON COLUMN room_invitations.status IS 'pending, accepted, declined, expired, or revoked';
COMMENT ON COLUMN room_invitations.message IS 'Optional personal message from inviter';
