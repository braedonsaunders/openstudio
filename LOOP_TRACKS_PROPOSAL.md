# Loop Tracks: Award-Winning Innovation Proposal

## Executive Vision

Transform OpenStudio from a live jamming platform into a **complete hybrid composition environment** where musicians can seamlessly blend live performance with intelligent loop-based production—all synchronized in real-time across collaborators with sub-30ms latency.

---

## The Innovation: "Living Loops"

Unlike traditional DAW loops that are static audio clips, OpenStudio introduces **Living Loops**—MIDI-based, infinitely malleable musical building blocks that:

1. **Breathe with the session** - Auto-adapt tempo and key to the detected musical context
2. **React to live players** - Humanize timing based on incoming audio signatures
3. **Evolve over time** - Optional subtle variations prevent listener fatigue
4. **Sync universally** - All users hear identical playback synchronized to the microsecond

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LOOP TRACKS SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐         │
│  │  Loop Library  │    │  MIDI Engine   │    │  Sound Engine  │         │
│  │                │    │                │    │                │         │
│  │ • Drum Kits    │───▶│ • Sequencer    │───▶│ • SF2 Soundfonts│        │
│  │ • Bass Lines   │    │ • Quantizer    │    │ • Web Audio Synths│      │
│  │ • Keys/Pads    │    │ • Humanizer    │    │ • Sample Banks │         │
│  │ • Arpeggios    │    │ • Key Transpose│    │ • Lightweight   │        │
│  │ • Full Beats   │    │                │    │   (~2MB total) │         │
│  └────────────────┘    └────────────────┘    └────────────────┘         │
│           │                    │                      │                  │
│           ▼                    ▼                      ▼                  │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │                    Loop Track Instance                        │       │
│  │  • Persisted in Supabase (room_loop_tracks)                  │       │
│  │  • Synced via Realtime broadcast                             │       │
│  │  • Rendered locally per-client (no audio streaming)          │       │
│  └──────────────────────────────────────────────────────────────┘       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Prebuilt Loop Library

### Loop Categories & Content

```typescript
interface LoopCategory {
  id: string;
  name: string;
  icon: string;
  subcategories: LoopSubcategory[];
}

const LOOP_CATEGORIES: LoopCategory[] = [
  {
    id: 'drums',
    name: 'Drums & Percussion',
    icon: '🥁',
    subcategories: [
      { id: 'rock-drums', name: 'Rock Kits', loops: 24 },
      { id: 'electronic-drums', name: 'Electronic', loops: 32 },
      { id: 'hip-hop-drums', name: 'Hip Hop', loops: 28 },
      { id: 'jazz-drums', name: 'Jazz Brushes', loops: 16 },
      { id: 'latin-drums', name: 'Latin Percussion', loops: 20 },
      { id: 'world-drums', name: 'World Percussion', loops: 18 },
      { id: 'acoustic-perc', name: 'Acoustic Percussion', loops: 14 },
    ]
  },
  {
    id: 'bass',
    name: 'Bass Lines',
    icon: '🎸',
    subcategories: [
      { id: 'electric-bass', name: 'Electric Bass', loops: 20 },
      { id: 'synth-bass', name: 'Synth Bass', loops: 24 },
      { id: 'upright-bass', name: 'Upright/Acoustic', loops: 12 },
      { id: 'slap-bass', name: 'Slap & Funk', loops: 16 },
    ]
  },
  {
    id: 'keys',
    name: 'Keys & Pads',
    icon: '🎹',
    subcategories: [
      { id: 'piano-comps', name: 'Piano Comps', loops: 20 },
      { id: 'organ-grooves', name: 'Organ Grooves', loops: 14 },
      { id: 'synth-pads', name: 'Synth Pads', loops: 18 },
      { id: 'rhodes-wurli', name: 'Rhodes & Wurlitzer', loops: 16 },
      { id: 'string-pads', name: 'String Pads', loops: 12 },
    ]
  },
  {
    id: 'guitar',
    name: 'Guitar Patterns',
    icon: '🎸',
    subcategories: [
      { id: 'acoustic-strum', name: 'Acoustic Strums', loops: 18 },
      { id: 'electric-riffs', name: 'Electric Riffs', loops: 16 },
      { id: 'funk-guitar', name: 'Funk Rhythms', loops: 14 },
      { id: 'arpeggios', name: 'Arpeggios', loops: 12 },
    ]
  },
  {
    id: 'full-beats',
    name: 'Full Arrangements',
    icon: '🎵',
    subcategories: [
      { id: 'pop-beats', name: 'Pop Production', loops: 20 },
      { id: 'lo-fi', name: 'Lo-Fi Chill', loops: 18 },
      { id: 'edm-drops', name: 'EDM/Dance', loops: 16 },
      { id: 'trap-beats', name: 'Trap & Urban', loops: 14 },
      { id: 'indie-folk', name: 'Indie/Folk', loops: 12 },
    ]
  }
];
```

### Loop Data Structure (MIDI-Based, Lightweight)

```typescript
interface LoopDefinition {
  id: string;
  name: string;
  category: string;
  subcategory: string;

  // Musical properties
  bpm: number;                    // Original tempo (60-200)
  bars: number;                   // Length in bars (1, 2, 4, 8)
  timeSignature: [number, number]; // e.g., [4, 4]
  key?: string;                   // e.g., 'C', 'Am' (null for drums)

  // MIDI data (ultra-compact)
  midiData: MidiNote[];           // Array of note events

  // Sound mapping
  soundPreset: string;            // Reference to sound engine preset

  // Metadata
  tags: string[];                 // ['groovy', 'energetic', 'sparse']
  intensity: 1 | 2 | 3 | 4 | 5;   // Energy level
  complexity: 1 | 2 | 3 | 4 | 5;  // Rhythmic complexity

  // Size: ~200-500 bytes per loop
}

interface MidiNote {
  t: number;     // Time (0-1 normalized to loop length)
  n: number;     // MIDI note number (0-127)
  v: number;     // Velocity (0-127)
  d: number;     // Duration (0-1 normalized)
}
```

### Total Library Size Budget

| Component | Size | Notes |
|-----------|------|-------|
| Loop MIDI Data | ~150 KB | 400+ loops × 400 bytes avg |
| Drum Samples | ~800 KB | Compressed, essential hits only |
| Bass Samples | ~300 KB | Multi-sampled, compressed |
| Keys Samples | ~400 KB | Rhodes, Piano, Synth essentials |
| Synth Wavetables | ~100 KB | For procedural sounds |
| **Total** | **~1.75 MB** | Lazy-loaded on demand |

---

## Part 2: Sound Engine Architecture

### Lightweight Sound Library

```typescript
// Sound engine using Web Audio API + optional Tone.js
interface SoundEngine {
  context: AudioContext;

  // Sound banks (lazy-loaded)
  banks: Map<string, SoundBank>;

  // Active voices for polyphony management
  activeVoices: Voice[];

  // Methods
  loadBank(bankId: string): Promise<void>;
  playNote(note: MidiNote, bank: string): Voice;
  stopVoice(voice: Voice): void;
}

interface SoundBank {
  id: string;
  name: string;
  type: 'sampler' | 'synth' | 'drumkit';

  // For samplers
  samples?: Map<number, AudioBuffer>; // MIDI note → sample

  // For synths
  oscillatorConfig?: OscillatorConfig;
  filterConfig?: FilterConfig;
  envelopeConfig?: EnvelopeConfig;
}

// Built-in sound presets (no external dependencies)
const SOUND_PRESETS = {
  drums: {
    'acoustic-kit': { type: 'drumkit', samples: 'acoustic-drums.json' },
    '808-kit': { type: 'drumkit', samples: '808-drums.json' },
    'electronic-kit': { type: 'drumkit', samples: 'electronic-drums.json' },
    'jazz-brushes': { type: 'drumkit', samples: 'jazz-brushes.json' },
  },
  bass: {
    'electric-bass': { type: 'sampler', samples: 'electric-bass.json' },
    'synth-bass-1': { type: 'synth', config: 'synth-bass-saw.json' },
    'synth-bass-2': { type: 'synth', config: 'synth-bass-square.json' },
    '808-sub': { type: 'synth', config: '808-sub.json' },
  },
  keys: {
    'grand-piano': { type: 'sampler', samples: 'piano-lite.json' },
    'electric-piano': { type: 'sampler', samples: 'rhodes-lite.json' },
    'synth-pad': { type: 'synth', config: 'lush-pad.json' },
    'organ': { type: 'synth', config: 'b3-organ.json' },
  },
  synth: {
    'lead-1': { type: 'synth', config: 'saw-lead.json' },
    'pluck': { type: 'synth', config: 'pluck.json' },
    'strings': { type: 'synth', config: 'string-ensemble.json' },
  }
};
```

### Synthesizer Implementation (Zero External Samples)

```typescript
// Built-in synth engine for maximum portability
class WebAudioSynth {
  private context: AudioContext;
  private masterGain: GainNode;

  createVoice(config: SynthConfig): Voice {
    // Oscillator bank (up to 3 oscillators per voice)
    const oscillators = config.oscillators.map(osc => {
      const node = this.context.createOscillator();
      node.type = osc.type; // sine, saw, square, triangle
      node.detune.value = osc.detune;
      return node;
    });

    // Filter
    const filter = this.context.createBiquadFilter();
    filter.type = config.filter.type;
    filter.frequency.value = config.filter.cutoff;
    filter.Q.value = config.filter.resonance;

    // Amplitude envelope
    const ampEnv = this.context.createGain();

    // LFO for modulation
    const lfo = this.context.createOscillator();
    lfo.frequency.value = config.lfo?.rate || 0;

    // Connect: Oscillators → Filter → Amp Envelope → Master
    oscillators.forEach(osc => osc.connect(filter));
    filter.connect(ampEnv);
    ampEnv.connect(this.masterGain);

    return { oscillators, filter, ampEnv, lfo };
  }
}
```

---

## Part 3: MIDI Input Track (User's Own MIDI Controller)

### New User Track Type: MIDI Input

```typescript
interface MidiInputTrack extends BaseTrack {
  type: 'midi-input';

  // MIDI device selection
  midiDeviceId: string | null;
  midiChannel: number; // 1-16 or 'all'

  // Sound selection
  soundBank: string;    // e.g., 'keys/grand-piano'
  soundPreset: string;  // User can customize

  // MIDI mapping (for drums/custom)
  noteMapping?: Map<number, number>; // Input note → Output note

  // Effects (same chain as audio tracks)
  effects: EffectsSettings;

  // Arpeggiator (optional enhancement)
  arpeggiator?: ArpeggiatorSettings;
}

interface ArpeggiatorSettings {
  enabled: boolean;
  mode: 'up' | 'down' | 'updown' | 'random' | 'order';
  rate: '1/4' | '1/8' | '1/16' | '1/32';
  octaves: 1 | 2 | 3 | 4;
  gate: number; // 0-1, note length
}
```

### MIDI Input Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  MIDI Controller│────▶│  Web MIDI API   │────▶│  MIDI Processor │
│  (User's device)│     │  navigator.     │     │  • Channel filter│
└─────────────────┘     │  requestMIDI    │     │  • Note mapping  │
                        │  Access()       │     │  • Velocity curve│
                        └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  WebRTC Stream  │◀────│  Audio Output   │◀────│  Sound Engine   │
│  (to all users) │     │  (local render) │     │  (synth/sampler)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### MIDI Device Selection UI Component

```typescript
// src/components/midi/midi-device-selector.tsx
interface MidiDeviceSelectorProps {
  selectedDeviceId: string | null;
  onDeviceSelect: (deviceId: string) => void;
  onChannelSelect: (channel: number | 'all') => void;
}

// Features:
// - Auto-detect connected MIDI devices
// - Show device names and manufacturers
// - MIDI activity indicator (flash on note)
// - Learn mode (press a key to configure)
// - Hot-swap support (device connect/disconnect)
```

---

## Part 4: Loop Track Instance & Persistence

### Database Schema

```sql
-- New table for loop tracks
CREATE TABLE room_loop_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,

  -- Creator info
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT,

  -- Loop definition
  loop_id TEXT NOT NULL,              -- Reference to built-in loop
  custom_midi_data JSONB,             -- For user-modified loops

  -- Playback state
  is_playing BOOLEAN DEFAULT false,
  start_time TIMESTAMPTZ,             -- When loop started (for sync)

  -- Sound configuration
  sound_preset TEXT NOT NULL,
  sound_settings JSONB,               -- Custom sound tweaks

  -- Musical adaptation
  tempo_locked BOOLEAN DEFAULT false,  -- Lock to original tempo
  target_bpm REAL,                     -- Override BPM
  key_locked BOOLEAN DEFAULT false,    -- Lock to original key
  target_key TEXT,                     -- Override key (e.g., 'Am')

  -- Mixer settings
  volume REAL DEFAULT 0.8,
  pan REAL DEFAULT 0.0,
  muted BOOLEAN DEFAULT false,
  solo BOOLEAN DEFAULT false,

  -- Effects
  effects JSONB,                       -- Same structure as user tracks

  -- Display
  color TEXT DEFAULT '#6366f1',
  name TEXT,                           -- Custom name

  -- Ordering
  position INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_room_loop_tracks_room ON room_loop_tracks(room_id);
CREATE INDEX idx_room_loop_tracks_playing ON room_loop_tracks(room_id, is_playing);

-- RLS Policies
ALTER TABLE room_loop_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view room loop tracks"
  ON room_loop_tracks FOR SELECT
  USING (true);

CREATE POLICY "Room members can insert loop tracks"
  ON room_loop_tracks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Room members can update loop tracks"
  ON room_loop_tracks FOR UPDATE
  USING (true);

CREATE POLICY "Room members can delete loop tracks"
  ON room_loop_tracks FOR DELETE
  USING (true);
```

### Extended Schema for MIDI Input Tracks

```sql
-- Extend user_tracks to support MIDI input type
ALTER TABLE user_tracks
ADD COLUMN track_type TEXT DEFAULT 'audio' CHECK (track_type IN ('audio', 'midi'));

ALTER TABLE user_tracks
ADD COLUMN midi_settings JSONB;
-- Structure: {
--   deviceId: string,
--   channel: number | 'all',
--   soundBank: string,
--   soundPreset: string,
--   noteMapping: { [key: number]: number },
--   arpeggiator: ArpeggiatorSettings
-- }
```

---

## Part 5: Real-Time Synchronization

### Broadcast Events

```typescript
// New realtime events for loop tracks
type LoopTrackEvent =
  | { type: 'looptrack:add', track: LoopTrackState }
  | { type: 'looptrack:remove', trackId: string }
  | { type: 'looptrack:play', trackId: string, startTime: number }
  | { type: 'looptrack:stop', trackId: string }
  | { type: 'looptrack:update', trackId: string, changes: Partial<LoopTrackState> }
  | { type: 'looptrack:sync', tracks: LoopTrackState[] }; // Full state sync

// Sync mechanism (same as backing track)
interface LoopPlayCommand {
  type: 'looptrack:play';
  trackId: string;
  syncTimestamp: number;  // Future timestamp (Date.now() + 100ms)
  loopStartBeat: number;  // Where in the loop to start
}
```

### Loop Scheduler (Sample-Accurate Timing)

```typescript
class LoopScheduler {
  private context: AudioContext;
  private activeTracks: Map<string, ScheduledLoop>;

  scheduleLoop(track: LoopTrackState, startTime: number): void {
    const loop = new ScheduledLoop(track, this.context);

    // Calculate audio context time from wall clock
    const audioStartTime = this.wallClockToAudioTime(startTime);

    // Schedule first iteration
    loop.scheduleAt(audioStartTime);

    // Set up lookahead for seamless looping
    loop.onLoopEnd = (endTime) => {
      loop.scheduleAt(endTime); // Schedule next iteration
    };

    this.activeTracks.set(track.id, loop);
  }

  private wallClockToAudioTime(wallClock: number): number {
    const now = Date.now();
    const audioNow = this.context.currentTime;
    return audioNow + (wallClock - now) / 1000;
  }
}

class ScheduledLoop {
  private notes: ScheduledNote[] = [];
  private lookaheadInterval: number;

  scheduleAt(startTime: number): void {
    const loopDuration = this.calculateDuration();

    // Schedule all notes in this loop iteration
    for (const note of this.track.midiData) {
      const noteTime = startTime + (note.t * loopDuration);
      const noteDuration = note.d * loopDuration;

      this.soundEngine.scheduleNote(
        note.n,
        note.v,
        noteTime,
        noteDuration,
        this.track.soundPreset
      );
    }

    // Schedule callback for loop end
    const endTime = startTime + loopDuration;
    this.scheduleCallback(endTime, () => this.onLoopEnd?.(endTime));
  }
}
```

---

## Part 6: UI/UX Design

### Loop Browser Modal

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🎵 Loop Library                                              [×] Close │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────────────────────────────────┐ │
│  │ Categories       │  │ 🔍 Search loops...                          │ │
│  │                  │  └──────────────────────────────────────────────┘ │
│  │ 🥁 Drums         │                                                   │
│  │   └ Rock Kits    │  ┌────────────────────────────────────────────┐  │
│  │   └ Electronic   │  │ Filters:                                    │  │
│  │   └ Hip Hop  ◀── │  │ BPM: [80]━━━●━━━[160]  Key: [Any ▼]        │  │
│  │   └ Jazz         │  │ Intensity: ○ ● ● ○ ○   Complexity: ● ● ○ ○ │  │
│  │ 🎸 Bass          │  └────────────────────────────────────────────┘  │
│  │ 🎹 Keys          │                                                   │
│  │ 🎸 Guitar        │  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 🎵 Full Beats    │  │ 🥁       │ │ 🥁       │ │ 🥁       │          │
│  │                  │  │ Boom Bap │ │ Trap Hat │ │ 808 Kick │          │
│  └──────────────────┘  │ 90 BPM   │ │ 140 BPM  │ │ 75 BPM   │          │
│                        │ 4 bars   │ │ 2 bars   │ │ 1 bar    │          │
│                        │ ▶ ■      │ │ ▶ ■      │ │ ▶ ■      │          │
│                        │ [+ Add]  │ │ [+ Add]  │ │ [+ Add]  │          │
│                        └──────────┘ └──────────┘ └──────────┘          │
│                                                                          │
│  Sound: [808 Kit ▼]  ┌────────────────────────────────┐                 │
│                      │ ▶▶ Preview playing... ■ Stop   │                 │
│                      └────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Loop Track Lane (DAW View)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ┌────────────────────┐ ┌────────────────────────────────────────────────┐│
│ │ 🔁 Boom Bap Beat   │ │ ████████████████████████████████████████████  ││
│ │ ────────────────── │ │ ░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓  ││
│ │ 🥁 808 Kit         │ │ ████████████████████████████████████████████  ││
│ │ 90 BPM → 120 BPM   │ │ (visual MIDI note representation)             ││
│ │ ────────────────── │ └────────────────────────────────────────────────┘│
│ │ [▶] [M] [S]  🔧    │                                                   │
│ │      ▓▓▓▓▓ -3dB    │                                                   │
│ └────────────────────┘                                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### MIDI Input Track Lane

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ┌────────────────────┐ ┌────────────────────────────────────────────────┐│
│ │ 🎹 MIDI Keys       │ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ││
│ │ ────────────────── │ │           ▓▓▓▓                    ▓▓          ││
│ │ 🎹 Grand Piano     │ │      ▓▓▓▓      ▓▓▓▓         ▓▓▓▓             ││
│ │ Akai MPK Mini      │ │ (live MIDI note visualization)               ││
│ │ ────────────────── │ └────────────────────────────────────────────────┘│
│ │ Ch: All  [Arp: ▶]  │                                                   │
│ │ [M] [S]  🔧   -6dB │                                                   │
│ └────────────────────┘                                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Add Track Menu Enhancement

```typescript
// Enhanced AddTrackModal with new options
const TRACK_TYPE_OPTIONS = [
  {
    id: 'audio',
    icon: '🎤',
    name: 'Audio Input',
    description: 'Microphone, instrument, or line input'
  },
  {
    id: 'midi',
    icon: '🎹',
    name: 'MIDI Input',
    description: 'Connect your MIDI controller with virtual instruments'
  },
  {
    id: 'loop',
    icon: '🔁',
    name: 'Loop Track',
    description: 'Add drum beats, bass lines, and melodic loops'
  }
];
```

---

## Part 7: Intelligent Features (The "Award-Winning" Differentiators)

### 1. Auto-Sync to Session Context

```typescript
class LoopContextAdapter {
  // Automatically detect and adapt to session's musical context
  async adaptLoop(loop: LoopTrackState, roomContext: RoomMusicContext): Promise<void> {
    // Get current analysis from essentia
    const { key, bpm, timeSignature } = roomContext;

    if (!loop.tempoLocked && bpm) {
      // Time-stretch MIDI to match session BPM
      loop.targetBpm = bpm;
    }

    if (!loop.keyLocked && key && loop.originalKey) {
      // Transpose melodic content to session key
      loop.targetKey = key;
      loop.transposeAmount = this.calculateTranspose(loop.originalKey, key);
    }
  }

  private calculateTranspose(from: string, to: string): number {
    // Smart transposition that respects musical modes
    // e.g., Am to Em = +7 semitones (or -5, whichever sounds better)
  }
}
```

### 2. Humanization Engine

```typescript
class LoopHumanizer {
  // Add subtle timing and velocity variations
  humanize(midiData: MidiNote[], settings: HumanizeSettings): MidiNote[] {
    return midiData.map(note => ({
      ...note,
      t: note.t + this.randomTiming(settings.timingVariation),
      v: Math.min(127, Math.max(1,
        note.v + this.randomVelocity(settings.velocityVariation)
      ))
    }));
  }

  // React to live audio energy
  adaptToLiveAudio(loop: ScheduledLoop, audioLevels: number[]): void {
    // Dynamically adjust velocity based on live players' energy
    const avgEnergy = audioLevels.reduce((a, b) => a + b, 0) / audioLevels.length;
    loop.velocityMultiplier = 0.7 + (avgEnergy * 0.6); // 0.7 - 1.3 range
  }
}
```

### 3. Loop Evolution (Prevent Fatigue)

```typescript
class LoopEvolver {
  // Subtle variations each time loop repeats
  evolve(loop: LoopTrackState, iteration: number): MidiNote[] {
    const variations = [
      this.ghostNotes,      // Add/remove ghost notes
      this.accentShift,     // Shift accents slightly
      this.fillVariation,   // Different fills on 4th/8th bar
      this.densityWave,     // Gradually add/remove notes
    ];

    // Apply subtle, musical variations
    let evolved = [...loop.midiData];
    for (const variation of variations) {
      if (Math.random() < 0.3) { // 30% chance each
        evolved = variation(evolved, iteration);
      }
    }
    return evolved;
  }
}
```

### 4. Smart Loop Suggestions

```typescript
class LoopRecommender {
  // Suggest loops that complement current session
  async suggest(roomContext: RoomMusicContext): Promise<LoopSuggestion[]> {
    const currentLoops = roomContext.activeLoops;
    const liveInstruments = roomContext.userTrackTypes;

    // Analyze what's missing
    const hasDrums = currentLoops.some(l => l.category === 'drums');
    const hasBass = currentLoops.some(l => l.category === 'bass');

    // Suggest complementary elements
    const suggestions: LoopSuggestion[] = [];

    if (!hasDrums) {
      suggestions.push({
        category: 'drums',
        reason: 'Add rhythmic foundation',
        loops: await this.findMatching('drums', roomContext.bpm, roomContext.genre)
      });
    }

    if (!hasBass && hasDrums) {
      suggestions.push({
        category: 'bass',
        reason: 'Lock in the groove with bass',
        loops: await this.findMatching('bass', roomContext.bpm, roomContext.key)
      });
    }

    return suggestions;
  }
}
```

### 5. One-Click "Instant Band"

```typescript
// Pre-configured loop combinations for instant jamming
const INSTANT_BAND_PRESETS = [
  {
    name: 'Rock Trio',
    description: 'Driving drums, solid bass, rhythm guitar',
    loops: ['rock-drums-01', 'electric-bass-rock-01', 'electric-guitar-power-01'],
    bpmRange: [100, 140]
  },
  {
    name: 'Lo-Fi Chill',
    description: 'Jazzy drums, warm bass, dreamy keys',
    loops: ['lofi-drums-01', 'upright-bass-01', 'rhodes-chords-01'],
    bpmRange: [70, 90]
  },
  {
    name: 'Electronic Pulse',
    description: '808s, synth bass, atmospheric pads',
    loops: ['808-pattern-01', 'synth-bass-01', 'ambient-pad-01'],
    bpmRange: [120, 150]
  }
];
```

---

## Part 8: Implementation Roadmap

### Phase 1: Foundation (Core Infrastructure)
- [ ] Create `room_loop_tracks` database table and migrations
- [ ] Implement MIDI data structures and loop definitions
- [ ] Build basic SoundEngine with Web Audio API synthesizer
- [ ] Create LoopScheduler for sample-accurate playback
- [ ] Add Supabase realtime events for loop synchronization

### Phase 2: Loop Library & UI
- [ ] Design and implement loop data format (compact MIDI)
- [ ] Create 50+ initial loops across all categories
- [ ] Build LoopBrowserModal component
- [ ] Implement LoopTrackLane for DAW view
- [ ] Add loop track to AddTrackModal options

### Phase 3: Sound Engine & Samples
- [ ] Implement sampler engine for drums and acoustic sounds
- [ ] Build synthesizer engine for bass/keys/pads
- [ ] Create lightweight sample library (~1.5MB)
- [ ] Add sound preset selection UI
- [ ] Implement per-loop sound customization

### Phase 4: MIDI Input Tracks
- [ ] Implement Web MIDI API integration
- [ ] Create MidiDeviceSelector component
- [ ] Add MIDI input track type to user tracks
- [ ] Build real-time MIDI → Sound Engine pipeline
- [ ] Implement arpeggiator feature

### Phase 5: Intelligence & Polish
- [ ] Build LoopContextAdapter for auto tempo/key sync
- [ ] Implement LoopHumanizer for natural feel
- [ ] Add LoopEvolver for variation
- [ ] Create LoopRecommender for smart suggestions
- [ ] Build "Instant Band" preset system

### Phase 6: Expansion
- [ ] Expand loop library to 400+ loops
- [ ] Add user loop editing/creation
- [ ] Implement loop recording from MIDI input
- [ ] Add export functionality
- [ ] Create loop sharing between rooms

---

## Part 9: Technical Specifications

### Performance Requirements

| Metric | Target | Notes |
|--------|--------|-------|
| Loop start latency | < 10ms | From trigger to first note |
| Loop sync accuracy | < 1ms | Between all participants |
| Memory usage | < 50MB | For full sound library loaded |
| CPU usage | < 5% | Per loop track playing |
| Initial load | < 500KB | Core engine + first sounds |

### Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Web Audio API | ✅ | ✅ | ✅ | ✅ |
| AudioWorklet | ✅ | ✅ | ✅* | ✅ |
| Web MIDI API | ✅ | ❌** | ❌** | ✅ |

*Safari AudioWorklet requires iOS 14.5+
**Firefox/Safari need WebMIDI polyfill or show "not supported" message

### Security Considerations

- MIDI device access requires explicit user permission
- Loop data is read-only (no user uploads in Phase 1)
- Sound samples served from CDN with integrity hashes
- No arbitrary code execution in loop definitions

---

## Part 10: Success Metrics

### User Engagement
- **Loop adoption rate**: % of rooms using at least one loop
- **Average loops per room**: Target 2-3 per active session
- **MIDI track adoption**: % of users connecting MIDI controllers
- **Session duration increase**: Baseline vs. with loops enabled

### Technical Quality
- **Sync drift measurement**: Should stay < 5ms over 30min session
- **Audio glitch rate**: < 0.1% of loop iterations
- **Memory stability**: No leaks over extended sessions

### Creative Impact
- **Genre diversity**: Loops used across all music categories
- **Loop + live ratio**: Healthy mix (not just backing tracks)
- **Return usage**: Users who try loops come back

---

## Conclusion

The Loop Tracks feature transforms OpenStudio from a live jamming platform into a **complete hybrid production environment**. By combining:

1. **Lightweight MIDI-based loops** (minimal bandwidth, maximum flexibility)
2. **Intelligent musical adaptation** (auto tempo/key sync)
3. **Professional sound engine** (synthesizers + samples in < 2MB)
4. **MIDI controller support** (virtual instruments for everyone)
5. **Perfect synchronization** (leveraging existing sub-30ms infrastructure)

...OpenStudio becomes the first platform where musicians can jam live while building professional-quality productions together in real-time.

**This is not just loops—it's Living Loops: musical elements that breathe, adapt, and evolve with the musicians who play with them.**

---

*Proposal prepared for OpenStudio development team*
*Version 1.0 - December 2024*
