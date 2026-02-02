<div align="center">

# 🎸 OpenStudio

### **The Open Source DAW in Your Browser**

*Finally, jam with anyone, anywhere — with latency so low it feels like you're in the same room.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-Native_Bridge-orange?logo=rust)](https://www.rust-lang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

[**Try Demo**](#getting-started) · [**Documentation**](/docs) · [**Discord**](#community) · [**Contributing**](#contributing)

---

<img src="https://raw.githubusercontent.com/openstudio-cafe/openstudio/main/docs/assets/demo.gif" alt="OpenStudio Demo" width="800">

</div>

---

OpenStudio is a **browser-based collaborative music studio** that achieves **sub-30ms latency** worldwide — low enough to actually play music together in real-time.

```
┌─────────────────────────────────────────────────────────────────┐
│  🎸 Guitarist (NYC)     🥁 Drummer (London)    🎹 Keys (Tokyo)  │
│         ↓                      ↓                      ↓         │
│    [ 8ms ]               [ 12ms ]               [ 15ms ]        │
│         ↓                      ↓                      ↓         │
│         └──────────→ Cloudflare SFU ←────────────────┘          │
│                    (Nearest Edge PoP)                           │
│                            ↓                                    │
│              Everyone hears everyone in sync                    │
└─────────────────────────────────────────────────────────────────┘
```

**No downloads. No configuration. Just open a link and play.**

---

## ✨ Features

### 🎚️ Professional Audio Engine

| Feature | Description |
|---------|-------------|
| **Sub-30ms Global Latency** | Cloudflare's 300+ edge locations mean you're always close to a server |
| **Native Bridge Mode** | Optional Rust driver for **5-10ms latency** via ASIO/CoreAudio |
| **Adaptive Jitter Buffer** | AI-powered buffer that learns your network (128-1024 samples) |
| **35+ DSP Effects** | Compressor, reverb, delay, chorus, amp sims, and [much more](#effects-library) |
| **Master Clock Sync** | Sub-millisecond beat synchronization across all participants |

### 🤖 AI-Powered Creation

| Feature | Description |
|---------|-------------|
| **AI Stem Separation** | Isolate vocals, drums, bass, and instruments from any track (Meta SAM) |
| **Real-time Music AI** | Google Lyria integration for live music generation |

### 🎵 Complete Backing Track System

- **Track Queue** — Upload MP3/WAV or generate with AI
- **Stem Mixer** — Individual volume/mute for separated stems
- **Synchronized Playback** — Room master controls, everyone stays perfectly in sync
- **100+ MIDI Loop Library** — Drums, bass, chords across 10+ genres
- **Instant Band Presets** — One-click full band arrangements

### 🎮 Gamification & Social

- **XP & Leveling** — Earn XP for jamming, unlock new features
- **Daily Streaks** — Keep your streak alive, use freezes when you can't play
- **50+ Achievements** — Hidden and visible achievements to discover
- **Leaderboards** — Compete on jam time, collaborators, and more
- **Avatar System** — Customize your character with unlockable items
- **Following & Friends** — Build your musician network

### 🎨 Beautiful Interface

- **Animated Homepage** — 6 beautiful scenes (Campfire, Rooftop, Beach, Studio, Space, Forest)
- **3D Waveform Visualizer** — Real-time audio visualization
- **Connection Quality Indicators** — See everyone's latency at a glance
- **Dark Mode** — Easy on the eyes for late-night sessions

---

## 🎛️ Effects Library

OpenStudio includes **35 professional-grade effects**, all custom-implemented with real DSP algorithms:

<details>
<summary><b>🔊 Dynamics & EQ (6 effects)</b></summary>

- Noise Gate
- Compressor
- Multiband Compressor
- Limiter
- Parametric EQ
- Transient Shaper
</details>

<details>
<summary><b>🎸 Amp & Drive (12 effects)</b></summary>

- Overdrive
- 5 Distortion Types (Tube, Fuzz, Metal, Crunch, Saturation)
- 6 Amp Simulators (Clean, Crunch, High Gain, British, American, Acoustic)
- Cabinet Simulation
</details>

<details>
<summary><b>🌊 Modulation (8 effects)</b></summary>

- Chorus
- Flanger
- Phaser
- Tremolo
- Vibrato
- Auto Pan
- Rotary Speaker
- Ring Modulator
</details>

<details>
<summary><b>🏔️ Time & Space (6 effects)</b></summary>

- 4 Delay Types (Digital, Analog, Tape, Ping Pong)
- Stereo Delay
- Granular Delay
- Reverb
- Room Simulator
- Shimmer Reverb
</details>

<details>
<summary><b>🎤 Vocal & Pitch (6 effects)</b></summary>

- Pitch Correction (Auto-Tune style)
- Harmonizer (key-aware)
- Formant Shifter
- Frequency Shifter
- Vocal Doubler
- De-esser
</details>

<details>
<summary><b>🔧 Utility (4 effects)</b></summary>

- Wah
- Bitcrusher
- Exciter
- Stereo Imager
</details>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OPENSTUDIO                                  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │   React 19  │  │  Zustand 5  │  │ AudioWorklet│  │ Essentia  │  │
│  │  Next.js 16 │  │   Stores    │  │  DSP Engine │  │ Analysis  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘  │
│         │                │                │                │        │
│  ┌──────┴────────────────┴────────────────┴────────────────┴─────┐  │
│  │                    Core Audio Engine                          │  │
│  │  • Adaptive Jitter Buffer  • Effects Chain  • Master Clock    │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
│                                  │                                  │
├──────────────────────────────────┼──────────────────────────────────┤
│         BROWSER PATH             │          NATIVE PATH             │
│  ┌──────────────────────┐        │   ┌────────────────────────┐    │
│  │   Web Audio API      │        │   │   Rust Native Bridge   │    │
│  │   getUserMedia       │        │   │   CPAL + ASIO/CoreAudio│    │
│  │   ~25-50ms latency   │        │   │   5-10ms latency       │    │
│  └──────────┬───────────┘        │   └──────────┬─────────────┘    │
│             │                    │              │                   │
│             └──────────┬─────────┴──────────────┘                   │
│                        │                                            │
├────────────────────────┼────────────────────────────────────────────┤
│  ┌─────────────────────┴─────────────────────────────────────────┐  │
│  │                    CLOUDFLARE EDGE                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │  │
│  │  │WebRTC SFU│  │ MoQ Relay│  │ R2 Storage│  │ 300+ Global  │  │  │
│  │  │ (Calls)  │  │(QUIC/UDP)│  │ (Tracks) │  │ Edge PoPs    │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    SUPABASE                                 │    │
│  │  PostgreSQL │ Realtime Sync │ Auth │ RLS Security │ 40+ Tables   │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### How Sync Works

1. **Room master** sends play command with timestamp 100ms in the future
2. **Supabase Realtime** broadcasts to all clients instantly
3. **Each client** schedules local playback for that exact moment
4. **Result:** Everyone's audio plays in perfect sync — no network latency affects the audio itself

---

## 🛠️ Tech Stack

<table>
<tr>
<td>

### Frontend
| Tech | Purpose |
|------|---------|
| React 19 | UI Framework |
| Next.js 16 | App Framework |
| TypeScript 5.9 | Type Safety |
| Tailwind CSS 4 | Styling |
| Framer Motion 12 | Animations |
| Zustand 5 | State Management |
| Konva | Avatar Rendering |

</td>
<td>

### Audio
| Tech | Purpose |
|------|---------|
| Web Audio API | Browser Audio |
| AudioWorklet | DSP Processing |
| Essentia.js | Music Analysis |
| WaveSurfer.js | Waveforms |
| Opus Codec | Compression |

</td>
<td>

### Backend
| Tech | Purpose |
|------|---------|
| Supabase | Database + Auth |
| Cloudflare Calls | WebRTC SFU |
| Cloudflare R2 | Object Storage |
| Cloudflare MoQ | Relay |

</td>
</tr>
</table>

### Native Bridge (Optional, for pro latency)

| Tech | Purpose |
|------|---------|
| **Rust** | Systems programming |
| **CPAL** | Cross-platform audio I/O |
| **Tokio** | Async runtime |
| **Quinn** | QUIC networking |
| **ratatui** | Terminal UI |

---

## 🚀 Getting Started

### Prerequisites

For the **best experience**:
- 🔌 **Wired ethernet** (Wi-Fi jitter causes audio glitches)
- 🎧 **Wired headphones** (prevents feedback)
- 🎚️ **Audio interface** with ASIO (Windows) or CoreAudio (macOS)
- 🌐 **Modern browser** (Chrome, Firefox, Edge with WebRTC)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/openstudio-cafe/openstudio.git
cd openstudio

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create your first room!

### Environment Variables

```env
# Required: Supabase (database + realtime)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Required: Cloudflare Calls (WebRTC)
NEXT_PUBLIC_CLOUDFLARE_CALLS_URL=https://rtc.live.cloudflare.com/v1
NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID=your_app_id
CLOUDFLARE_CALLS_APP_SECRET=your_app_secret

# Required: Cloudflare R2 (track storage)
CLOUDFLARE_R2_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key
CLOUDFLARE_R2_BUCKET_NAME=openstudio-tracks

# Optional: AI features
SUNO_API_KEY=your_suno_key          # AI track generation
SAM_API_KEY=your_sam_key            # Stem separation
GOOGLE_LYRIA_API_KEY=your_lyria_key # Real-time AI music
```

### Running the Native Bridge (Optional)

For ultra-low latency on supported hardware:

```bash
cd native-bridge
cargo build --release
./target/release/openstudio-bridge
```

The bridge connects to your browser session automatically via WebSocket.

---

## 📁 Project Structure

```
openstudio/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/               # 50+ API routes
│   │   ├── room/[roomId]/     # Room pages
│   │   └── page.tsx           # Landing page
│   ├── components/            # 23 component categories
│   │   ├── audio/             # Visualizers, meters
│   │   ├── avatar/            # Avatar system
│   │   ├── effects/           # Effects UI
│   │   ├── room/              # Room components
│   │   └── ui/                # Base components
│   ├── hooks/                 # 17+ custom hooks
│   ├── lib/                   # 17 libraries
│   │   ├── audio/             # Core audio engine
│   │   ├── effects/           # DSP implementations
│   │   ├── loops/             # MIDI loop library
│   │   └── music-analysis/    # Key/BPM detection
│   └── stores/                # Zustand stores
├── native-bridge/             # Rust native audio
│   └── src/                   # 65 Rust files
├── docs/                      # Documentation
└── public/                    # Static assets
```

---

## 🤝 Contributing

We'd love your help making OpenStudio better! Here's how:

### Good First Issues

Look for issues tagged [`good first issue`](https://github.com/openstudio-cafe/openstudio/labels/good%20first%20issue) — these are great for getting started.

### Development Workflow

```bash
# Fork the repo, then:
git checkout -b feature/your-feature

# Make your changes, then:
npm run lint      # Check for issues
npm run typecheck # Verify types
npm run test      # Run tests

# Commit and push
git commit -m "feat: add amazing feature"
git push origin feature/your-feature
```

Then open a Pull Request!

### Code Standards

This is **production software** used by real musicians. Please ensure:

- ✅ No `unwrap()` or `panic!()` in production code
- ✅ All errors handled gracefully
- ✅ Tests for new functionality
- ✅ No warnings from `cargo clippy` or ESLint
- ✅ Formatted with `cargo fmt` and Prettier

See [CLAUDE.md](.claude/CLAUDE.md) for full code quality guidelines.

---

## 🗺️ Roadmap

- [x] Core jamming functionality
- [x] AI stem separation
- [x] AI track generation
- [x] Gamification system
- [x] Native bridge for ASIO/CoreAudio
- [ ] Mobile app (React Native)
- [ ] MIDI controller support
- [ ] Video chat integration
- [ ] Recording & export
- [ ] Plugin hosting (VST/AU)

---

## 💬 Community

- **Discord** — Coming soon
- **Twitter/X** — Coming soon
- **GitHub Discussions** — [Ask questions & share ideas](https://github.com/openstudio-cafe/openstudio/discussions)

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

**tl;dr:** Do whatever you want with this code. Attribution appreciated but not required.

---

## 🙏 Acknowledgments

Built on the shoulders of giants:

- [Cloudflare Calls](https://developers.cloudflare.com/calls/) — WebRTC infrastructure that makes sub-30ms possible
- [Supabase](https://supabase.com/) — Real-time database that just works
- [Meta Demucs](https://github.com/facebookresearch/demucs) — State-of-the-art stem separation
- [Suno AI](https://suno.ai/) — AI music generation
- [cpal](https://github.com/RustAudio/cpal) — Cross-platform audio in Rust
- [Opus](https://opus-codec.org/) — The codec that makes low-latency audio possible

---

<div align="center">

### ⭐ Star us on GitHub!

If OpenStudio helps you make music with friends, consider giving us a star.
It helps others discover the project and motivates us to keep improving.

[![Star History Chart](https://api.star-history.com/svg?repos=openstudio-cafe/openstudio&type=Date)](https://star-history.com/#openstudio-cafe/openstudio&Date)

---

**Made with 🎵 by musicians, for musicians**

[⬆ Back to top](#-openstudio)

</div>
