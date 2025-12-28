# Proposal: Loop & MIDI Instrument Admin Management System

## Executive Summary

Build an admin panel section to manage loops and MIDI instruments that appear in the DAW's loop browser modal. Currently, loops and instruments are hardcoded in TypeScript files. This proposal outlines migrating to database-driven storage with a full admin CRUD interface.

---

## Current State Analysis

### Loops
- **Location**: `src/lib/audio/loop-library.ts`
- **Storage**: Hardcoded TypeScript arrays
- **Data structures**:
  - `LOOP_CATEGORIES` - Category definitions with subcategories
  - `LOOP_LIBRARY` - ~20 built-in loops with MIDI data
  - `INSTANT_BAND_PRESETS` - Preset combinations of loops
- **Used by**: `src/components/loops/loop-browser-modal.tsx`

### Instruments
- **Location**: `src/lib/audio/instrument-registry.ts`
- **Storage**: In-memory Map populated at module load via `registerInstruments()`
- **Data structures**:
  - Categories (drums, bass, keys, lead, fx)
  - ~10 instrument definitions with synth configs
- **Used by**: Loop creator, MIDI device selector

### Problems with Current Approach
1. Adding new loops/instruments requires code deployment
2. No way for admins to manage content without developer involvement
3. Hardcoded data can't be easily extended or modified
4. No audit trail or versioning of changes

---

## Proposed Architecture

### Database Schema

#### Table: `system_loop_categories`
```sql
CREATE TABLE system_loop_categories (
  id TEXT PRIMARY KEY,           -- e.g., 'drums', 'bass'
  name TEXT NOT NULL,            -- e.g., 'Drums & Percussion'
  icon TEXT NOT NULL,            -- emoji or icon name
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `system_loop_subcategories`
```sql
CREATE TABLE system_loop_subcategories (
  id TEXT PRIMARY KEY,           -- e.g., 'rock-drums'
  category_id TEXT NOT NULL REFERENCES system_loop_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,            -- e.g., 'Rock Kits'
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `system_loops`
```sql
CREATE TABLE system_loops (
  id TEXT PRIMARY KEY,           -- e.g., 'rock-basic-4-4'
  name TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES system_loop_categories(id),
  subcategory_id TEXT REFERENCES system_loop_subcategories(id),

  -- Musical properties
  bpm INTEGER NOT NULL,
  bars INTEGER NOT NULL DEFAULT 1,
  time_signature INTEGER[] NOT NULL DEFAULT '{4,4}',
  key TEXT,                      -- e.g., 'C', 'Am'

  -- MIDI data stored as JSONB
  midi_data JSONB NOT NULL,      -- Array of {t, n, v, d}

  -- Sound mapping
  sound_preset TEXT NOT NULL,    -- e.g., 'drums/acoustic-kit'

  -- Metadata
  tags TEXT[] NOT NULL DEFAULT '{}',
  intensity INTEGER NOT NULL CHECK (intensity BETWEEN 1 AND 5),
  complexity INTEGER NOT NULL CHECK (complexity BETWEEN 1 AND 5),
  description TEXT,

  -- Admin tracking
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `system_instant_band_presets`
```sql
CREATE TABLE system_instant_band_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  loop_ids TEXT[] NOT NULL,      -- Array of loop IDs
  bpm_range INTEGER[] NOT NULL,  -- [min, max]
  genre TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `system_instrument_categories`
```sql
CREATE TABLE system_instrument_categories (
  id TEXT PRIMARY KEY,           -- e.g., 'drums', 'bass'
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `system_instruments`
```sql
CREATE TABLE system_instruments (
  id TEXT PRIMARY KEY,           -- e.g., 'drums/acoustic-kit'
  name TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES system_instrument_categories(id),
  type TEXT NOT NULL CHECK (type IN ('synth', 'drums', 'sampler')),
  icon TEXT NOT NULL,
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',

  -- Display configuration
  layout TEXT NOT NULL CHECK (layout IN ('piano', 'drums', 'pads')),
  note_range_min INTEGER,
  note_range_max INTEGER,

  -- Synth configuration (for type='synth')
  synth_config JSONB,

  -- Drum map (for type='drums')
  drum_map JSONB,

  -- Admin tracking
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Endpoints

### Loops API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/loops/categories` | List all loop categories |
| POST | `/api/admin/loops/categories` | Create category |
| PATCH | `/api/admin/loops/categories?id=X` | Update category |
| DELETE | `/api/admin/loops/categories?id=X` | Delete category |
| GET | `/api/admin/loops/subcategories` | List subcategories |
| POST | `/api/admin/loops/subcategories` | Create subcategory |
| PATCH | `/api/admin/loops/subcategories?id=X` | Update subcategory |
| DELETE | `/api/admin/loops/subcategories?id=X` | Delete subcategory |
| GET | `/api/admin/loops` | List all system loops |
| POST | `/api/admin/loops` | Create a loop |
| PATCH | `/api/admin/loops?id=X` | Update a loop |
| DELETE | `/api/admin/loops?id=X` | Delete a loop |
| POST | `/api/admin/loops/duplicate?id=X` | Duplicate a loop |
| GET | `/api/admin/loops/presets` | List instant band presets |
| POST | `/api/admin/loops/presets` | Create preset |
| PATCH | `/api/admin/loops/presets?id=X` | Update preset |
| DELETE | `/api/admin/loops/presets?id=X` | Delete preset |

### Instruments API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/instruments/categories` | List instrument categories |
| POST | `/api/admin/instruments/categories` | Create category |
| PATCH | `/api/admin/instruments/categories?id=X` | Update category |
| DELETE | `/api/admin/instruments/categories?id=X` | Delete category |
| GET | `/api/admin/instruments` | List all instruments |
| POST | `/api/admin/instruments` | Create instrument |
| PATCH | `/api/admin/instruments?id=X` | Update instrument |
| DELETE | `/api/admin/instruments?id=X` | Delete instrument |
| POST | `/api/admin/instruments/duplicate?id=X` | Duplicate instrument |

### Public API (for client consumption)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/loops/library` | Get all active loops + categories |
| GET | `/api/instruments/library` | Get all active instruments + categories |

---

## Admin UI Components

### New Tab: "Loops & Instruments" in Admin Panel

```
Admin Panel
├── Dashboard
├── Users
├── Rooms
├── Reports
├── Analytics
├── Avatars
└── Loops & Instruments  ← NEW
    ├── Loop Library      (sub-tab)
    ├── Loop Categories   (sub-tab)
    ├── Instruments       (sub-tab)
    ├── Instant Bands     (sub-tab)
    └── Import/Export     (sub-tab)
```

### Sub-tab: Loop Library

**Features:**
- Table view of all system loops with columns:
  - Name, Category, Subcategory, BPM, Key, Intensity, Complexity, Status
- Search/filter by category, subcategory, tags
- Inline edit for simple fields (name, BPM, intensity)
- Full edit modal for MIDI data
- Preview playback button (uses existing SoundEngine)
- Duplicate loop action
- Bulk enable/disable
- Reorder within category

**Loop Editor Modal:**
- Embeds existing `NoteGridEditor` component from loop-creator
- Musical properties form (BPM, bars, time signature, key)
- Tags input (multi-select)
- Sound preset dropdown
- Intensity/complexity sliders
- Preview button with transport controls

### Sub-tab: Loop Categories

**Features:**
- Drag-and-drop category reordering
- Create/edit/delete categories
- Manage subcategories within each category
- Icon selector (emoji picker)

### Sub-tab: Instruments

**Features:**
- Table view of all instruments
- Grouped by category
- Edit modal with:
  - Basic info (name, icon, tags)
  - Layout selector (piano/drums/pads)
  - Note range sliders
  - Synth config builder (for synth type)
  - Drum map editor (for drums type)
- Preview instrument with keyboard/drum pad UI
- Duplicate action

### Sub-tab: Instant Bands

**Features:**
- Table of preset combinations
- Edit modal to select loops from library
- BPM range slider
- Genre text input
- Preview all loops together

### Sub-tab: Import/Export

**Features:**
- Export all loops/instruments as JSON
- Import from JSON file
- Validation and preview before import
- Option to merge or replace existing data

---

## File Structure

```
src/
├── app/
│   ├── admin/
│   │   └── page.tsx                          # Add 'loops' tab
│   └── api/
│       └── admin/
│           ├── loops/
│           │   ├── route.ts                  # CRUD for loops
│           │   ├── categories/
│           │   │   └── route.ts              # Loop categories
│           │   ├── subcategories/
│           │   │   └── route.ts              # Subcategories
│           │   └── presets/
│           │       └── route.ts              # Instant band presets
│           └── instruments/
│               ├── route.ts                  # CRUD for instruments
│               └── categories/
│                   └── route.ts              # Instrument categories
├── components/
│   └── admin/
│       └── loops/
│           ├── index.ts                      # Barrel export
│           ├── LoopLibrary.tsx               # Loop management table
│           ├── LoopEditor.tsx                # Create/edit modal
│           ├── LoopCategoryManager.tsx       # Category management
│           ├── InstrumentLibrary.tsx         # Instrument table
│           ├── InstrumentEditor.tsx          # Create/edit modal
│           ├── SynthConfigEditor.tsx         # Synth parameter editor
│           ├── DrumMapEditor.tsx             # Drum mapping editor
│           ├── InstantBandManager.tsx        # Preset management
│           └── ImportExportPanel.tsx         # JSON import/export
├── lib/
│   └── loops/
│       └── supabase.ts                       # Database operations
└── types/
    └── admin-loops.ts                        # Admin-specific types
```

---

## Migration Strategy

### Phase 1: Database Setup
1. Create migration file with all tables
2. Seed existing hardcoded data into tables
3. Keep hardcoded files as fallback

### Phase 2: API Layer
1. Create all admin API endpoints
2. Create public API endpoint that reads from database
3. Add caching layer for public endpoint (Redis or in-memory)

### Phase 3: Modify Consumers
1. Update `loop-library.ts` to fetch from API with fallback to hardcoded
2. Update `instrument-registry.ts` to fetch from API with fallback
3. Update `loop-browser-modal.tsx` to use new data source

### Phase 4: Admin UI
1. Add new tab to admin panel
2. Implement loop library management
3. Implement category management
4. Implement instrument management
5. Implement instant band management
6. Implement import/export

### Phase 5: Polish
1. Add audit logging for changes
2. Add preview/draft mode for loops
3. Add bulk operations

---

## Migration File (Seed Data)

The migration will seed all existing hardcoded loops and instruments:

```sql
-- Insert existing loop categories
INSERT INTO system_loop_categories (id, name, icon, sort_order) VALUES
  ('drums', 'Drums & Percussion', '🥁', 1),
  ('bass', 'Bass Lines', '🎸', 2),
  ('keys', 'Keys & Pads', '🎹', 3),
  ('full-beats', 'Full Arrangements', '🎵', 4);

-- Insert existing subcategories
INSERT INTO system_loop_subcategories (id, category_id, name, sort_order) VALUES
  ('rock-drums', 'drums', 'Rock Kits', 1),
  ('electronic-drums', 'drums', 'Electronic', 2),
  ('hip-hop-drums', 'drums', 'Hip Hop', 3),
  ('jazz-drums', 'drums', 'Jazz', 4),
  ('synth-bass', 'bass', 'Synth Bass', 1),
  ('funk-bass', 'bass', 'Funk Bass', 2),
  ('chords', 'keys', 'Chord Progressions', 1),
  ('pads', 'keys', 'Ambient Pads', 2),
  ('lofi', 'full-beats', 'Lo-Fi Chill', 1),
  ('edm', 'full-beats', 'EDM/Dance', 2);

-- Insert all existing loops (MIDI data as JSONB)
-- ... (full loop data)

-- Insert instrument categories
INSERT INTO system_instrument_categories (id, name, icon, sort_order) VALUES
  ('drums', 'Drums & Percussion', '🥁', 1),
  ('bass', 'Bass', '🎸', 2),
  ('keys', 'Keys & Pads', '🎹', 3),
  ('lead', 'Lead & Melody', '🎵', 4),
  ('fx', 'FX & Atmosphere', '✨', 5);

-- Insert all existing instruments
-- ... (full instrument data)
```

---

## Technical Considerations

### Caching Strategy
- Cache loop library for 5 minutes (configurable)
- Invalidate cache on any admin CRUD operation
- Use `revalidateTag` for Next.js cache invalidation

### Validation
- MIDI data validation (note range 0-127, velocity 0-127, time 0-1)
- Required fields enforcement
- Unique ID constraint
- Foreign key constraints for categories

### Security
- All admin endpoints require admin authentication via `verifyAdminRequest()`
- Public endpoints are read-only
- Audit log for all modifications

### Backward Compatibility
- Keep hardcoded data as fallback if database fetch fails
- Graceful degradation for offline development

---

## UI Mockups (Conceptual)

### Loop Library Table
```
┌──────────────────────────────────────────────────────────────────────┐
│ Loop Library                                              [+ Add Loop]│
├──────────────────────────────────────────────────────────────────────┤
│ [Search...]  [Category ▼]  [Subcategory ▼]  [Status ▼]  [Refresh]   │
├──────────────────────────────────────────────────────────────────────┤
│ ▶ │ Name           │ Category  │ Sub      │ BPM │ Int │ Status │ ⋮  │
├───┼────────────────┼───────────┼──────────┼─────┼─────┼────────┼────┤
│ ▶ │ Basic Rock Beat│ Drums     │ Rock     │ 120 │ ★★★ │ Active │ ⋮  │
│ ▶ │ Driving 8ths   │ Drums     │ Rock     │ 130 │ ★★★★│ Active │ ⋮  │
│ ▶ │ Four on Floor  │ Drums     │ Electronic│128 │ ★★★ │ Active │ ⋮  │
│ ▶ │ Octave Pump    │ Bass      │ Synth    │ 120 │ ★★★ │ Active │ ⋮  │
└───┴────────────────┴───────────┴──────────┴─────┴─────┴────────┴────┘
```

### Loop Editor Modal
```
┌─────────────────────────────────────────────────────────────────────┐
│ Edit Loop: Basic Rock Beat                                      [X] │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │                    [ Note Grid Editor ]                         │ │
│ │  36 │ ● │   │   │   │ ● │   │   │   │                          │ │
│ │  38 │   │   │ ● │   │   │   │ ● │   │                          │ │
│ │  42 │ ○ │ ○ │ ○ │ ○ │ ○ │ ○ │ ○ │ ○ │                          │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Name: [Basic Rock Beat        ]    BPM: [120]    Bars: [1]        │
│  Category: [Drums ▼]  Subcategory: [Rock Kits ▼]                   │
│  Time Sig: [4/4 ▼]    Key: [- ▼]                                   │
│  Sound Preset: [drums/acoustic-kit ▼]                              │
│  Tags: [rock] [basic] [driving] [+]                                │
│  Intensity: ★★★☆☆    Complexity: ★☆☆☆☆                            │
│                                                                     │
│  [▶ Preview]                              [Cancel]  [Save Changes]  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Estimated Implementation Effort

| Component | Effort |
|-----------|--------|
| Database migration + seed | Medium |
| Admin API endpoints (loops) | Medium |
| Admin API endpoints (instruments) | Medium |
| Public API + caching | Low |
| Loop Library UI | Medium |
| Loop Editor (reuse NoteGridEditor) | Low |
| Category Manager | Low |
| Instrument Library UI | Medium |
| Instrument Editor (synth config) | High |
| Instant Band Manager | Low |
| Import/Export | Medium |
| Integration + testing | Medium |

---

## Open Questions

1. **Audio file support?** Should we support sample-based instruments (WAV/MP3 uploads) or keep it synthesizer-only for now?

2. **Versioning?** Should we track version history of loops/instruments for rollback?

3. **User-submitted content?** Should admins be able to promote user-created loops to the system library?

4. **Permissions?** Should there be different admin roles (view-only vs full edit)?

---

## Conclusion

This system will transform loop and instrument management from a developer task to an admin task. The database-driven approach enables:

- Quick content updates without code deployment
- A/B testing different loops
- Easy expansion of the sound library
- Audit trail of all changes
- Potential for user-submitted content curation

The implementation reuses existing components (NoteGridEditor, SoundEngine) and follows established admin panel patterns (AvatarsTab structure).
