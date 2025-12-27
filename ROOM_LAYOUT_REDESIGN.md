# OpenStudio Room Layout Redesign
## A World-Class, Premium DAW Experience

---

## Executive Vision

Transform OpenStudio from a "video-call-with-music" interface into a **true browser-based DAW** that rivals professional desktop applications like Ableton Live, Logic Pro X, and Bitwig Studio, while pioneering innovations unique to real-time collaborative jamming.

The redesign centers on three pillars:
1. **Timeline-Centric Architecture** - Everything revolves around the horizontal arrangement
2. **Modular Panel System** - Flexible, resizable, dockable panels for personalization
3. **Premium Visual Language** - Dark theme with neon accents, glassmorphism, and micro-animations

---

## Part 1: Core Layout Architecture

### 1.1 The Grid System

```
+===========================================================================+
|  TRANSPORT BAR (Fixed Top - 56px)                                          |
|  [Logo] [Room] [Transport Controls] [Timeline Position] [Analysis] [User] |
+===========================================================================+
|           |                                                        |       |
|  TRACK    |  ARRANGEMENT VIEW                                      | PANEL |
|  HEADERS  |  (Main Canvas - Scrollable)                            | DOCK  |
|  (240px)  |                                                        |(320px)|
|           |  +--------------------------------------------------+  |       |
| +-------+ |  | BACKING TRACK WAVEFORM + TIMELINE                |  | +---+ |
| |You    | |  | =================[PLAYHEAD]==================== |  | |   | |
| |Guitar | |  +--------------------------------------------------+  | | M | |
| +-------+ |                                                        | | I | |
| +-------+ |  +--------------------------------------------------+  | | X | |
| |John   | |  | TRACK LANE: You (Guitar)                         |  | | E | |
| |Drums  | |  | ▓▓▓░░▓▓▓▓▓▓░░▓▓▓▓▓▓▓▓░░░▓▓▓▓▓░░▓▓▓              |  | | R | |
| +-------+ |  +--------------------------------------------------+  | |   | |
| +-------+ |  +--------------------------------------------------+  | +---+ |
| |Sarah  | |  | TRACK LANE: John (Drums)                         |  | +---+ |
| |Keys   | |  | ▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓              |  | | C | |
| +-------+ |  +--------------------------------------------------+  | | H | |
| +-------+ |  +--------------------------------------------------+  | | A | |
| |Mike   | |  | TRACK LANE: Sarah (Keys)                         |  | | T | |
| |Vocals | |  | ░░▓▓▓▓▓▓░░░░▓▓▓▓░░░░▓▓▓▓▓▓░░░░▓▓▓              |  | |   | |
| +-------+ |  +--------------------------------------------------+  | +---+ |
|           |  +--------------------------------------------------+  |       |
|  [+ Add]  |  | TRACK LANE: Mike (Vocals)                        |  |       |
|           |  | ░░░░░░░▓▓▓▓▓▓▓░░░░░░░░▓▓▓▓▓▓▓░░░░░              |  |       |
|           |  +--------------------------------------------------+  |       |
|           |                                                        |       |
|===========|========================================================|=======|
|  STEM     |  STEMS (Collapsible Section)                           |       |
|  HEADERS  |  +--------------------------------------------------+  |       |
|           |  | Vocals | Drums | Bass | Other                    |  |       |
+===========================================================================+
|  BOTTOM DOCK (Collapsible - 200px)                                         |
|  [Queue] [AI Generator] [Analysis] [Settings]                              |
+===========================================================================+
```

### 1.2 Key Layout Principles

#### Horizontal Timeline Dominance
- The timeline is the **soul** of the interface
- All user audio streams visualized as horizontal track lanes
- Real-time waveform rendering synchronized across all clients
- Vertical playhead with glow effect traverses all tracks

#### Three-Zone Layout
1. **Track Headers (Left)** - User info, meters, solo/mute
2. **Arrangement Canvas (Center)** - Scrollable timeline with all tracks
3. **Panel Dock (Right)** - Contextual panels (mixer, chat, AI, queue)

#### Collapsible Sections
- Bottom dock slides up/down for additional tools
- Panel dock can minimize to icon strip
- Track lanes can be collapsed individually
- Keyboard shortcuts for all toggles

---

## Part 2: Visual Design System

### 2.1 Color Palette

```css
/* Core Dark Theme */
--bg-primary: #0a0a0f;        /* Deep space black */
--bg-secondary: #12121a;      /* Elevated surfaces */
--bg-tertiary: #1a1a24;       /* Cards, panels */
--bg-elevated: #22222e;       /* Hover states */

/* Glass Effects */
--glass-bg: rgba(255, 255, 255, 0.03);
--glass-border: rgba(255, 255, 255, 0.08);
--glass-blur: 20px;

/* Accent Colors - Neon Palette */
--accent-primary: #6366f1;    /* Electric Indigo */
--accent-secondary: #8b5cf6;  /* Vivid Purple */
--accent-success: #10b981;    /* Emerald */
--accent-warning: #f59e0b;    /* Amber */
--accent-danger: #ef4444;     /* Red */
--accent-info: #06b6d4;       /* Cyan */

/* Neon Glow Effects */
--glow-primary: 0 0 20px rgba(99, 102, 241, 0.5);
--glow-success: 0 0 15px rgba(16, 185, 129, 0.5);
--glow-warning: 0 0 15px rgba(245, 158, 11, 0.5);

/* Track Lane Colors (per-user, distinct) */
--track-1: #f472b6;   /* Pink */
--track-2: #fb923c;   /* Orange */
--track-3: #a3e635;   /* Lime */
--track-4: #22d3ee;   /* Cyan */
--track-5: #a78bfa;   /* Violet */
--track-6: #fbbf24;   /* Yellow */

/* Stem Colors */
--stem-vocals: #ec4899;   /* Pink */
--stem-drums: #f97316;    /* Orange */
--stem-bass: #22c55e;     /* Green */
--stem-other: #3b82f6;    /* Blue */

/* Text Hierarchy */
--text-primary: #ffffff;
--text-secondary: #a1a1aa;
--text-muted: #71717a;
--text-disabled: #3f3f46;
```

### 2.2 Typography

```css
/* Font Stack */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
--font-sans: 'Inter', -apple-system, sans-serif;
--font-display: 'Plus Jakarta Sans', sans-serif;

/* Type Scale */
--text-xs: 0.75rem;    /* 12px - Labels, hints */
--text-sm: 0.875rem;   /* 14px - Body small */
--text-base: 1rem;     /* 16px - Body */
--text-lg: 1.125rem;   /* 18px - Subheadings */
--text-xl: 1.25rem;    /* 20px - Headings */
--text-2xl: 1.5rem;    /* 24px - Titles */
--text-3xl: 2rem;      /* 32px - Display */

/* Time Display (Monospace) */
.time-display {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
```

### 2.3 Glassmorphism System

```css
/* Panel Glass Effect */
.glass-panel {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.05) 0%,
    rgba(255, 255, 255, 0.02) 100%
  );
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* Elevated Glass (for modals, popovers) */
.glass-elevated {
  background: linear-gradient(
    180deg,
    rgba(30, 30, 45, 0.95) 0%,
    rgba(20, 20, 30, 0.98) 100%
  );
  backdrop-filter: blur(40px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### 2.4 Micro-Interactions & Animations

```css
/* Standard Transitions */
--transition-fast: 75ms ease-out;
--transition-base: 150ms ease-out;
--transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-spring: 500ms cubic-bezier(0.175, 0.885, 0.32, 1.275);

/* Playhead Animation */
@keyframes playhead-pulse {
  0%, 100% { box-shadow: 0 0 10px var(--accent-primary); }
  50% { box-shadow: 0 0 25px var(--accent-primary), 0 0 40px var(--accent-secondary); }
}

/* Level Meter Animation */
@keyframes meter-glow {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.3); }
}

/* Track Active State */
@keyframes track-speaking {
  0%, 100% { border-color: rgba(99, 102, 241, 0.3); }
  50% { border-color: rgba(99, 102, 241, 0.8); }
}
```

---

## Part 3: Component Specifications

### 3.1 Transport Bar (Fixed Top)

```
+-----------------------------------------------------------------------------------+
|  [LOGO] │ Room: ABC123 [Copy] │ ◄◄ ▶/▮▮ ►► │ 00:01:23.456 / 03:45.200 │ 120 BPM   |
|         │                      │            │                           │           |
|         │ [Quality: Excellent] │   [Loop]   │ [Key: C Major] [Tuner]   │ [You ▼]   |
+-----------------------------------------------------------------------------------+
```

#### Transport Controls Detail

```tsx
interface TransportBar {
  // Left Section
  logo: BrandMark;
  roomInfo: {
    code: string;           // "ABC123"
    copyButton: IconButton;
    connectionQuality: Badge; // With color-coded dot
  };

  // Center Section - Transport
  transport: {
    skipBack: IconButton;
    playPause: LargePlayButton;  // 48px, prominent
    skipForward: IconButton;
    loop: ToggleButton;

    // Time Display
    timeDisplay: {
      current: "00:01:23.456";  // Monospace, milliseconds
      separator: "/";
      total: "03:45.200";
    };
  };

  // Right Section - Analysis & User
  analysis: {
    bpmBadge: { value: 120, unit: "BPM" };
    keyBadge: { key: "C", scale: "Major", color: "#ef4444" };
    tunerButton: ToggleButton;
  };

  userMenu: {
    avatar: UserAvatar;
    name: "You";
    dropdown: [
      "Audio Settings",
      "Keyboard Shortcuts",
      "---",
      "Leave Room"
    ];
  };
}
```

**Visual Details:**
- **Play Button**: 48x48px circular, gradient fill, subtle glow on hover
- **Time Display**: Monospace font, tabular figures, slight text glow
- **BPM/Key Badges**: Pill shape, subtle gradient, color-coded
- **Quality Indicator**: Animated dot (green pulse = excellent)

### 3.2 Track Headers Panel

Each user becomes a "track" with full DAW-style controls:

```
+----------------------------------+
|  [■] Mute  [S] Solo  [●] Record  |
|                                  |
|  +------+  You (Guitar)    [···] |
|  | AVTR |  ─────────────────     |
|  |  B   |  ▓▓▓▓▓▓▓▓▓░░░░░░  -12dB|
|  +------+  ─────────────────     |
|                                  |
|  Latency: 12ms  Buffer: 256      |
|  +---------------------------+   |
|  |  [Pan ----●----]          |   |
|  |  [Volume ========●===]    |   |
|  +---------------------------+   |
+----------------------------------+
```

```tsx
interface TrackHeader {
  controls: {
    mute: ToggleButton;      // [M] - dims track
    solo: ToggleButton;      // [S] - mutes all others
    record: RecordButton;    // [●] - red when armed
  };

  userInfo: {
    avatar: ColoredAvatar;   // Gradient circle with initial
    name: string;
    instrument: InstrumentBadge;
    isLocal: boolean;
    isMaster: boolean;       // Crown indicator
    contextMenu: "..." button;
  };

  metering: {
    levelMeter: StereoMeter; // L/R with peak hold
    peakValue: "-12dB";      // Numeric readout
  };

  connectionStats: {
    latency: "12ms";
    buffer: "256";
    quality: QualityDot;
  };

  mixControls: {
    pan: Knob | Slider;      // -100 to +100
    volume: VerticalFader;   // 0 to +6dB
  };
}
```

**Visual Details:**
- **Avatar**: 44px, gradient border when speaking
- **Level Meter**: Dual-bar stereo, gradient from green→yellow→red
- **Peak Hold**: Thin line that decays slowly
- **Fader Track**: Subtle groove texture, glowing thumb

### 3.3 Track Lane (Arrangement View)

Each user's audio is visualized as a horizontal track lane:

```
+----------------+----------------------------------------------------------+
| Track Header   | Waveform Visualization + Grid Lines                      |
| (from panel)   |                                                          |
|                | Bar 1     | Bar 2     | Bar 3     | Bar 4     | Bar 5    |
|                | ░░▓▓▓▓▓▓▓▓░░░░▓▓▓▓▓▓░░▓▓▓░░░▓▓▓▓▓░░░░▓▓▓▓▓▓▓▓░░░░▓▓    |
|                |           |           |     ▼     |           |          |
+----------------+------------|-----------|--PLAYHEAD-|-----------|----------+
```

```tsx
interface TrackLane {
  waveform: {
    data: Float32Array;       // Real-time audio amplitude
    color: string;            // User's track color
    style: "bars" | "wave" | "filled";
    opacity: number;          // Dims when muted
  };

  grid: {
    bars: VerticalLines;      // Beat/bar markers
    labels: BarNumbers;       // "1", "2", "3"...
    snap: boolean;            // Quantize to grid
  };

  playhead: {
    position: number;         // 0-1 progress
    style: "line" | "triangle";
    glow: boolean;            // Neon effect
  };

  interactions: {
    hover: HighlightRegion;
    click: SeekToPosition;    // Master only
    drag: RegionSelect;       // Future: loop regions
  };
}
```

**Rendering Details:**
- **Waveform Style**: Real-time FFT data rendered as vertical bars
- **Color Coding**: Each user has distinct color matching their avatar
- **Speaking Indicator**: Waveform pulses brighter when audio detected
- **Muted State**: 30% opacity, desaturated

### 3.4 Master Mixer Panel

When stems are separated, the mixer becomes a powerful mixing console:

```
+-----------------------------------------------+
|  STEM MIXER                    [Separate ▼]   |
+-----------------------------------------------+
|                                               |
|  Vocals    Drums     Bass      Other          |
|  [====]    [====]    [====]    [====]         |
|    ●         ●         ●         ●            |
|    |         |         |         |    <faders>|
|    |         |         |         |            |
|    |         |         |         |            |
|   ▼▼        ▼▼        ▼▼        ▼▼            |
|  -∞ dB    -∞ dB     -∞ dB     -∞ dB           |
|                                               |
|  [M][S]    [M][S]    [M][S]    [M][S]         |
|                                               |
|  +--+ Pan  +--+ Pan  +--+ Pan  +--+ Pan       |
|  |●-|      |-●|      |●-|      |-●|           |
|  +--+      +--+      +--+      +--+           |
|                                               |
|  [VU====]  [VU====]  [VU====]  [VU====]       |
+-----------------------------------------------+
|  MASTER                                       |
|  [=========●=========] -0.3dB                 |
|  [VU==============] [VU==============]        |
+-----------------------------------------------+
```

```tsx
interface StemMixerPanel {
  header: {
    title: "Stem Mixer";
    separateButton: DropdownButton; // Trigger separation
    presets: PresetSelector;        // "Karaoke", "Drums Only", etc.
  };

  channels: StemChannel[]; // One per stem

  masterSection: {
    fader: HorizontalSlider;
    meter: StereoVUMeter;
    limiter: LimiterIndicator;
  };
}

interface StemChannel {
  stem: "vocals" | "drums" | "bass" | "other";
  color: string;

  fader: {
    value: number;         // -Infinity to +6 dB
    style: "vertical";
    height: 120;           // px
  };

  meter: VUMeter;
  mute: ToggleButton;
  solo: ToggleButton;
  pan: PanKnob;

  label: string;
  icon: LucideIcon;
}
```

### 3.5 Analysis Panel

Real-time audio analysis with stunning visualizations:

```
+-----------------------------------------------+
|  ANALYSIS                          [⚙ Config] |
+-----------------------------------------------+
|                                               |
|  +------------------+  +------------------+   |
|  |                  |  |                  |   |
|  |   KEY: C MAJOR   |  |   TEMPO: 120     |   |
|  |   ●●●●●●●○○○     |  |   BPM            |   |
|  |   Confidence 85% |  |   ████████░░     |   |
|  +------------------+  +------------------+   |
|                                               |
|  SPECTRUM ANALYZER                            |
|  ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▁▂▃▄▅▆▇█▇▆▅▄▃▂▁             |
|  20Hz            1kHz            20kHz        |
|                                               |
|  CURRENT CHORD                                |
|  +-------------------------------------------+|
|  |            Cmaj7                          ||
|  |       (C - E - G - B)                     ||
|  +-------------------------------------------+|
|                                               |
|  +--------------- TUNER -----------------+   |
|  |              ♯ A 440Hz ♭              |   |
|  |    ◄━━━━━━━━━━│━━━━━━━━━━►            |   |
|  |              -2 cents                 |   |
|  +---------------------------------------+   |
+-----------------------------------------------+
```

```tsx
interface AnalysisPanel {
  header: {
    title: "Analysis";
    configButton: IconButton;
    sourceSelector: "Track" | "Mic" | "Mix";
  };

  keyDisplay: {
    key: "C";
    scale: "Major" | "Minor";
    confidence: 0.85;
    colorDot: string;        // Key-based color
    circleOfFifths: boolean; // Visual indicator
  };

  tempoDisplay: {
    bpm: 120;
    confidence: 0.92;
    tap: TapTempoButton;
  };

  spectrum: {
    type: "bars" | "line" | "filled";
    bands: 64 | 128 | 256;
    gradient: ["#6366f1", "#8b5cf6", "#ec4899"];
    labels: ["20Hz", "1kHz", "20kHz"];
  };

  chord: {
    name: "Cmaj7";
    notes: ["C", "E", "G", "B"];
    diagram: PianoRoll | GuitarFretboard;
  };

  tuner: {
    note: "A";
    frequency: 440;
    cents: -2;
    indicator: TunerNeedle;
    inTune: boolean;         // Green when |cents| < 5
  };
}
```

**Visual Details:**
- **Spectrum Analyzer**: WebGL-rendered for 60fps, gradient fill
- **Key Display**: Color matches note (C=red, D=orange, etc.)
- **Tuner Needle**: Physics-based animation, smooth movement
- **Chord Diagram**: Optional piano/guitar visualization

### 3.6 Track Queue Panel

```
+-----------------------------------------------+
|  QUEUE                             [+ Add ▼]  |
+-----------------------------------------------+
|  NOW PLAYING                                  |
|  +-------------------------------------------+|
|  | ▶ Highway to Hell              03:28      ||
|  |   AC/DC                                   ||
|  |   [====●==================] 01:23         ||
|  +-------------------------------------------+|
|                                               |
|  UP NEXT                                      |
|  +-------------------------------------------+|
|  | 2. Bohemian Rhapsody           05:55      ||
|  |    Queen                      [AI] [···]  ||
|  +-------------------------------------------+|
|  | 3. Back in Black              04:15       ||
|  |    AC/DC                      [YT] [···]  ||
|  +-------------------------------------------+|
|  | 4. Sweet Child O' Mine        05:56       ||
|  |    Guns N' Roses              [Up] [···]  ||
|  +-------------------------------------------+|
|                                               |
|  Drag to reorder • Master controls playback   |
+-----------------------------------------------+
```

```tsx
interface QueuePanel {
  header: {
    title: "Queue";
    addButton: DropdownButton; // Upload, YouTube, AI
  };

  nowPlaying: {
    track: BackingTrack;
    progress: ProgressBar;
    controls: PlayPauseButton; // Master only
  };

  upNext: DraggableList<QueueItem>;

  footer: {
    hint: string;
  };
}

interface QueueItem {
  track: BackingTrack;
  position: number;
  source: "upload" | "youtube" | "ai";
  actions: {
    remove: IconButton;
    moveUp: IconButton;
    moveDown: IconButton;
  };
}
```

### 3.7 Chat Panel

```
+-----------------------------------------------+
|  CHAT                             [Minimize]  |
+-----------------------------------------------+
|                                               |
|  [System] Room created                        |
|                                               |
|  [John 2:34pm]                                |
|  Ready to jam! Let's start with the intro    |
|                                               |
|  [You 2:35pm]                                 |
|  Sounds good, I'll count us in               |
|                                               |
|  [Sarah 2:35pm]                               |
|  🎹 Nice! I'll follow your lead              |
|                                               |
+-----------------------------------------------+
|  [Type a message...            ] [Send]       |
+-----------------------------------------------+
```

**Visual Details:**
- **Message Bubbles**: Subtle glass effect, user color accent
- **Timestamps**: Muted, relative time
- **System Messages**: Italic, centered
- **Input Field**: Glass background, focus glow

---

## Part 4: Innovative Features

### 4.1 Spatial Audio Positioning (2D Panner)

A breakthrough feature: position each user in stereo space visually.

```
+------------------------------------------+
|  SPATIAL MIX                             |
|                                          |
|           Front                          |
|      +-------------+                     |
|      |      ●      |  <- You (center)    |
|   L  |  ○      ○   |  R  <- Others       |
|      |      ○      |                     |
|      +-------------+                     |
|           Back                           |
|                                          |
|  Drag users to position in stereo field  |
+------------------------------------------+
```

```tsx
interface SpatialMixer {
  canvas: {
    width: 280;
    height: 200;
    background: RadialGradient;
  };

  users: DraggableNode[]; // Each user is a draggable circle

  calculatePan: (x: number) => number;      // -1 to 1
  calculateVolume: (y: number) => number;   // Distance-based

  presets: [
    "Circle",      // Everyone in a ring
    "Stage",       // Band formation
    "Orchestra",   // Section positioning
  ];
}
```

### 4.2 AI Assistant Integration

A dedicated AI panel for music assistance:

```
+-----------------------------------------------+
|  AI ASSISTANT                    [Suno] [SAM] |
+-----------------------------------------------+
|                                               |
|  [Generate Track Tab]                         |
|  +-------------------------------------------+|
|  | Describe your track:                      ||
|  | [An upbeat rock song with driving drums  ]||
|  | [and catchy guitar riffs, 120 BPM        ]||
|  |                                           ||
|  | Style: [Rock ▼]  Duration: [3:00 ▼]       ||
|  |                                           ||
|  | [✨ Generate with Suno]                   ||
|  +-------------------------------------------+|
|                                               |
|  [Separate Track Tab]                         |
|  +-------------------------------------------+|
|  | Current Track: Highway to Hell            ||
|  |                                           ||
|  | [🎭 Separate Stems with Meta SAM]         ||
|  |                                           ||
|  | ████████░░ 80% - Extracting vocals...     ||
|  +-------------------------------------------+|
|                                               |
+-----------------------------------------------+
```

### 4.3 Keyboard Shortcuts Overlay

Press `?` to show shortcuts:

```
+-----------------------------------------------+
|  KEYBOARD SHORTCUTS                    [×]    |
+-----------------------------------------------+
|                                               |
|  TRANSPORT                                    |
|  Space ................ Play / Pause          |
|  ← → .................. Seek 5 seconds        |
|  Shift + ← → .......... Seek 30 seconds       |
|  [ ] .................. Previous / Next       |
|                                               |
|  MIXING                                       |
|  M .................... Mute yourself         |
|  1-9 .................. Solo track 1-9        |
|  Shift + 1-9 .......... Mute track 1-9        |
|                                               |
|  PANELS                                       |
|  Tab .................. Cycle panels          |
|  Q .................... Toggle queue          |
|  A .................... Toggle analysis       |
|  C .................... Toggle chat           |
|                                               |
|  ? .................... Show this dialog      |
+-----------------------------------------------+
```

### 4.4 Session Recording Indicator

When recording is enabled (future feature):

```
+--------------------------------------------------+
|  ● REC  00:15:32  [Stop Recording]               |
+--------------------------------------------------+
```

- Pulsing red dot animation
- Session duration counter
- Ability to mark loop points
- Export multitrack or mixdown

### 4.5 Metronome with Visual Beat

```
+---------------------------+
|  METRONOME        [On/Off]|
|                           |
|   ●   ○   ○   ○          |
|   1   2   3   4          |
|                           |
|  120 BPM  [Tap]  [+] [-]  |
|                           |
|  Sound: [Click ▼]         |
|  Subdivision: [1/4 ▼]     |
+---------------------------+
```

---

## Part 5: Responsive Behavior

### 5.1 Desktop (1440px+)

Full layout with all panels visible:
- Track headers: 240px
- Arrangement: Fluid
- Panel dock: 320px
- Bottom dock: Collapsible 200px

### 5.2 Laptop (1024px - 1439px)

Condensed layout:
- Track headers: 180px (simplified)
- Arrangement: Fluid
- Panel dock: 280px
- Bottom dock: Hidden by default

### 5.3 Tablet (768px - 1023px)

Mobile-optimized:
- Track headers: Full width, horizontal scroll
- Arrangement: Full width, below headers
- Panels: Tab-based bottom sheet
- Transport: Sticky bottom bar

### 5.4 Mobile (< 768px)

Essential features only:
- Simplified transport
- User list as horizontal avatars
- Single panel at a time (sheet)
- Large touch targets (48px minimum)

---

## Part 6: Implementation Architecture

### 6.1 New Component Structure

```
src/components/
├── layout/
│   ├── DAWLayout.tsx           # Main layout orchestrator
│   ├── TransportBar.tsx        # Top bar with transport
│   ├── TrackHeadersPanel.tsx   # Left panel
│   ├── ArrangementView.tsx     # Center canvas
│   ├── PanelDock.tsx           # Right panels
│   └── BottomDock.tsx          # Collapsible bottom
│
├── tracks/
│   ├── TrackHeader.tsx         # Single track header
│   ├── TrackLane.tsx           # Waveform lane
│   ├── TrackMeter.tsx          # Level meter (vertical)
│   ├── Playhead.tsx            # Animated playhead
│   └── Timeline.tsx            # Time ruler
│
├── mixer/
│   ├── StemMixerPanel.tsx      # Full mixer panel
│   ├── ChannelStrip.tsx        # Single channel
│   ├── Fader.tsx               # Skeuomorphic fader
│   ├── PanKnob.tsx             # Pan control
│   ├── VUMeter.tsx             # VU-style meter
│   └── SpatialMixer.tsx        # 2D positioning
│
├── analysis/
│   ├── AnalysisPanel.tsx       # Full analysis panel
│   ├── SpectrumAnalyzer.tsx    # WebGL spectrum
│   ├── KeyDisplay.tsx          # Key badge
│   ├── TempoDisplay.tsx        # BPM display
│   ├── ChordDisplay.tsx        # Current chord
│   └── Tuner.tsx               # Tuner needle
│
├── ai/
│   ├── AIPanel.tsx             # AI assistant panel
│   ├── GeneratorForm.tsx       # Suno generator
│   ├── SeparatorProgress.tsx   # SAM progress
│   └── PromptInput.tsx         # Styled prompt input
│
├── queue/
│   ├── QueuePanel.tsx          # Queue panel
│   ├── NowPlaying.tsx          # Current track
│   ├── QueueList.tsx           # Draggable list
│   └── QueueItem.tsx           # Single item
│
├── chat/
│   ├── ChatPanel.tsx           # Chat panel
│   ├── MessageList.tsx         # Message list
│   ├── MessageBubble.tsx       # Single message
│   └── ChatInput.tsx           # Input field
│
└── ui/
    ├── GlassCard.tsx           # Glass effect card
    ├── NeonButton.tsx          # Glowing button
    ├── VerticalFader.tsx       # DAW-style fader
    ├── Knob.tsx                # Rotary knob
    ├── Badge.tsx               # Pill badges
    ├── Tooltip.tsx             # Enhanced tooltips
    └── ContextMenu.tsx         # Right-click menu
```

### 6.2 State Management Extensions

```typescript
// stores/layout-store.ts
interface LayoutStore {
  // Panel visibility
  panelDock: {
    visible: boolean;
    activePanel: "mixer" | "analysis" | "queue" | "chat" | "ai";
    width: number;
  };

  bottomDock: {
    visible: boolean;
    height: number;
  };

  // Track display
  trackLanes: {
    collapsed: Set<string>;  // Collapsed track IDs
    heights: Map<string, number>;
  };

  // Arrangement
  arrangement: {
    zoom: number;            // Horizontal zoom level
    scroll: number;          // Scroll position
    gridSnap: boolean;
  };

  // Preferences
  preferences: {
    waveformStyle: "bars" | "wave" | "filled";
    meterStyle: "peak" | "vu" | "loudness";
    colorMode: "auto" | "user" | "instrument";
  };
}
```

### 6.3 Real-Time Waveform Rendering

```typescript
// lib/audio/waveform-renderer.ts
class WaveformRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private analyser: AnalyserNode;

  constructor(canvas: HTMLCanvasElement, analyser: AnalyserNode) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2')!;
    this.analyser = analyser;
    this.initShaders();
  }

  // WebGL shaders for high-performance rendering
  private initShaders(): void {
    // Vertex shader for waveform bars
    // Fragment shader with gradient coloring
    // Instanced rendering for efficiency
  }

  // Called on each animation frame
  render(color: string, intensity: number): void {
    const data = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatTimeDomainData(data);

    // Upload to GPU and render
    // Apply glow effect when intensity > threshold
  }
}
```

### 6.4 Animation System

```typescript
// hooks/useSpring.ts
function useSpring(
  target: number,
  config: { tension: number; friction: number }
): number {
  // Physics-based spring animation
  // Used for faders, knobs, meters
  // Smooth 60fps interpolation
}

// hooks/usePlayhead.ts
function usePlayhead(
  currentTime: number,
  duration: number
): { position: number; isAnimating: boolean } {
  // Smooth playhead animation
  // Synced to audio context time
  // Accounts for latency
}
```

---

## Part 7: CSS Custom Properties

```css
/* globals.css additions */

:root {
  /* Layout dimensions */
  --transport-height: 56px;
  --track-header-width: 240px;
  --panel-dock-width: 320px;
  --bottom-dock-height: 200px;
  --track-lane-height: 80px;

  /* Timing curves */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out-circ: cubic-bezier(0.85, 0, 0.15, 1);
  --spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);

  /* Z-index layers */
  --z-base: 0;
  --z-track-headers: 10;
  --z-playhead: 20;
  --z-transport: 30;
  --z-panel-dock: 40;
  --z-modal-backdrop: 50;
  --z-modal: 60;
  --z-toast: 70;

  /* Audio visualization */
  --meter-gradient: linear-gradient(
    to top,
    #22c55e 0%,
    #22c55e 60%,
    #eab308 60%,
    #eab308 85%,
    #ef4444 85%,
    #ef4444 100%
  );
}
```

---

## Part 8: Implementation Phases

### Phase 1: Foundation (Core Layout)
1. Create `DAWLayout.tsx` with three-zone grid
2. Implement `TransportBar.tsx` with new design
3. Build `TrackHeadersPanel.tsx` with basic track headers
4. Create `ArrangementView.tsx` with playhead
5. Set up dark theme and glass effects

### Phase 2: Tracks & Waveforms
1. Implement `TrackLane.tsx` with real-time waveform
2. Create WebGL `WaveformRenderer` for performance
3. Add `TrackMeter.tsx` with peak hold
4. Build `Playhead.tsx` with glow animation
5. Implement `Timeline.tsx` with zoom/scroll

### Phase 3: Mixer & Controls
1. Create `StemMixerPanel.tsx` with channel strips
2. Build `Fader.tsx` and `PanKnob.tsx` components
3. Implement `VUMeter.tsx` with smooth animation
4. Add `SpatialMixer.tsx` 2D positioning

### Phase 4: Analysis & AI
1. Enhance `AnalysisPanel.tsx` with new visualizations
2. Create WebGL `SpectrumAnalyzer.tsx`
3. Build `Tuner.tsx` with needle physics
4. Implement `AIPanel.tsx` with tabbed interface

### Phase 5: Polish & Integration
1. Add keyboard shortcuts system
2. Implement responsive layouts
3. Create micro-animations and transitions
4. Performance optimization
5. Accessibility enhancements

---

## Summary

This redesign transforms OpenStudio into a **world-class browser-based DAW** that:

1. **Looks Professional**: Dark theme, glassmorphism, neon accents rival desktop DAWs
2. **Feels Responsive**: WebGL rendering, spring animations, 60fps throughout
3. **Empowers Musicians**: Every user is a track, full mixing capabilities
4. **Innovates**: Spatial mixing, AI integration, real-time collaboration
5. **Scales**: Modular panels, responsive design, keyboard-first navigation

The horizontal timeline-centric layout puts the music first, while the modular panel system gives each musician the tools they need without overwhelming the interface.
