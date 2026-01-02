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
| Audio Engine Core | Done | ASIO/CoreAudio device access, ringbuffers |
| AudioBridgeHandle | Done | Thread-safe handle for network ops |
| Opus Codec | Done | Full encode/decode with FEC |
| Jitter Buffer | Done | Adaptive for live jamming |
| Clock Sync | Done | NTP-style sub-ms sync |
| QUIC/MoQ Relay Client | Done | Connects to relay servers |
| P2P Network | Partial | Socket binding works, loops not spawned |
| Effects Chain | Stub | All 15 effects are empty stubs |
| Audio-Network Bridge | Partial | Exists but not started from server |

---

## Task List

### CRITICAL - Blocking Production

These must be completed before any real-world testing.

#### 1. Fix `unimplemented!()` Panic
- **File**: `src/network/manager.rs:709-714`
- **Issue**: `clone_for_async` calls `unimplemented!()` which panics at runtime
- **Fix**: Wrap `NetworkManager` in `Arc` and implement proper cloning

#### 2. Spawn P2P Receive/Send Loops
- **File**: `src/network/p2p.rs:156`
- **Issue**: Comment says "In real implementation, spawn receive/send loops here" but nothing is spawned
- **Fix**: Implement UDP receive loop that decodes OSP packets and emits events

#### 3. Start AudioNetworkBridge from Protocol Server
- **File**: `src/protocol/server.rs:587`
- **Issue**: TODO comment, bridge is never instantiated when room is joined
- **Fix**: Call `create_and_start_bridge()` when user joins a room with native bridge enabled

#### 4. Wire Up Transport/Metronome Forwarding
- **Files**: `src/network/bridge.rs:195,245,250`
- **Issue**: Clock sync, transport, and tempo events are received but only logged
- **Fix**: Forward to a transport system that the UI can subscribe to

#### 5. Expose `send_packet` for P2P Control Broadcast
- **File**: `src/network/manager.rs:567-570`
- **Issue**: Cannot send control messages in P2P mode because `send_packet` is private
- **Fix**: Add public `broadcast_control` method to P2P network

---

### HIGH PRIORITY - Required for Real-World Use

#### 6. Implement Audio Effects
- **Files**: `src/effects/*.rs` (15 files)
- **Issue**: All effects are stubs that don't process audio
- **Effects to implement**:
  - Wah
  - Overdrive
  - Distortion
  - Amp simulation
  - Cabinet impulse response
  - Noise gate
  - EQ (parametric)
  - Compressor
  - Chorus
  - Flanger
  - Phaser
  - Delay
  - Tremolo
  - Reverb
  - Limiter

#### 7. Hook Mixer to Effects Chain
- **File**: `src/mixing/mixer.rs:188`
- **Issue**: TODO says "Use per-track effects chain" but it's not implemented
- **Fix**: Route audio through EffectsChain before mixing

#### 8. Implement Audio Fetching in Protocol Server
- **File**: `src/protocol/server.rs:490`
- **Issue**: Comment says "Actual audio fetching would be done here"
- **Fix**: Connect to AudioEngine's output buffer and stream to WebSocket

#### 9. Add Reconnection Logic for Relay
- **File**: `src/network/relay.rs`
- **Issue**: If relay connection drops, no automatic reconnection
- **Fix**: Implement exponential backoff reconnection with state preservation

#### 10. Implement Error Recovery for Network Failures
- **Files**: `src/network/manager.rs`, `src/network/p2p.rs`
- **Issue**: Network errors are logged but not recovered from
- **Fix**: Add retry logic, graceful degradation, user notifications

---

### MEDIUM PRIORITY - Production Quality

#### 11. Graceful Degradation When Relay Unreachable
- Fallback to P2P-only mode
- Notify users of degraded connectivity

#### 12. Adaptive Bitrate Based on Network Conditions
- Monitor packet loss and RTT
- Adjust Opus bitrate dynamically

#### 13. Packet Loss Concealment (PLC)
- Use Opus FEC for packet loss recovery
- Implement interpolation for missing frames

#### 14. Master Election for Clock Sync
- Implement `MasterElection` message type (OSP 0x0303)
- Elect lowest-latency peer as clock master

#### 15. WebSocket Heartbeat/Keepalive
- Detect stale connections
- Clean up resources for disconnected clients

#### 16. Extract `time_sig` from P2PEvent
- **File**: `src/network/manager.rs:504`
- Currently hardcoded to (4, 4)

#### 17. Metrics/Telemetry for Latency Monitoring
- Track RTT, jitter, packet loss per peer
- Expose via API for UI display

---

### LOW PRIORITY - Polish & Features

#### 18. Effect Parameter Sync to Remote Users
- **File**: `src/network/bridge.rs:240`
- When local user changes effect, broadcast to room

#### 19. Chat Message Handling
- Implement OSP message type 0x0207

#### 20. Permission System for Track Control
- Implement OSP message type 0x0206
- Allow/deny remote control of tracks

#### 21. Lyria AI State Sync
- Implement OSP message type 0x020B
- Sync AI-generated content state

#### 22. Loop State Synchronization
- Implement OSP message type 0x020A
- Sync loop start/end/enabled state

#### 23. Platform-Specific Audio Optimizations
- Windows: ASIO exclusive mode
- macOS: CoreAudio low-latency settings
- Linux: JACK integration

---

### TESTING - Required Before Ship

#### 24. Integration Tests: P2P Audio Path
- Two clients on same machine
- Verify audio round-trip

#### 25. Integration Tests: Relay Audio Path
- Connect through actual MoQ relay
- Verify audio quality

#### 26. Stress Test: 8 Simultaneous Users
- Maximum performer count
- Monitor CPU, memory, latency

#### 27. Latency Benchmarks
- Target: <15ms RTT on LAN
- Measure encode + network + decode + buffer

#### 28. Network Failure Simulation
- Packet loss, high latency, disconnects
- Verify graceful handling

#### 29. Cross-Platform Tests
- Windows with ASIO
- macOS with CoreAudio
- Linux with ALSA/JACK

---

## Effort Estimates

| Category | Tasks | Estimate |
|----------|-------|----------|
| Critical blockers | 5 | 1-2 weeks |
| High priority | 5 | 2-3 weeks |
| Effects implementation | 15 effects | 4-6 weeks |
| Testing & polish | 10+ | 2-3 weeks |

**Total: ~10-14 weeks** for full production readiness.

**MVP Shortcut**: Skip effects (pass-through audio) = **2-3 weeks** for working jam sessions.
