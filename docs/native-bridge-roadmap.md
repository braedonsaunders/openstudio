# Native Bridge Roadmap

> OpenStudio Protocol (OSP) - A high-performance, low-latency audio networking layer inspired by AOO (Audio over OSC) but extended with rich control messages for DAW collaboration.

## Protocol Overview

**OSP is NOT a fork of SonoBus.** It is a custom protocol that:

- Is inspired by AOO (Audio over OSC) - the protocol SonoBus uses
- Extends with DAW collaboration features (effects sync, multi-track, beat sync)
- Adds Cloudflare MoQ relay for scalability beyond P2P mesh limits

### Key Improvements Over SonoBus/AOO

- Multi-track support (up to 8 tracks per user)
- Full effects parameter synchronization
- Master clock with sub-ms beat sync
- Automatic P2P <-> relay switching
- Cloudflare MoQ integration for scalability

---

## Current Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Audio Engine Core | ✅ Done | ASIO/CoreAudio device access, ringbuffers |
| AudioBridgeHandle | ✅ Done | Thread-safe handle for network ops |
| Opus Codec | ✅ Done | Full encode/decode with FEC |
| Jitter Buffer | ✅ Done | Adaptive for live jamming |
| Clock Sync | ✅ Done | NTP-style sub-ms sync |
| QUIC/MoQ Relay Client | ✅ Done | Connects to relay servers |
| P2P Network | ✅ Done | UDP receive/heartbeat loops implemented |
| Effects Chain | ✅ Done | 29 effects fully implemented (Phase 1) |
| Audio-Network Bridge | ✅ Done | Started from server on room join |
| Transport Forwarding | ✅ Done | Clock sync, tempo, transport events forwarded |
| Network Reconnection | ✅ Done | Automatic reconnection with exponential backoff |
| Connection Health Monitor | ✅ Done | Monitors relay/P2P health, auto-recovers |

---

## Effects Implementation (Phase 1 - Complete)

All 29 effects implemented with custom DSP primitives:

### Base Effects (15)
- ✅ Wah (manual/auto/envelope modes)
- ✅ Overdrive (asymmetric soft clipping)
- ✅ Distortion (5 types: classic, hard, fuzz, asymmetric, rectifier)
- ✅ Amp simulation (6 types: clean, crunch, highgain, british, american, modern)
- ✅ Cabinet simulation (EQ-based speaker/mic modeling)
- ✅ Noise gate (state machine with attack/hold/release)
- ✅ EQ (multi-band parametric)
- ✅ Compressor (soft-knee dynamics)
- ✅ Chorus (3-voice modulated delay)
- ✅ Flanger (short modulated delay with feedback)
- ✅ Phaser (up to 12-stage allpass cascade)
- ✅ Delay (digital/analog/tape/pingpong types)
- ✅ Tremolo (LFO amplitude modulation)
- ✅ Reverb (Freeverb algorithm: 8 combs + 4 allpasses)
- ✅ Limiter (brickwall with lookahead)

### Extended Effects (14)
- ✅ Vocal Doubler (multi-voice ADT)
- ✅ De-esser (sidechain dynamics)
- ✅ Bitcrusher (sample rate/bit depth reduction)
- ✅ Ring Modulator (carrier frequency modulation)
- ✅ Auto Pan (LFO stereo panning)
- ✅ Multi-Filter (LP/HP/BP/Notch with modulation)
- ✅ Vibrato (pitch modulation via variable delay)
- ✅ Transient Shaper (attack/sustain control)
- ✅ Stereo Imager (M/S width control)
- ✅ Exciter (harmonic enhancement)
- ✅ Multiband Compressor (3-band with LR4 crossovers)
- ✅ Stereo Delay (independent L/R delays)
- ✅ Room Simulator (early reflections + reverb)
- ✅ Shimmer Reverb (pitch-shifted feedback)

### Deferred to Phase 2
- ⏳ Pitch Correction (requires pitch detection)
- ⏳ Harmonizer (requires pitch shifting)
- ⏳ Formant Shifter (vocal character change)
- ⏳ Frequency Shifter (Bode-style)
- ⏳ Granular Delay (grain-based processing)
- ⏳ Rotary Speaker (Leslie simulation)

---

## Completed Tasks Checklist

### CRITICAL - Blocking Production ✅ COMPLETE

- [x] **1. Fix `unimplemented!()` Panic**
  - Added `new_shared()` method for Arc-wrapped creation
  - Added `init_self_ref()` for post-Arc initialization
  - File: `src/network/manager.rs`

- [x] **2. Spawn P2P Receive/Send Loops**
  - Implemented `spawn_receive_loop()` for UDP packet processing
  - Implemented `spawn_heartbeat_loop()` for peer keepalive/timeout
  - File: `src/network/p2p.rs`

- [x] **3. Start AudioNetworkBridge from Protocol Server**
  - Bridge starts when user joins room via JoinRoom message
  - Bridge stops and cleans up on LeaveRoom
  - Files: `src/protocol/server.rs`, `src/main.rs`

- [x] **4. Wire Up Transport/Metronome Forwarding**
  - Added `TransportEvent` enum for clock sync, tempo, transport state
  - Bridge emits transport events via broadcast channel
  - File: `src/network/bridge.rs`

- [x] **5. Expose `send_packet` for P2P Control Broadcast**
  - Added public `broadcast_control()` method to P2P network
  - Manager now uses `broadcast_control()` for control/clock sync messages
  - Files: `src/network/p2p.rs`, `src/network/manager.rs`

---

### HIGH PRIORITY ✅ COMPLETE

- [x] **6. Implement Audio Effects**
  - All 29 effects fully implemented with custom DSP primitives
  - Core DSP: Biquad filters, delay lines, LFOs, envelope followers
  - Files: `src/effects/*.rs` (15+ files)

- [x] **7. Hook Mixer to Effects Chain**
  - EffectsChain processes audio in correct order
  - All effects properly wired with settings and metering
  - File: `src/effects/chain.rs`

- [x] **8. Add Reconnection Logic for Relay**
  - Exponential backoff reconnection implemented
  - Connection health monitoring loop
  - File: `src/network/manager.rs`

- [x] **9. Implement Error Recovery for Network Failures**
  - Automatic reconnection with configurable max attempts
  - P2P quality monitoring (packet loss, RTT warnings)
  - Graceful degradation notifications
  - File: `src/network/manager.rs`

---

### MEDIUM PRIORITY - Production Quality

#### 10. Adaptive Bitrate Based on Network Conditions
- Monitor packet loss and RTT
- Adjust Opus bitrate dynamically

#### 11. Packet Loss Concealment (PLC)
- Use Opus FEC for packet loss recovery
- Implement interpolation for missing frames

#### 12. Master Election for Clock Sync
- Implement `MasterElection` message type (OSP 0x0303)
- Elect lowest-latency peer as clock master

#### 13. WebSocket Heartbeat/Keepalive
- Detect stale connections
- Clean up resources for disconnected clients

#### 14. Metrics/Telemetry for Latency Monitoring
- Track RTT, jitter, packet loss per peer
- Expose via API for UI display

---

### LOW PRIORITY - Polish & Features

#### 15. Effect Parameter Sync to Remote Users
- When local user changes effect, broadcast to room

#### 16. Chat Message Handling
- Implement OSP message type 0x0207

#### 17. Permission System for Track Control
- Allow/deny remote control of tracks

#### 18. Lyria AI State Sync
- Sync AI-generated content state

#### 19. Loop State Synchronization
- Sync loop start/end/enabled state

#### 20. Platform-Specific Audio Optimizations
- Windows: ASIO exclusive mode
- macOS: CoreAudio low-latency settings
- Linux: JACK integration

---

### TESTING - Required Before Ship

#### 21. Integration Tests: P2P Audio Path
- Two clients on same machine
- Verify audio round-trip

#### 22. Integration Tests: Relay Audio Path
- Connect through actual MoQ relay
- Verify audio quality

#### 23. Stress Test: 8 Simultaneous Users
- Maximum performer count
- Monitor CPU, memory, latency

#### 24. Latency Benchmarks
- Target: <15ms RTT on LAN
- Measure encode + network + decode + buffer

#### 25. Network Failure Simulation
- Packet loss, high latency, disconnects
- Verify graceful handling

#### 26. Cross-Platform Tests
- Windows with ASIO
- macOS with CoreAudio
- Linux with ALSA/JACK

---

## DSP Architecture

### Core Primitives (`src/effects/dsp.rs`)

- **Biquad** - Direct Form II Transposed filter
  - All standard types: LP, HP, BP, Notch, Peak, LowShelf, HighShelf, Allpass
- **DelayLine** - Circular buffer with linear interpolation
- **LFO** - Waveforms: sine, triangle, square, sawtooth
- **EnvelopeFollower** - Attack/release dynamics
- **DcBlocker** - High-pass at ~10Hz

### Effect Processing Order

```
Wah → Overdrive → Distortion → Amp → Cabinet →
NoiseGate → DeEsser → TransientShaper →
EQ → Exciter → MultiFilter →
Compressor → MultibandCompressor →
Bitcrusher → RingMod → Chorus → Flanger → Phaser → Vibrato → Tremolo → AutoPan → VocalDoubler →
Delay → StereoDelay →
RoomSimulator → Reverb → ShimmerReverb →
StereoImager → Limiter
```

---

## Effort Estimates (Updated)

| Category | Tasks | Status |
|----------|-------|--------|
| Critical blockers | 5 | ✅ Complete |
| High priority | 4 | ✅ Complete |
| Effects implementation | 29 effects | ✅ Complete (Phase 1) |
| Medium priority | 5 | In progress |
| Testing & polish | 6 | Not started |

**Phase 1 Complete**: Core audio processing and effects chain fully functional.

**Next Steps (Phase 2)**:
- Pitch-based effects (requires FFT/autocorrelation)
- Production testing
- Platform-specific optimizations
