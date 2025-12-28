-- Room Permissions System Migration
-- This migration adds support for granular role-based permissions in rooms

-- ============================================
-- 1. Room Members Table with Roles/Permissions
-- ============================================

CREATE TABLE IF NOT EXISTS room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'co-host', 'performer', 'member', 'listener')),
  custom_permissions JSONB DEFAULT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by TEXT,
  is_banned BOOLEAN DEFAULT FALSE,
  ban_reason TEXT,
  ban_expires_at TIMESTAMPTZ,
  UNIQUE(room_id, user_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_role ON room_members(role);

-- ============================================
-- 2. Add default role and settings to rooms
-- ============================================

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS default_role TEXT DEFAULT 'member' CHECK (default_role IN ('performer', 'member', 'listener'));
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS default_permissions JSONB DEFAULT NULL;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS require_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS allow_guest_join BOOLEAN DEFAULT TRUE;

-- ============================================
-- 3. Room Ban History Table
-- ============================================

CREATE TABLE IF NOT EXISTS room_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  banned_by TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_room_bans_room_id ON room_bans(room_id);
CREATE INDEX IF NOT EXISTS idx_room_bans_user_id ON room_bans(user_id);

-- ============================================
-- 4. Room Permission Change Audit Log
-- ============================================

CREATE TABLE IF NOT EXISTS room_permission_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  target_user_id TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('role_change', 'permission_update', 'kick', 'ban', 'unban')),
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permission_logs_room_id ON room_permission_logs(room_id);
CREATE INDEX IF NOT EXISTS idx_permission_logs_created_at ON room_permission_logs(created_at);

-- ============================================
-- 5. Helper Functions
-- ============================================

-- Function to get a user's effective permissions in a room
CREATE OR REPLACE FUNCTION get_room_member_permissions(p_room_id TEXT, p_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_member room_members%ROWTYPE;
  v_base_permissions JSONB;
BEGIN
  -- Get member record
  SELECT * INTO v_member FROM room_members WHERE room_id = p_room_id AND user_id = p_user_id;

  IF v_member IS NULL THEN
    RETURN NULL;
  END IF;

  -- Base permissions by role (simplified - full logic in application)
  v_base_permissions := CASE v_member.role
    WHEN 'owner' THEN '{"all": true}'::JSONB
    WHEN 'co-host' THEN '{"transport": true, "tempo": true, "tracks": true, "mixer": true, "effects": true, "recording": true, "ai": true, "chat": true, "room": {"manageUsers": true, "manageRoles": true}}'::JSONB
    WHEN 'performer' THEN '{"mixer": {"ownTrackVolume": true}, "effects": {"ownEffects": true}, "recording": true, "chat": true}'::JSONB
    WHEN 'member' THEN '{"mixer": {"ownTrackVolume": true}, "effects": {"ownEffects": true}, "chat": true}'::JSONB
    WHEN 'listener' THEN '{"chat": {"sendMessages": true, "sendReactions": true}}'::JSONB
    ELSE '{}'::JSONB
  END;

  -- Merge custom permissions if any
  IF v_member.custom_permissions IS NOT NULL THEN
    v_base_permissions := v_base_permissions || v_member.custom_permissions;
  END IF;

  RETURN v_base_permissions;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a user is banned from a room
CREATE OR REPLACE FUNCTION is_user_banned_from_room(p_room_id TEXT, p_user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM room_bans
    WHERE room_id = p_room_id
      AND user_id = p_user_id
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Row Level Security (RLS)
-- ============================================

-- Enable RLS on tables
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_permission_logs ENABLE ROW LEVEL SECURITY;

-- Policies for room_members
-- Users can view members of rooms they're in
CREATE POLICY room_members_select_policy ON room_members
  FOR SELECT
  USING (
    user_id = auth.uid()::TEXT
    OR room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid()::TEXT)
  );

-- Only owners and co-hosts can insert/update members
CREATE POLICY room_members_insert_policy ON room_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = room_members.room_id
        AND user_id = auth.uid()::TEXT
        AND role IN ('owner', 'co-host')
    )
    OR user_id = auth.uid()::TEXT -- Users can add themselves when joining
  );

CREATE POLICY room_members_update_policy ON room_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = room_members.room_id
        AND user_id = auth.uid()::TEXT
        AND role IN ('owner', 'co-host')
    )
    OR user_id = auth.uid()::TEXT -- Users can update their own last_active
  );

-- Policies for room_bans
CREATE POLICY room_bans_select_policy ON room_bans
  FOR SELECT
  USING (
    banned_by = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = room_bans.room_id
        AND user_id = auth.uid()::TEXT
        AND role IN ('owner', 'co-host')
    )
  );

CREATE POLICY room_bans_insert_policy ON room_bans
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = room_bans.room_id
        AND user_id = auth.uid()::TEXT
        AND role IN ('owner', 'co-host')
    )
  );

-- Policies for permission logs (read-only for room moderators)
CREATE POLICY permission_logs_select_policy ON room_permission_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = room_permission_logs.room_id
        AND user_id = auth.uid()::TEXT
        AND role IN ('owner', 'co-host')
    )
  );

-- ============================================
-- 7. Comments
-- ============================================

COMMENT ON TABLE room_members IS 'Stores room membership with roles and custom permissions';
COMMENT ON TABLE room_bans IS 'Tracks user bans per room with expiration support';
COMMENT ON TABLE room_permission_logs IS 'Audit log for permission changes in rooms';
COMMENT ON COLUMN room_members.role IS 'User role: owner, co-host, performer, member, listener';
COMMENT ON COLUMN room_members.custom_permissions IS 'JSON object overriding default role permissions';
COMMENT ON COLUMN rooms.default_role IS 'Default role assigned to new users joining the room';
COMMENT ON COLUMN rooms.require_approval IS 'If true, new users need approval from owner/co-host to join';
