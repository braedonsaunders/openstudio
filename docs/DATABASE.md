# OpenStudio Database Schema

Complete reference for the Supabase PostgreSQL database.

---

## Table of Contents

- [User System](#user-system)
- [Rooms & Sessions](#rooms--sessions)
- [Audio & Tracks](#audio--tracks)
- [Avatar System](#avatar-system)
- [Gamification](#gamification)
- [Social Features](#social-features)
- [System Configuration](#system-configuration)
- [Admin & Moderation](#admin--moderation)
- [Foreign Key Relationships](#foreign-key-relationships)
- [Indexes](#indexes)
- [Schema Update SQL](#schema-update-sql)

---

## User System

### `user_profiles`

Core user data linked to Supabase Auth.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | - | Primary key (matches auth.users.id) |
| `username` | varchar | NO | - | Unique username |
| `display_name` | varchar | NO | - | Display name |
| `bio` | text | YES | `''` | User biography |
| `account_type` | varchar | YES | `'free'` | Subscription tier |
| `is_verified` | bool | YES | `false` | Verified status |
| `is_banned` | bool | YES | `false` | Ban status |
| `ban_reason` | text | YES | - | Reason for ban |
| `ban_expires_at` | timestamptz | YES | - | Ban expiration |
| `total_xp` | int4 | YES | `0` | Total experience points |
| `level` | int4 | YES | `1` | Current level |
| `current_daily_streak` | int4 | YES | `0` | Current streak |
| `longest_daily_streak` | int4 | YES | `0` | Best streak |
| `last_active_date` | date | YES | - | Last activity date |
| `streak_freezes` | int4 | YES | `1` | Available streak freezes |
| `link_spotify` | varchar | YES | - | Spotify profile link |
| `link_soundcloud` | varchar | YES | - | SoundCloud profile link |
| `link_youtube` | varchar | YES | - | YouTube channel link |
| `link_instagram` | varchar | YES | - | Instagram profile link |
| `link_website` | varchar | YES | - | Personal website |
| `profile_visibility` | varchar | YES | `'public'` | Privacy setting |
| `show_stats` | bool | YES | `true` | Show stats publicly |
| `show_activity` | bool | YES | `true` | Show activity publicly |
| `allow_friend_requests` | bool | YES | `true` | Accept friend requests |
| `allow_room_invites` | bool | YES | `true` | Accept room invites |
| `preferences` | jsonb | YES | (see below) | User preferences JSON |
| `created_at` | timestamptz | YES | `now()` | Account creation |
| `updated_at` | timestamptz | YES | `now()` | Last update |
| `last_online_at` | timestamptz | YES | `now()` | Last seen online |

**Default preferences JSON:**
```json
{
  "theme": "dark",
  "accentColor": "#6366f1",
  "compactMode": false,
  "autoJitterBuffer": true,
  "showTutorialTips": true,
  "defaultBufferSize": 256,
  "defaultSampleRate": 48000,
  "emailNotifications": true,
  "soundNotifications": true
}
```

---

### `user_stats`

Aggregated user statistics.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `user_id` | uuid | NO | - | Primary key, FK to user_profiles |
| `total_jam_seconds` | int8 | YES | `0` | Total jam time |
| `average_session_seconds` | int4 | YES | `0` | Average session length |
| `longest_session_seconds` | int4 | YES | `0` | Longest session |
| `total_sessions` | int4 | YES | `0` | Total session count |
| `sessions_this_week` | int4 | YES | `0` | Weekly sessions |
| `sessions_this_month` | int4 | YES | `0` | Monthly sessions |
| `unique_collaborators` | int4 | YES | `0` | Unique collaborator count |
| `reactions_received` | int4 | YES | `0` | Total reactions received |
| `reactions_given` | int4 | YES | `0` | Total reactions given |
| `messages_sent` | int4 | YES | `0` | Total messages sent |
| `rooms_created` | int4 | YES | `0` | Rooms created |
| `rooms_joined` | int4 | YES | `0` | Rooms joined |
| `tracks_uploaded` | int4 | YES | `0` | Tracks uploaded |
| `tracks_generated` | int4 | YES | `0` | AI tracks generated |
| `stems_separated` | int4 | YES | `0` | Stem separations performed |
| `activity_by_hour` | jsonb | YES | `[0,0,...]` | 24-hour activity array |
| `activity_by_day` | jsonb | YES | `[0,0,...]` | 7-day activity array |
| `updated_at` | timestamptz | YES | `now()` | Last update |

---

### `user_instruments`

Instruments owned/played by users.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `uuid_generate_v4()` | Primary key |
| `user_id` | uuid | YES | - | FK to user_profiles |
| `instrument_id` | varchar | NO | - | Instrument identifier |
| `category` | varchar | NO | - | Instrument category |
| `is_primary` | bool | YES | `false` | Primary instrument flag |
| `variant` | varchar | YES | - | Variant/model |
| `finish` | varchar | YES | - | Color/finish |
| `total_hours` | numeric | YES | `0` | Hours played |
| `total_sessions` | int4 | YES | `0` | Sessions with instrument |
| `level` | int4 | YES | `1` | Instrument level |
| `xp` | int4 | YES | `0` | Instrument XP |
| `created_at` | timestamptz | YES | `now()` | Date added |
| `last_played_at` | timestamptz | YES | - | Last used |

---

### `user_xp_transactions`

XP transaction history.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | NO | - | FK to user_profiles |
| `amount` | int4 | NO | - | XP amount (+/-) |
| `reason` | text | NO | - | Transaction reason |
| `source_type` | text | YES | - | Source type |
| `source_id` | uuid | YES | - | Related entity ID |
| `balance_after` | int4 | NO | - | Balance after transaction |
| `created_at` | timestamptz | YES | `now()` | Transaction time |

---

### `subscription_tiers`

Subscription tier definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NO | - | Primary key (e.g., 'free', 'pro') |
| `name` | text | NO | - | Display name |
| `max_saved_rooms` | int4 | NO | - | Room save limit |
| `created_at` | timestamptz | YES | `now()` | Created |

---

## Rooms & Sessions

### `rooms`

Active jam rooms.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NO | - | Primary key (room code) |
| `name` | text | NO | - | Room name |
| `created_by` | text | NO | - | Creator user ID |
| `created_at` | timestamptz | YES | `now()` | Creation time |
| `pop_location` | text | YES | `'auto'` | Server location |
| `max_users` | int4 | YES | `10` | Max participants |
| `is_public` | bool | YES | `true` | Public visibility |
| `settings` | jsonb | YES | `'{}'` | Room settings |
| `description` | text | YES | - | Room description |
| `genre` | text | YES | - | Music genre |
| `tags` | jsonb | YES | - | Tags array |
| `rules` | text | YES | - | Room rules |
| `creator_name` | text | YES | - | Creator display name |
| `creator_username` | text | YES | - | Creator username |
| `last_activity` | timestamptz | YES | `now()` | Last activity |
| `color` | text | YES | `'indigo'` | Theme color |
| `icon` | text | YES | `'music'` | Room icon |
| `default_role` | text | YES | `'member'` | Default member role |
| `default_permissions` | jsonb | YES | - | Default permissions |
| `require_approval` | bool | YES | `false` | Require join approval |

---

### `saved_rooms`

Persistent room configurations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `uuid_generate_v4()` | Primary key |
| `owner_id` | uuid | YES | - | FK to user_profiles |
| `code` | varchar | NO | - | Unique room code |
| `name` | varchar | NO | - | Room name |
| `description` | text | YES | `''` | Description |
| `room_type` | varchar | YES | `'private'` | Room type |
| `max_users` | int4 | YES | `10` | Max users |
| `genre` | varchar | YES | - | Genre |
| `skill_level` | varchar | YES | - | Skill level |
| `min_level` | int4 | YES | `0` | Min user level |
| `min_reputation` | numeric | YES | `0` | Min reputation |
| `theme` | varchar | YES | `'default'` | Visual theme |
| `banner_url` | varchar | YES | - | Banner image |
| `welcome_message` | text | YES | - | Welcome message |
| `rules` | text | YES | - | Room rules |
| `tags` | text[] | YES | `'{}'` | Tags array |
| `settings` | jsonb | YES | (audio defaults) | Audio settings |
| `total_sessions` | int4 | YES | `0` | Total sessions |
| `total_unique_visitors` | int4 | YES | `0` | Unique visitors |
| `total_jam_seconds` | int8 | YES | `0` | Total jam time |
| `created_at` | timestamptz | YES | `now()` | Created |
| `updated_at` | timestamptz | YES | `now()` | Updated |
| `last_active_at` | timestamptz | YES | - | Last activity |

---

### `room_members`

Room membership and roles.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `room_id` | text | NO | - | FK to rooms |
| `user_id` | text | NO | - | User ID |
| `user_name` | text | NO | - | Display name |
| `user_avatar` | text | YES | - | Avatar URL |
| `role` | text | NO | `'member'` | Role (owner/admin/member) |
| `custom_permissions` | jsonb | YES | - | Permission overrides |
| `joined_at` | timestamptz | YES | `now()` | Join time |
| `last_active_at` | timestamptz | YES | `now()` | Last active |
| `invited_by` | text | YES | - | Inviter user ID |
| `is_banned` | bool | YES | `false` | Ban status |
| `ban_reason` | text | YES | - | Ban reason |

---

### `room_bans`

Room-level bans.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `room_id` | text | NO | - | FK to rooms |
| `user_id` | text | NO | - | Banned user ID |
| `reason` | text | YES | - | Ban reason |
| `banned_by` | text | NO | - | Admin who banned |
| `banned_at` | timestamptz | YES | `now()` | Ban time |
| `expires_at` | timestamptz | YES | - | Expiration (null=permanent) |

---

### `room_invitations`

Room invite system.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `room_id` | text | NO | - | FK to rooms |
| `invited_user_id` | text | YES | - | Invited user ID |
| `invited_email` | text | YES | - | Invited email |
| `invited_by` | text | NO | - | Inviter user ID |
| `status` | text | NO | `'pending'` | Status |
| `invite_code` | text | YES | - | Unique invite code |
| `message` | text | YES | - | Personal message |
| `expires_at` | timestamptz | YES | - | Expiration |
| `created_at` | timestamptz | YES | `now()` | Created |
| `updated_at` | timestamptz | YES | `now()` | Updated |

---

### `room_permission_logs`

Permission change audit log.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `room_id` | text | NO | - | FK to rooms |
| `target_user_id` | text | NO | - | Affected user |
| `action` | text | NO | - | Action type |
| `old_value` | jsonb | YES | - | Previous value |
| `new_value` | jsonb | YES | - | New value |
| `performed_by` | text | NO | - | Admin user ID |
| `created_at` | timestamptz | YES | `now()` | Action time |

---

### `room_chat_messages`

Room chat history.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `uuid_generate_v4()` | Primary key |
| `room_id` | varchar | NO | - | Room ID |
| `user_id` | uuid | YES | - | FK to user_profiles |
| `content` | text | NO | - | Message content |
| `message_type` | varchar | YES | `'text'` | Type (text/reaction/system) |
| `reaction_type` | varchar | YES | - | Reaction type if reaction |
| `target_user_id` | uuid | YES | - | Target for reactions |
| `created_at` | timestamptz | YES | `now()` | Sent time |
| `is_deleted` | bool | YES | `false` | Soft delete flag |
| `deleted_at` | timestamptz | YES | - | Deletion time |
| `deleted_by` | uuid | YES | - | Deleter user ID |

---

### `room_webrtc_sessions`

WebRTC session tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `room_id` | text | NO | - | Room ID |
| `user_id` | text | NO | - | User ID |
| `session_id` | text | NO | - | WebRTC session ID |
| `track_name` | text | NO | - | Track name |
| `created_at` | timestamptz | YES | `now()` | Created |
| `updated_at` | timestamptz | YES | `now()` | Updated |

---

### `session_history`

Historical jam session records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `uuid_generate_v4()` | Primary key |
| `user_id` | uuid | YES | - | FK to user_profiles |
| `room_id` | varchar | NO | - | Room ID |
| `joined_at` | timestamptz | NO | `now()` | Join time |
| `left_at` | timestamptz | YES | - | Leave time |
| `duration_seconds` | int4 | YES | - | Session duration |
| `instrument_id` | varchar | YES | - | Instrument used |
| `was_room_master` | bool | YES | `false` | Was room master |
| `participant_ids` | uuid[] | YES | `'{}'` | Other participants |

---

### `user_saved_rooms`

User's saved/bookmarked rooms.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `user_id` | text | NO | - | User ID |
| `room_id` | text | NO | - | FK to rooms |
| `notes` | text | YES | - | Personal notes |
| `saved_at` | timestamptz | YES | `now()` | Save time |

---

## Audio & Tracks

### `tracks`

Uploaded audio tracks.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NO | - | Primary key |
| `room_id` | text | YES | - | FK to rooms |
| `name` | text | NO | - | Track name |
| `artist` | text | YES | - | Artist name |
| `duration` | float4 | NO | - | Duration in seconds |
| `url` | text | NO | - | Storage URL |
| `uploaded_by` | text | NO | - | Uploader user ID |
| `uploaded_at` | timestamptz | YES | `now()` | Upload time |
| `ai_generated` | bool | YES | `false` | AI generated flag |
| `stems` | jsonb | YES | - | Separated stems data |

---

### `room_tracks`

Tracks associated with rooms.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | - | Primary key |
| `room_id` | text | NO | - | Room ID |
| `name` | text | NO | - | Track name |
| `artist` | text | YES | - | Artist |
| `duration` | int4 | YES | `0` | Duration (ms) |
| `url` | text | NO | - | Storage URL |
| `uploaded_by` | text | YES | `'user'` | Uploader |
| `youtube_id` | text | YES | - | YouTube video ID |
| `ai_generated` | bool | YES | `false` | AI flag |
| `created_at` | timestamptz | YES | `now()` | Created |

---

### `user_tracks`

User audio tracks in rooms.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NO | - | Primary key |
| `room_id` | text | NO | - | FK to rooms |
| `user_id` | text | NO | - | User ID |
| `name` | text | NO | - | Track name |
| `color` | text | NO | `'#a78bfa'` | Track color |
| `audio_settings` | jsonb | NO | `'{}'` | Audio settings |
| `is_muted` | bool | NO | `false` | Muted state |
| `is_solo` | bool | NO | `false` | Solo state |
| `volume` | float4 | NO | `1.0` | Volume level |
| `is_armed` | bool | NO | `true` | Record armed |
| `is_recording` | bool | NO | `false` | Recording state |
| `owner_user_id` | text | YES | - | Owner user ID |
| `owner_user_name` | text | YES | - | Owner name |
| `is_active` | bool | NO | `true` | Active state |
| `track_type` | text | YES | `'audio'` | Track type |
| `midi_settings` | jsonb | YES | - | MIDI settings |
| `created_at` | timestamptz | NO | `now()` | Created |
| `updated_at` | timestamptz | NO | `now()` | Updated |

---

### `room_loop_tracks`

MIDI loop tracks in rooms.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `room_id` | text | NO | - | FK to rooms |
| `created_by` | text | YES | - | Creator user ID |
| `created_by_name` | text | YES | - | Creator name |
| `loop_id` | text | NO | - | Loop identifier |
| `custom_midi_data` | jsonb | YES | - | Custom MIDI data |
| `is_playing` | bool | YES | `false` | Playing state |
| `start_time` | timestamptz | YES | - | Start time |
| `loop_start_beat` | float4 | YES | `0` | Start beat |
| `sound_preset` | text | NO | `'drums/acoustic-kit'` | Sound preset |
| `sound_settings` | jsonb | YES | `'{}'` | Sound settings |
| `tempo_locked` | bool | YES | `false` | Tempo lock |
| `target_bpm` | float4 | YES | - | Target BPM |
| `key_locked` | bool | YES | `false` | Key lock |
| `target_key` | text | YES | - | Target key |
| `transpose_amount` | int4 | YES | `0` | Transpose semitones |
| `volume` | float4 | YES | `0.8` | Volume |
| `pan` | float4 | YES | `0.0` | Pan position |
| `muted` | bool | YES | `false` | Muted |
| `solo` | bool | YES | `false` | Solo |
| `effects` | jsonb | YES | (default chain) | Effects settings |
| `humanize_enabled` | bool | YES | `false` | Humanize |
| `humanize_timing` | float4 | YES | `0.05` | Timing variance |
| `humanize_velocity` | float4 | YES | `0.1` | Velocity variance |
| `color` | text | YES | `'#6366f1'` | Track color |
| `name` | text | YES | - | Track name |
| `position` | int4 | YES | `0` | Position |
| `created_at` | timestamptz | YES | `now()` | Created |
| `updated_at` | timestamptz | YES | `now()` | Updated |

---

### `songs`

Song arrangements in rooms.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `room_id` | text | NO | - | FK to rooms |
| `name` | text | NO | - | Song name |
| `tracks` | jsonb | NO | `'[]'` | Track data |
| `bpm` | int4 | NO | `120` | Tempo |
| `key` | text | YES | - | Musical key |
| `time_signature` | int4[] | NO | `'{4,4}'` | Time signature |
| `duration` | float4 | NO | `0` | Duration |
| `color` | text | NO | `'#6366f1'` | Color |
| `position` | int4 | NO | `0` | Position |
| `created_by` | uuid | YES | - | Creator |
| `created_by_name` | text | YES | - | Creator name |
| `created_at` | timestamptz | NO | `now()` | Created |
| `updated_at` | timestamptz | NO | `now()` | Updated |

---

### `saved_track_presets`

User-saved track presets.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NO | - | Primary key |
| `user_id` | text | NO | - | User ID |
| `name` | text | NO | - | Preset name |
| `description` | text | YES | - | Description |
| `track_type` | text | NO | `'audio'` | Track type |
| `instrument_id` | text | NO | `'other'` | Instrument |
| `color` | text | NO | `'#a78bfa'` | Color |
| `volume` | float4 | NO | `1.0` | Volume |
| `is_muted` | bool | NO | `false` | Muted |
| `is_solo` | bool | NO | `false` | Solo |
| `audio_settings` | jsonb | YES | - | Audio settings |
| `midi_settings` | jsonb | YES | - | MIDI settings |
| `effects` | jsonb | NO | `'{}'` | Effects |
| `active_effect_preset` | text | YES | - | Active preset |
| `is_default` | bool | NO | `false` | Default flag |
| `use_count` | int4 | NO | `0` | Usage count |
| `created_at` | timestamptz | NO | `now()` | Created |
| `updated_at` | timestamptz | NO | `now()` | Updated |

---

### `lyria_usage`

AI music generation usage tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | NO | - | User ID |
| `session_id` | text | NO | - | Generation session |
| `session_start` | timestamptz | NO | `now()` | Start time |
| `session_end` | timestamptz | YES | - | End time |
| `duration_seconds` | int4 | YES | `0` | Duration |
| `prompt_text` | text | YES | - | Generation prompt |
| `style` | text | YES | - | Music style |
| `mood` | text | YES | - | Mood setting |
| `bpm` | int4 | YES | - | BPM setting |
| `scale` | text | YES | - | Musical scale |
| `bytes_streamed` | int8 | YES | `0` | Data streamed |
| `created_at` | timestamptz | NO | `now()` | Created |

---

### `lyria_rate_limits`

AI generation rate limiting.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `user_id` | uuid | NO | - | Primary key |
| `request_count` | int4 | YES | `0` | Requests in window |
| `window_start` | timestamptz | YES | `now()` | Window start |
| `daily_seconds_used` | int4 | YES | `0` | Seconds used today |
| `daily_reset_at` | timestamptz | YES | (tomorrow) | Daily reset time |
| `updated_at` | timestamptz | YES | `now()` | Updated |

---

## Avatar System

### `avatar_categories`

Avatar component categories.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NO | - | Primary key |
| `display_name` | text | NO | - | Display name |
| `layer_order` | int4 | NO | - | Render order |
| `is_required` | bool | YES | `false` | Required category |
| `max_selections` | int4 | YES | `1` | Max selections |
| `supports_color_variants` | bool | YES | `false` | Color support |
| `default_color_palette` | text | YES | - | FK to palettes |
| `is_active` | bool | YES | `true` | Active status |
| `render_x` | int4 | NO | `0` | Render X position |
| `render_y` | int4 | NO | `0` | Render Y position |
| `render_width` | int4 | NO | `512` | Render width |
| `render_height` | int4 | NO | `512` | Render height |
| `prompt_addition` | text | YES | - | AI prompt addition |
| `created_at` | timestamptz | YES | `now()` | Created |
| `updated_at` | timestamptz | YES | `now()` | Updated |

---

### `avatar_components`

Individual avatar components.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NO | - | Primary key |
| `category_id` | text | NO | - | FK to categories |
| `name` | text | NO | - | Component name |
| `image_url` | text | NO | - | Image URL |
| `thumbnail_url` | text | YES | - | Thumbnail URL |
| `r2_key` | text | NO | - | R2 storage key |
| `tags` | text[] | YES | `'{}'` | Tags |
| `rarity` | text | YES | `'common'` | Rarity tier |
| `color_variants` | jsonb | YES | `'{}'` | Color variants |
| `base_color` | text | YES | - | Base color |
| `generation_prompt` | text | YES | - | AI prompt |
| `generation_model` | text | YES | - | AI model used |
| `generation_params` | jsonb | YES | - | AI params |
| `is_active` | bool | YES | `true` | Active |
| `created_by` | uuid | YES | - | Creator |
| `created_at` | timestamptz | YES | `now()` | Created |
| `updated_at` | timestamptz | YES | `now()` | Updated |

---

### `avatar_color_palettes`

Color palette definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NO | - | Primary key |
| `display_name` | text | NO | - | Display name |
| `colors` | jsonb | NO | `'[]'` | Color array |
| `created_at` | timestamptz | YES | `now()` | Created |

---

### `avatar_unlock_rules`

Rules for unlocking components.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NO | - | Primary key |
| `display_name` | text | NO | - | Display name |
| `description` | text | YES | - | Description |
| `unlock_type` | text | NO | - | Unlock type |
| `level_required` | int4 | YES | - | Level requirement |
| `achievement_id` | text | YES | - | Achievement required |
| `statistic_key` | text | YES | - | Stat key |
| `statistic_operator` | text | YES | - | Comparison operator |
| `statistic_value` | numeric | YES | - | Required value |
| `is_active` | bool | YES | `true` | Active |
| `created_at` | timestamptz | YES | `now()` | Created |
| `updated_at` | timestamptz | YES | `now()` | Updated |

---

### `avatar_component_unlocks`

Component-to-unlock-rule mappings.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `component_id` | text | NO | - | PK, FK to components |
| `unlock_rule_id` | text | NO | - | PK, FK to rules |

---

### `avatar_generation_presets`

AI avatar generation presets.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NO | - | Primary key |
| `name` | text | NO | - | Preset name |
| `prompt_template` | text | NO | - | Prompt template |
| `negative_prompt` | text | YES | - | Negative prompt |
| `style_suffix` | text | YES | - | Style suffix |
| `model` | text | YES | `'flux-schnell'` | AI model |
| `params` | jsonb | YES | `'{}'` | Parameters |
| `is_active` | bool | YES | `true` | Active |
| `created_at` | timestamptz | YES | `now()` | Created |

---

### `user_avatar_canvas`

User avatar compositions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | NO | - | FK to user_profiles |
| `canvas_data` | jsonb | NO | (default) | Canvas layers |
| `full_body_url` | text | YES | - | Full body render |
| `headshot_url` | text | YES | - | Headshot render |
| `thumbnail_urls` | jsonb | YES | - | Thumbnails |
| `created_at` | timestamptz | YES | `now()` | Created |
| `updated_at` | timestamptz | YES | `now()` | Updated |

---

### `user_unlocked_components`

User's unlocked avatar components.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `user_id` | uuid | NO | - | PK, FK to user_profiles |
| `component_id` | text | NO | - | PK, FK to components |
| `unlocked_at` | timestamptz | YES | `now()` | Unlock time |
| `unlocked_reason` | text | YES | - | Unlock reason |

---

### `homepage_characters`

Homepage display characters.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `name` | varchar | NO | - | Character name |
| `description` | text | YES | - | Description |
| `canvas_data` | jsonb | NO | (default) | Avatar data |
| `full_body_url` | text | YES | - | Full render |
| `thumbnail_url` | text | YES | - | Thumbnail |
| `personality` | varchar | YES | - | Personality type |
| `preferred_scenes` | text[] | YES | - | Scene preferences |
| `walk_speed` | numeric | YES | `1.0` | Animation speed |
| `idle_animation` | varchar | YES | `'bounce'` | Idle animation |
| `is_active` | bool | YES | `true` | Active |
| `sort_order` | int4 | YES | `0` | Display order |
| `created_by` | uuid | YES | - | Creator |
| `created_at` | timestamptz | YES | `now()` | Created |
| `updated_at` | timestamptz | YES | `now()` | Updated |

---

## Gamification

### `achievements`

Achievement definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | varchar | NO | - | Primary key |
| `name` | varchar | NO | - | Achievement name |
| `description` | text | NO | - | Description |
| `category` | varchar | NO | - | Category |
| `icon` | varchar | YES | `'trophy'` | Icon name |
| `xp_reward` | int4 | YES | `50` | XP reward |
| `criteria` | jsonb | NO | - | Unlock criteria |
| `is_hidden` | bool | YES | `false` | Hidden achievement |
| `sort_order` | int4 | YES | `0` | Display order |
| `created_at` | timestamptz | YES | `now()` | Created |

---

### `user_achievements`

User's earned achievements.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `uuid_generate_v4()` | Primary key |
| `user_id` | uuid | YES | - | FK to user_profiles |
| `achievement_id` | varchar | YES | - | FK to achievements |
| `unlocked_at` | timestamptz | YES | `now()` | Unlock time |

---

### `challenges`

Time-limited challenges.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `uuid_generate_v4()` | Primary key |
| `type` | varchar | NO | - | Challenge type |
| `name` | varchar | NO | - | Challenge name |
| `description` | text | NO | - | Description |
| `criteria` | jsonb | NO | - | Completion criteria |
| `xp_reward` | int4 | YES | `100` | XP reward |
| `active_from` | date | NO | - | Start date |
| `active_until` | date | NO | - | End date |

---

## Social Features

### `follows`

Follow relationships.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `follower_id` | uuid | NO | - | PK, FK to user_profiles |
| `following_id` | uuid | NO | - | PK, FK to user_profiles |
| `created_at` | timestamptz | YES | `now()` | Follow time |

---

### `friendships`

Friend relationships.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `uuid_generate_v4()` | Primary key |
| `user_id` | uuid | YES | - | FK to user_profiles |
| `friend_id` | uuid | YES | - | FK to user_profiles |
| `status` | varchar | YES | `'pending'` | Request status |
| `requested_at` | timestamptz | YES | `now()` | Request time |
| `accepted_at` | timestamptz | YES | - | Acceptance time |
| `jams_together` | int4 | YES | `0` | Shared sessions |
| `total_time_together_seconds` | int8 | YES | `0` | Time together |

---

### `notifications`

User notifications.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `uuid_generate_v4()` | Primary key |
| `user_id` | uuid | YES | - | FK to user_profiles |
| `type` | varchar | NO | - | Notification type |
| `title` | varchar | NO | - | Title |
| `message` | text | YES | - | Message body |
| `link_type` | varchar | YES | - | Link type |
| `link_id` | uuid | YES | - | Related entity |
| `is_read` | bool | YES | `false` | Read status |
| `read_at` | timestamptz | YES | - | Read time |
| `created_at` | timestamptz | YES | `now()` | Created |

---

### `activity_feed`

Social activity feed.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | NO | - | FK to user_profiles |
| `type` | text | NO | - | Activity type |
| `data` | jsonb | YES | `'{}'` | Activity data |
| `created_at` | timestamptz | YES | `now()` | Created |

---

## System Configuration

### `system_loops`

System MIDI loop library.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NO | - | Primary key |
| `name` | text | NO | - | Loop name |
| `category` | text | NO | - | Category |
| `subcategory` | text | YES | - | Subcategory |
| `bpm` | int4 | NO | `120` | BPM |
| `bars` | int4 | NO | `1` | Bar count |
| `time_signature_numerator` | int4 | NO | `4` | Time sig numerator |
| `time_signature_denominator` | int4 | NO | `4` | Time sig denominator |
| `key` | text | YES | - | Musical key |
| `midi_data` | jsonb | NO | `'[]'` | MIDI note data |
| `sound_preset` | text | NO | - | Sound preset |
| `tags` | text[] | YES | `'{}'` | Tags |
| `intensity` | int4 | NO | `3` | Intensity (1-5) |
| `complexity` | int4 | NO | `2` | Complexity (1-5) |
| `is_active` | bool | YES | `true` | Active |
| `created_by` | uuid | YES | - | Creator |
| `created_at` | timestamptz | YES | `now()` | Created |
| `updated_at` | timestamptz | YES | `now()` | Updated |

---

### `system_loop_categories`

Loop category definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NO | - | Primary key |
| `name` | text | NO | - | Category name |
| `icon` | text | NO | - | Icon |
| `sort_order` | int4 | YES | `0` | Display order |
| `created_at` | timestamptz | YES | `now()` | Created |
| `updated_at` | timestamptz | YES | `now()` | Updated |

---

### `system_loop_subcategories`

Loop subcategory definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NO | - | Primary key |
| `category_id` | text | NO | - | FK to categories |
| `name` | text | NO | - | Subcategory name |
| `sort_order` | int4 | YES | `0` | Display order |
| `created_at` | timestamptz | YES | `now()` | Created |
| `updated_at` | timestamptz | YES | `now()` | Updated |

---

### `user_custom_loops`

User-created loops.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NO | - | Primary key |
| `user_id` | text | NO | - | User ID |
| `name` | text | NO | - | Loop name |
| `category` | text | NO | - | Category |
| `subcategory` | text | YES | `'custom'` | Subcategory |
| `bpm` | int4 | NO | `120` | BPM |
| `bars` | int4 | NO | `2` | Bars |
| `time_signature` | jsonb | NO | `'[4, 4]'` | Time signature |
| `key` | text | YES | - | Key |
| `midi_data` | jsonb | NO | `'[]'` | MIDI data |
| `sound_preset` | text | NO | - | Sound preset |
| `tags` | jsonb | NO | `'["custom"]'` | Tags |
| `intensity` | int4 | NO | `3` | Intensity |
| `complexity` | int4 | NO | `2` | Complexity |
| `description` | text | YES | - | Description |
| `is_favorite` | bool | YES | `false` | Favorite flag |
| `is_promoted` | bool | YES | `false` | Promoted to system |
| `promoted_at` | timestamptz | YES | - | Promotion time |
| `promoted_by` | uuid | YES | - | Promoter |
| `created_at` | timestamptz | YES | `now()` | Created |
| `updated_at` | timestamptz | YES | `now()` | Updated |

---

### `system_instruments`

Instrument definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NO | - | Primary key |
| `name` | text | NO | - | Instrument name |
| `category` | text | NO | - | Category |
| `type` | text | NO | - | Type |
| `icon` | text | NO | `'🎹'` | Icon |
| `description` | text | YES | - | Description |
| `tags` | text[] | YES | `'{}'` | Tags |
| `layout` | text | YES | `'piano'` | Keyboard layout |
| `note_range_min` | int4 | YES | `36` | Min MIDI note |
| `note_range_max` | int4 | YES | `84` | Max MIDI note |
| `synth_config` | jsonb | YES | - | Synth config |
| `drum_map` | jsonb | YES | - | Drum mapping |
| `is_active` | bool | YES | `true` | Active |
| `created_by` | uuid | YES | - | Creator |
| `created_at` | timestamptz | YES | `now()` | Created |
| `updated_at` | timestamptz | YES | `now()` | Updated |

---

### `system_instrument_categories`

Instrument category definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NO | - | Primary key |
| `name` | text | NO | - | Category name |
| `icon` | text | NO | - | Icon |
| `sort_order` | int4 | YES | `0` | Display order |
| `created_at` | timestamptz | YES | `now()` | Created |
| `updated_at` | timestamptz | YES | `now()` | Updated |

---

### `system_instant_band_presets`

Quick-start band presets.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NO | - | Primary key |
| `name` | text | NO | - | Preset name |
| `description` | text | YES | - | Description |
| `loop_ids` | text[] | NO | `'{}'` | Loop IDs |
| `bpm_range_min` | int4 | YES | `80` | Min BPM |
| `bpm_range_max` | int4 | YES | `140` | Max BPM |
| `genre` | text | YES | - | Genre |
| `is_active` | bool | YES | `true` | Active |
| `sort_order` | int4 | YES | `0` | Display order |
| `created_at` | timestamptz | YES | `now()` | Created |
| `updated_at` | timestamptz | YES | `now()` | Updated |

---

## Admin & Moderation

### `reports`

User reports.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `uuid_generate_v4()` | Primary key |
| `reporter_id` | uuid | YES | - | FK to user_profiles |
| `target_type` | varchar | NO | - | Target type |
| `target_id` | uuid | NO | - | Target entity ID |
| `reason` | varchar | NO | - | Report reason |
| `description` | text | YES | - | Details |
| `evidence_urls` | text[] | YES | `'{}'` | Evidence URLs |
| `status` | varchar | YES | `'pending'` | Review status |
| `reviewed_by` | uuid | YES | - | Reviewer |
| `reviewed_at` | timestamptz | YES | - | Review time |
| `resolution` | text | YES | - | Resolution notes |
| `action_taken` | varchar | YES | - | Action taken |
| `created_at` | timestamptz | YES | `now()` | Created |

---

### `admin_audit_log`

Admin action audit trail.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `uuid_generate_v4()` | Primary key |
| `admin_id` | uuid | YES | - | FK to user_profiles |
| `action` | varchar | NO | - | Action type |
| `target_type` | varchar | YES | - | Target type |
| `target_id` | uuid | YES | - | Target ID |
| `details` | jsonb | YES | `'{}'` | Action details |
| `ip_address` | inet | YES | - | IP address |
| `created_at` | timestamptz | YES | `now()` | Action time |

---

## Row Level Security (RLS) Policies

All tables have RLS enabled. Policies control access based on authentication state and user roles.

### Access Patterns

| Pattern | Description |
|---------|-------------|
| `auth.uid()` | Current authenticated user's ID |
| `account_type = 'admin'` | Admin role check via user_profiles |
| `auth.jwt() ->> 'role' = 'service_role'` | Service role (backend) access |
| `is_active = true` | Only active records visible |

### User System Policies

#### `user_profiles`
| Policy | Command | Rule |
|--------|---------|------|
| Public profiles are viewable by everyone | SELECT | `profile_visibility = 'public' OR auth.uid() = id` |
| Users can insert own profile | INSERT | `auth.uid() = id` |
| Users can update own profile | UPDATE | `auth.uid() = id` |

#### `user_stats`
| Policy | Command | Rule |
|--------|---------|------|
| Stats viewable based on profile settings | SELECT | `show_stats = true OR auth.uid() = user_id` |
| Users can view all stats | SELECT | `true` |
| Users can insert own stats | INSERT | `auth.uid() = user_id` |
| Users can update own stats | UPDATE | `auth.uid() = user_id` |

#### `user_instruments`
| Policy | Command | Rule |
|--------|---------|------|
| Instruments are viewable by everyone | SELECT | `true` |
| Users can manage own instruments | ALL | `auth.uid() = user_id` |

#### `user_achievements`
| Policy | Command | Rule |
|--------|---------|------|
| User achievements viewable by everyone | SELECT | `true` |
| Users can insert own achievements | INSERT | `auth.uid() = user_id` |

#### `user_xp_transactions`
| Policy | Command | Rule |
|--------|---------|------|
| Users can view own xp | SELECT | `auth.uid() = user_id` |
| Users can insert own xp | INSERT | `auth.uid() = user_id` |

### Social Policies

#### `follows`
| Policy | Command | Rule |
|--------|---------|------|
| Follows are viewable by everyone | SELECT | `true` |
| Users can manage own follows | ALL | `auth.uid() = follower_id` |

#### `friendships`
| Policy | Command | Rule |
|--------|---------|------|
| Users can view their friendships | SELECT | `auth.uid() = user_id OR auth.uid() = friend_id` |
| Users can create friend requests | INSERT | `auth.uid() = user_id` |
| Users can update friendships they're part of | UPDATE | `auth.uid() = user_id OR auth.uid() = friend_id` |
| Users can delete friendships they're part of | DELETE | `auth.uid() = user_id OR auth.uid() = friend_id` |

#### `activity_feed`
| Policy | Command | Rule |
|--------|---------|------|
| Users can view own activity | SELECT | `auth.uid() = user_id OR user_id IN (accepted friends)` |
| Users can create own activity | INSERT | `auth.uid() = user_id` |
| Users can manage own activity | ALL | `auth.uid() = user_id` |

#### `notifications`
| Policy | Command | Rule |
|--------|---------|------|
| Users can view own notifications | SELECT | `auth.uid() = user_id` |
| Users can update own notifications | UPDATE | `auth.uid() = user_id` |
| System can insert notifications | INSERT | `true` |

### Room Policies

#### `rooms`
| Policy | Command | Rule |
|--------|---------|------|
| Public read access | SELECT | `is_public = true` |
| Allow insert | INSERT | `true` |

#### `saved_rooms`
| Policy | Command | Rule |
|--------|---------|------|
| Public rooms are viewable by everyone | SELECT | `room_type = 'public' OR owner_id = auth.uid()` |
| Users can manage own rooms | ALL | `auth.uid() = owner_id` |

#### `room_invitations`
| Policy | Command | Rule |
|--------|---------|------|
| Users can view their own invitations | SELECT | `invited_user_id = auth.uid() OR invited_email matches` |
| Room moderators can view room invitations | SELECT | `user is owner/co-host` |
| Room moderators can create invitations | INSERT | `invited_by = auth.uid() AND user is owner/co-host` |
| Invited users can respond to invitations | UPDATE | `invited_user_id = auth.uid()` (accept/decline only) |
| Room moderators can revoke invitations | UPDATE | `user is owner/co-host` (revoke only) |
| Room moderators can delete invitations | DELETE | `user is owner/co-host` |

#### `room_chat_messages`
| Policy | Command | Rule |
|--------|---------|------|
| Chat messages are viewable by everyone | SELECT | `true` |
| Authenticated users can send messages | INSERT | `auth.uid() = user_id` |

#### `session_history`
| Policy | Command | Rule |
|--------|---------|------|
| Users can view own session history | SELECT | `auth.uid() = user_id` |
| Users can insert own sessions | INSERT | `auth.uid() = user_id` |
| Users can update own sessions | UPDATE | `auth.uid() = user_id` |
| Users can manage own sessions | ALL | `auth.uid() = user_id` |

### Real-time Collaboration (Open Access)

These tables allow all operations for real-time collaboration:

| Table | Policy |
|-------|--------|
| `room_loop_tracks` | Allow all operations |
| `room_tracks` | Allow all operations |
| `room_webrtc_sessions` | Allow all operations |
| `user_tracks` | Allow all operations |
| `songs` | Allow all operations |
| `saved_track_presets` | Allow all operations |
| `user_custom_loops` | Allow all operations |

### Avatar System Policies

#### `avatar_categories`, `avatar_components`, `avatar_color_palettes`, `avatar_unlock_rules`, `avatar_generation_presets`, `avatar_component_unlocks`
| Policy | Command | Rule |
|--------|---------|------|
| Public read (active only) | SELECT | `is_active = true` (or `true` for palettes/unlocks) |
| Admins can manage | ALL | `account_type = 'admin'` |

#### `user_avatar_canvas`
| Policy | Command | Rule |
|--------|---------|------|
| Public can read avatar URLs | SELECT | `true` |
| Users can read own avatar canvas | SELECT | `auth.uid() = user_id` |
| Users can insert own avatar canvas | INSERT | `auth.uid() = user_id` |
| Users can update own avatar canvas | UPDATE | `auth.uid() = user_id` |
| Users can delete own avatar canvas | DELETE | `auth.uid() = user_id` |

#### `user_unlocked_components`
| Policy | Command | Rule |
|--------|---------|------|
| Users read own unlocked_components | SELECT | `auth.uid() = user_id` |
| Admins can manage user unlocks | ALL | `account_type = 'admin'` |

### System Configuration Policies

#### `system_loops`, `system_instruments`, `system_loop_categories`, `system_loop_subcategories`, `system_instrument_categories`, `system_instant_band_presets`
| Policy | Command | Rule |
|--------|---------|------|
| Public read access (active only) | SELECT | `is_active = true` (or `true` for categories) |
| Admin write access | ALL | `auth.jwt() ->> 'role' = 'admin'` |

### Admin Policies

#### `admin_audit_log`
| Policy | Command | Rule |
|--------|---------|------|
| Admins can view audit log | SELECT | `account_type = 'admin'` |
| Admins can insert audit log | INSERT | `account_type = 'admin'` |

#### `reports`
| Policy | Command | Rule |
|--------|---------|------|
| Admins can view all reports | SELECT | `auth.uid() = reporter_id OR account_type = 'admin'` |
| Users can create reports | INSERT | `auth.uid() = reporter_id` |
| Admins can update reports | UPDATE | `account_type = 'admin'` |

### Service Role Policies

#### `lyria_rate_limits`, `lyria_usage`
| Policy | Command | Rule |
|--------|---------|------|
| Users can view own | SELECT | `auth.uid() = user_id` |
| Service role can manage | ALL | `auth.jwt() ->> 'role' = 'service_role'` |

---

## Foreign Key Relationships

```
user_profiles
├── user_stats.user_id
├── user_instruments.user_id
├── user_achievements.user_id
├── user_avatar_canvas.user_id
├── user_unlocked_components.user_id
├── user_xp_transactions.user_id
├── activity_feed.user_id
├── notifications.user_id
├── follows.follower_id
├── follows.following_id
├── friendships.user_id
├── friendships.friend_id
├── session_history.user_id
├── saved_rooms.owner_id
├── reports.reporter_id
├── reports.reviewed_by
├── admin_audit_log.admin_id
├── room_chat_messages.user_id
├── room_chat_messages.target_user_id
└── room_chat_messages.deleted_by

rooms
├── room_members.room_id
├── room_bans.room_id
├── room_invitations.room_id
├── room_permission_logs.room_id
├── room_loop_tracks.room_id
├── songs.room_id
├── tracks.room_id
├── user_tracks.room_id
└── user_saved_rooms.room_id

achievements
└── user_achievements.achievement_id

avatar_categories
├── avatar_components.category_id
└── avatar_categories.default_color_palette → avatar_color_palettes

avatar_components
├── avatar_component_unlocks.component_id
└── user_unlocked_components.component_id

avatar_unlock_rules
└── avatar_component_unlocks.unlock_rule_id

system_loop_categories
└── system_loop_subcategories.category_id
```

---

## Indexes

Key performance indexes:

| Table | Index | Columns |
|-------|-------|---------|
| `user_profiles` | `idx_user_profiles_username` | username |
| `user_profiles` | `idx_user_profiles_level` | level DESC |
| `user_profiles` | `idx_user_profiles_last_online` | last_online_at DESC |
| `follows` | `idx_follows_follower_id` | follower_id |
| `follows` | `idx_follows_following_id` | following_id |
| `friendships` | `idx_friendships_user` | user_id, status |
| `notifications` | `idx_notifications_user` | user_id, is_read, created_at DESC |
| `room_members` | `idx_room_members_room` | room_id |
| `room_members` | `idx_room_members_user` | user_id |
| `room_chat_messages` | `idx_room_chat_messages_room` | room_id, created_at DESC |
| `room_loop_tracks` | `idx_room_loop_tracks_room` | room_id |
| `session_history` | `idx_session_history_user` | user_id, joined_at DESC |
| `system_loops` | `idx_system_loops_category` | category |
| `system_loops` | `idx_system_loops_tags` | tags (GIN) |
| `avatar_components` | `idx_avatar_components_category` | category_id |
| `avatar_components` | `idx_avatar_components_tags` | tags (GIN) |

---

## Schema Update SQL

Run this query in Supabase SQL Editor to regenerate this documentation:

```sql
-- 1. TABLES AND COLUMNS
SELECT
    t.table_name,
    c.column_name,
    c.data_type,
    c.udt_name,
    c.is_nullable,
    c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- 2. PRIMARY KEYS
SELECT tc.table_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 3. FOREIGN KEYS
SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table, ccu.column_name AS references_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 4. ENUMS
SELECT t.typname, e.enumlabel, e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder;

-- 5. INDEXES
SELECT tablename, indexname, indexdef
FROM pg_indexes WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 6. RLS POLICIES
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 7. FUNCTIONS
SELECT p.proname, pg_get_function_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS returns
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 8. TRIGGERS
SELECT trigger_name, event_object_table, event_manipulation, action_timing
FROM information_schema.triggers WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 9. UNIQUE CONSTRAINTS
SELECT tc.table_name, tc.constraint_name, string_agg(kcu.column_name, ', ') AS columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;

-- 10. STORAGE BUCKETS
SELECT id, name, public, created_at FROM storage.buckets ORDER BY name;
```

---

*Last updated: 2026-01-02*
