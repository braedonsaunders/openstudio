# Room Permission System - Comprehensive Proposal

## Overview

This proposal outlines a comprehensive permission system that allows room masters (owners) to granularly control what each user can do in a room. The system includes role-based presets with the ability to customize individual permissions.

---

## 1. Permission Categories

### 1.1 Transport & Playback Control
| Permission | Description |
|------------|-------------|
| `transport.play` | Can start playback |
| `transport.pause` | Can pause playback |
| `transport.seek` | Can seek to different position in track |
| `transport.skipTrack` | Can skip to next/previous track |
| `transport.loopControl` | Can enable/disable/adjust looping |

### 1.2 Tempo & Musical Settings
| Permission | Description |
|------------|-------------|
| `tempo.setBpm` | Can change BPM/tempo manually |
| `tempo.setSource` | Can change tempo source (manual/track/auto-detect/tap) |
| `tempo.setTimeSignature` | Can change time signature |
| `tempo.setKey` | Can change key |
| `tempo.setScale` | Can change scale (major/minor) |
| `tempo.metronomeControl` | Can control metronome (on/off, volume, click type) |

### 1.3 Song & Track Management
| Permission | Description |
|------------|-------------|
| `tracks.addToQueue` | Can add tracks to the queue/setlist |
| `tracks.removeFromQueue` | Can remove tracks from queue |
| `tracks.reorderQueue` | Can reorder tracks in queue |
| `tracks.editMetadata` | Can edit track name, artist, BPM, key info |
| `tracks.uploadBackingTrack` | Can upload new backing tracks |
| `tracks.createSong` | Can create new songs on timeline |
| `tracks.editSongArrangement` | Can edit song arrangement/sections on timeline |
| `tracks.deleteSong` | Can delete songs |

### 1.4 Mixer & Audio Control
| Permission | Description |
|------------|-------------|
| `mixer.stemControl` | Can adjust stem volumes (vocals, drums, bass, other) |
| `mixer.stemToggle` | Can mute/unmute individual stems |
| `mixer.masterVolume` | Can adjust master output volume |
| `mixer.ownTrackVolume` | Can adjust their own track volume |
| `mixer.otherUserVolume` | Can adjust other users' track volumes |
| `mixer.muteOtherUsers` | Can mute/unmute other users |

### 1.5 Effects & Processing
| Permission | Description |
|------------|-------------|
| `effects.ownEffects` | Can modify effects on their own track |
| `effects.masterEffects` | Can modify master/room effects |
| `effects.applyPresets` | Can apply effect presets |
| `effects.savePresets` | Can save new effect presets |

### 1.6 Recording & Loop Creation
| Permission | Description |
|------------|-------------|
| `recording.record` | Can arm and record audio |
| `recording.createLoop` | Can create loops from recordings |
| `recording.editLoops` | Can edit existing loops |
| `recording.deleteLoops` | Can delete loops |

### 1.7 AI Features
| Permission | Description |
|------------|-------------|
| `ai.stemSeparation` | Can use stem separation feature |
| `ai.generateMusic` | Can use AI music generation (Mureka) |
| `ai.generateLyrics` | Can use AI lyrics generation |
| `ai.useAssistant` | Can use AI assistant features |

### 1.8 Communication
| Permission | Description |
|------------|-------------|
| `chat.sendMessages` | Can send text messages in chat |
| `chat.sendReactions` | Can send emoji reactions |
| `chat.shareLinks` | Can share links in chat |
| `chat.voiceChat` | Can participate in voice chat |
| `chat.videoChat` | Can participate in video chat |
| `chat.screenShare` | Can share their screen |

### 1.9 Room Management (Owner/Moderator Only)
| Permission | Description |
|------------|-------------|
| `room.editSettings` | Can edit room settings |
| `room.editName` | Can edit room name/description |
| `room.manageUsers` | Can kick/ban users |
| `room.manageRoles` | Can change other users' roles/permissions |
| `room.inviteUsers` | Can create invite links |

---

## 2. Role-Based Presets

### 2.1 Default Roles

```typescript
type RoomRole = 'owner' | 'co-host' | 'performer' | 'member' | 'listener';
```

| Role | Description |
|------|-------------|
| **Owner** | Room creator with full control |
| **Co-Host** | Trusted user with nearly full control (cannot delete room or remove owner) |
| **Performer** | Can play, record, and control their own audio |
| **Member** | Can participate in chat and basic interactions |
| **Listener** | Can only listen and view, minimal interaction |

### 2.2 Role Permission Matrix

| Permission Category | Owner | Co-Host | Performer | Member | Listener |
|---------------------|-------|---------|-----------|--------|----------|
| **Transport** | ✅ All | ✅ All | ❌ | ❌ | ❌ |
| **Tempo/Key** | ✅ All | ✅ All | ❌ | ❌ | ❌ |
| **Track Management** | ✅ All | ✅ All | ✅ Add only | ❌ | ❌ |
| **Mixer - Own** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Mixer - Others** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Effects - Own** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Effects - Master** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Recording** | ✅ All | ✅ All | ✅ All | ❌ | ❌ |
| **AI Features** | ✅ All | ✅ All | ✅ Limited | ❌ | ❌ |
| **Chat** | ✅ All | ✅ All | ✅ All | ✅ All | ✅ Text only |
| **Room Management** | ✅ All | ✅ Limited | ❌ | ❌ | ❌ |

---

## 3. Type Definitions

```typescript
// src/types/permissions.ts

export interface RoomPermissions {
  // Transport & Playback
  transport: {
    play: boolean;
    pause: boolean;
    seek: boolean;
    skipTrack: boolean;
    loopControl: boolean;
  };

  // Tempo & Musical Settings
  tempo: {
    setBpm: boolean;
    setSource: boolean;
    setTimeSignature: boolean;
    setKey: boolean;
    setScale: boolean;
    metronomeControl: boolean;
  };

  // Track Management
  tracks: {
    addToQueue: boolean;
    removeFromQueue: boolean;
    reorderQueue: boolean;
    editMetadata: boolean;
    uploadBackingTrack: boolean;
    createSong: boolean;
    editSongArrangement: boolean;
    deleteSong: boolean;
  };

  // Mixer Controls
  mixer: {
    stemControl: boolean;
    stemToggle: boolean;
    masterVolume: boolean;
    ownTrackVolume: boolean;
    otherUserVolume: boolean;
    muteOtherUsers: boolean;
  };

  // Effects
  effects: {
    ownEffects: boolean;
    masterEffects: boolean;
    applyPresets: boolean;
    savePresets: boolean;
  };

  // Recording
  recording: {
    record: boolean;
    createLoop: boolean;
    editLoops: boolean;
    deleteLoops: boolean;
  };

  // AI Features
  ai: {
    stemSeparation: boolean;
    generateMusic: boolean;
    generateLyrics: boolean;
    useAssistant: boolean;
  };

  // Communication
  chat: {
    sendMessages: boolean;
    sendReactions: boolean;
    shareLinks: boolean;
    voiceChat: boolean;
    videoChat: boolean;
    screenShare: boolean;
  };

  // Room Management
  room: {
    editSettings: boolean;
    editName: boolean;
    manageUsers: boolean;
    manageRoles: boolean;
    inviteUsers: boolean;
  };
}

export type RoomRole = 'owner' | 'co-host' | 'performer' | 'member' | 'listener';

export interface RoomMember {
  userId: string;
  userName: string;
  userAvatar?: string;
  role: RoomRole;
  customPermissions?: Partial<RoomPermissions>; // Override specific permissions
  joinedAt: string;
  lastActiveAt: string;
}

// Default permission presets for each role
export const ROLE_PERMISSIONS: Record<RoomRole, RoomPermissions> = {
  owner: { /* all true */ },
  'co-host': { /* mostly true */ },
  performer: { /* recording + own controls */ },
  member: { /* chat + basic controls */ },
  listener: { /* view only */ },
};
```

---

## 4. Database Schema

### 4.1 New Migration: Room Members with Permissions

```sql
-- supabase/migrations/20241229_room_permissions.sql

-- Room members with roles and permissions
CREATE TABLE room_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'co-host', 'performer', 'member', 'listener')),
  custom_permissions JSONB,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by TEXT,
  is_banned BOOLEAN DEFAULT FALSE,
  ban_reason TEXT,
  UNIQUE(room_id, user_id)
);

-- Index for quick lookups
CREATE INDEX idx_room_members_room_id ON room_members(room_id);
CREATE INDEX idx_room_members_user_id ON room_members(user_id);

-- Default room permission settings (for new users)
ALTER TABLE rooms ADD COLUMN default_role TEXT DEFAULT 'member';
ALTER TABLE rooms ADD COLUMN default_permissions JSONB;
ALTER TABLE rooms ADD COLUMN require_approval BOOLEAN DEFAULT FALSE;
```

---

## 5. UI Design - Permissions Panel

### 5.1 Panel Location & Access

The Permissions panel will be added as a new tab in the right-hand panel dock, accessible only to users with `room.manageRoles` permission (typically Owner and Co-Hosts).

### 5.2 Panel Structure

```
┌─────────────────────────────────────────────────────────────┐
│  [👥 Members] [🎵 Setlist] [📊 Analysis] [💬 Chat] [✨ AI] [⚙️ Perms] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Room Permissions                              [🔒 Lock All]│
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ┌─ Default Role for New Users ──────────────────────────┐  │
│  │  [Member ▼]  When users join, they receive this role  │  │
│  │  ☐ Require approval before joining                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Room Members (4) ────────────────────────────────────┐  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ 👤 Alex (You)           [Owner ▼] [Customize]  │  │  │
│  │  │    Room creator                                 │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ 👤 Jamie                [Co-Host ▼] [Customize]│  │  │
│  │  │    Joined 2 hours ago          [Kick] [Ban]    │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ 👤 Sam                  [Performer ▼] [Customize]│ │  │
│  │  │    Joined 45 mins ago          [Kick] [Ban]    │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ 👤 Chris                [Listener ▼] [Customize]│  │  │
│  │  │    Joined just now             [Kick] [Ban]    │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  [📋 Manage Role Presets]                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Customize Permission Modal

When clicking [Customize] on a user:

```
┌─────────────────────────────────────────────────────────────┐
│  Customize Permissions for Jamie            [×]            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Base Role: [Co-Host ▼]                                    │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ▼ Transport & Playback                                    │
│    ┌──────────────────────────────────────────────────────┐ │
│    │ ☑ Play                    ☑ Pause                  │ │
│    │ ☑ Seek                    ☑ Skip Track             │ │
│    │ ☑ Loop Control                                      │ │
│    └──────────────────────────────────────────────────────┘ │
│                                                             │
│  ▼ Tempo & Musical Settings                                │
│    ┌──────────────────────────────────────────────────────┐ │
│    │ ☑ Set BPM                 ☑ Set Key                │ │
│    │ ☑ Set Scale               ☐ Time Signature ⚠️       │ │
│    │ ☑ Tempo Source            ☑ Metronome Control      │ │
│    └──────────────────────────────────────────────────────┘ │
│         ⚠️ Overridden from role default                    │
│                                                             │
│  ▶ Track Management                           [All enabled]│
│  ▶ Mixer Controls                             [All enabled]│
│  ▶ Effects                                    [All enabled]│
│  ▶ Recording                                  [All enabled]│
│  ▶ AI Features                                [All enabled]│
│  ▶ Communication                              [All enabled]│
│  ▶ Room Management                            [3 of 5]     │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  [Reset to Role Default]                   [Save Changes]  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Role Presets Management

```
┌─────────────────────────────────────────────────────────────┐
│  Manage Role Presets                           [×]         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Built-in Roles (cannot delete):                           │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 👑 Owner          Full control          [View/Edit] │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🎤 Co-Host        Management access     [View/Edit] │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🎸 Performer      Recording & playing   [View/Edit] │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 👤 Member         Basic participation   [View/Edit] │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 👁 Listener       View only             [View/Edit] │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Custom Roles:                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🎹 DJ             Custom preset     [Edit] [Delete] │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  [+ Create Custom Role]                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Implementation Components

### 6.1 New Files to Create

```
src/
├── types/
│   └── permissions.ts           # Permission type definitions
│
├── components/daw/
│   ├── permissions-panel.tsx    # Main permissions panel
│   ├── permission-modal.tsx     # User permission customization modal
│   ├── role-presets-modal.tsx   # Role presets management modal
│   └── permission-toggle.tsx    # Reusable permission toggle component
│
├── hooks/
│   └── usePermissions.ts        # Permission checking hook
│
├── stores/
│   └── permissions-store.ts     # Zustand store for permissions state
│
├── lib/
│   └── permissions.ts           # Permission utilities and defaults
│
└── app/api/
    └── rooms/
        └── [roomId]/
            └── permissions/
                └── route.ts     # API endpoints for permission management
```

### 6.2 Files to Modify

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `role` and `permissions` to User interface |
| `src/stores/room-store.ts` | Integrate permission checking |
| `src/components/daw/panel-dock.tsx` | Add Permissions tab |
| `src/components/daw/daw-layout.tsx` | Add 'permissions' to PanelType |
| `src/components/studio/transport-controls.tsx` | Replace `isMaster` with permission checks |
| `src/components/daw/metronome-controls.tsx` | Add permission checks |
| `src/components/daw/setlist-panel.tsx` | Add permission checks for track operations |
| `src/components/daw/mixer-view.tsx` | Add permission checks for mixer |
| `src/components/daw/chat-panel.tsx` | Add permission checks for chat features |
| `src/components/daw/ai-panel.tsx` | Add permission checks for AI features |
| `src/components/daw/audio-chat-panel.tsx` | Add permission checks for voice/video |

---

## 7. usePermissions Hook

```typescript
// src/hooks/usePermissions.ts

import { useRoomStore } from '@/stores/room-store';
import { RoomPermissions } from '@/types/permissions';

export function usePermissions() {
  const { currentUser, roomMembers } = useRoomStore();

  const currentMember = roomMembers?.find(m => m.userId === currentUser?.id);
  const permissions = currentMember?.effectivePermissions;

  // Quick permission checks
  const can = (permission: string): boolean => {
    if (!permissions) return false;
    const [category, action] = permission.split('.');
    return permissions[category]?.[action] ?? false;
  };

  // Category checks
  const canTransport = can('transport.play') || can('transport.pause');
  const canManageTracks = can('tracks.addToQueue') || can('tracks.removeFromQueue');
  const canManageRoom = can('room.manageUsers') || can('room.manageRoles');

  // Role checks
  const isOwner = currentMember?.role === 'owner';
  const isCoHost = currentMember?.role === 'co-host';
  const isPerformer = currentMember?.role === 'performer';
  const isModerator = isOwner || isCoHost;

  return {
    can,
    permissions,
    role: currentMember?.role,
    isOwner,
    isCoHost,
    isPerformer,
    isModerator,
    canTransport,
    canManageTracks,
    canManageRoom,
  };
}
```

---

## 8. Usage Examples

### 8.1 In Transport Controls

```typescript
// Before
disabled={!isMaster || !currentTrack}

// After
const { can } = usePermissions();
disabled={!can('transport.play') || !currentTrack}
```

### 8.2 In Chat Panel

```typescript
const { can } = usePermissions();

{can('chat.sendMessages') ? (
  <ChatInput onSend={handleSend} />
) : (
  <p className="text-muted-foreground text-sm">
    You don't have permission to send messages
  </p>
)}
```

### 8.3 Conditional UI Elements

```typescript
const { canManageRoom } = usePermissions();

// Only show permissions tab to moderators
{canManageRoom && (
  <TabsTrigger value="permissions">Permissions</TabsTrigger>
)}
```

---

## 9. Real-time Sync

Permissions should sync in real-time using the existing Socket.IO infrastructure:

### 9.1 Socket Events

```typescript
// Server -> Client
socket.on('permission:updated', (data: { userId: string; permissions: RoomPermissions }) => {
  // Update local permissions state
});

socket.on('role:changed', (data: { userId: string; newRole: RoomRole }) => {
  // Update user role
});

socket.on('user:kicked', (data: { userId: string; reason?: string }) => {
  // Handle user removal
});

// Client -> Server (owner/co-host only)
socket.emit('permission:update', { userId, permissions });
socket.emit('role:change', { userId, newRole });
socket.emit('user:kick', { userId, reason });
```

---

## 10. Migration Strategy

### Phase 1: Core Implementation
1. Add permission types and defaults
2. Create database migration
3. Implement usePermissions hook
4. Create permissions store

### Phase 2: UI Components
1. Create Permissions panel
2. Create role assignment dropdown
3. Create permission customization modal
4. Add panel to dock

### Phase 3: Permission Integration
1. Update transport controls
2. Update tempo/key controls
3. Update track management
4. Update mixer controls
5. Update chat/communication
6. Update AI features

### Phase 4: Real-time & Polish
1. Implement Socket.IO sync
2. Add permission denied notifications
3. Add UI feedback for disabled features
4. Testing and edge cases

---

## 11. Visual Design Notes

- Use consistent icons for roles (👑 Owner, 🎤 Co-Host, 🎸 Performer, 👤 Member, 👁 Listener)
- Show tooltips on disabled controls explaining "You don't have permission"
- Use subtle visual indicators (opacity, icons) for permission status
- Permission toggles should use the existing toggle component style
- Modal dialogs should match the existing theme (dark mode compatible)
- Use color coding: green = enabled, muted = disabled, yellow = overridden

---

## 12. Security Considerations

1. **Server-side validation**: All permission checks must be validated on the server, not just client
2. **Rate limiting**: Prevent spam of permission change requests
3. **Audit logging**: Log all permission changes for room owners to review
4. **Cascading permissions**: Owner cannot remove their own ownership without transferring first
5. **Ban persistence**: Bans should persist across room sessions

---

## Summary

This permission system provides:
- **9 permission categories** with **38 granular permissions**
- **5 default roles** with customizable presets
- **Per-user permission overrides** for fine-grained control
- **Clean UI** integrated into the existing right panel
- **Real-time synchronization** via Socket.IO
- **Backward compatibility** with existing `isMaster` pattern during migration
