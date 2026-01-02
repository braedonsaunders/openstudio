# Native Bridge Audio Protocol Fix Plan

## Executive Summary

After analyzing the codebase, I identified **5 core issues** (deduplicated from ~12 reported symptoms) affecting the native audio bridge. The primary symptom of "audio for ~0.5s then silence" is caused by a combination of ring buffer overflow and initialization race conditions.

---

## Issue 1: Remote Audio Not Routed (msg_type 0)

### Problem
- `server.rs:484-492` - msg_type 0 handler is stubbed out
- Remote user audio from browser is parsed but `push_remote_audio()` is never called
- Other room members hear silence

### Files
- `native-bridge/src/protocol/server.rs:474-498`
- `native-bridge/src/audio/engine.rs:412-422`

### Fix
```rust
// server.rs:474-498 - Implement the TODO
async fn handle_audio_data(&self, data: &[u8]) {
    if let Some(header) = AudioMessageHeader::from_bytes(data) {
        let samples_offset = AudioMessageHeader::SIZE;

        if header.msg_type == 0 {
            // Remote user audio - extract user_id from binary format
            // Format: [header][user_id_len: u8][user_id: utf8][samples: f32...]
            let user_id_len = data.get(samples_offset).copied().unwrap_or(0) as usize;
            if user_id_len > 0 && data.len() > samples_offset + 1 + user_id_len {
                let user_id_bytes = &data[samples_offset + 1..samples_offset + 1 + user_id_len];
                if let Ok(user_id) = std::str::from_utf8(user_id_bytes) {
                    let sample_start = samples_offset + 1 + user_id_len;
                    let samples: Vec<f32> = data[sample_start..]
                        .chunks_exact(4)
                        .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
                        .collect();

                    let app = self.state.lock().await;
                    app.audio_engine.push_remote_audio(&user_id, &samples);
                }
            }
        } else if header.msg_type == 1 {
            // Backing track audio - existing code works
            let samples: Vec<f32> = data[samples_offset..]
                .chunks_exact(4)
                .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
                .collect();
            let app = self.state.lock().await;
            app.audio_engine.push_backing_audio(&samples);
        }
    }
}
```

### Browser-side (native-bridge.ts)
Need to add method to send remote audio:
```typescript
sendRemoteAudio(userId: string, samples: Float32Array): void {
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

  const userIdBytes = new TextEncoder().encode(userId);
  const headerSize = 13; // msg_type(1) + sample_count(4) + timestamp(8)
  const buffer = new ArrayBuffer(headerSize + 1 + userIdBytes.length + samples.length * 4);
  const view = new DataView(buffer);

  // Header
  view.setUint8(0, 0); // msg_type 0 = remote audio
  view.setUint32(1, samples.length, true);
  view.setBigUint64(5, BigInt(Date.now()), true);

  // User ID
  view.setUint8(headerSize, userIdBytes.length);
  new Uint8Array(buffer, headerSize + 1, userIdBytes.length).set(userIdBytes);

  // Samples
  new Float32Array(buffer, headerSize + 1 + userIdBytes.length).set(samples);

  this.ws.send(buffer);
}
```

---

## Issue 2: Ring Buffer Overflow (Silent Discard)

### Problem
- `engine.rs:873` - `push_slice()` return value ignored
- `engine.rs:900` - `let _ = prod.try_push(sample)` silently discards
- Browser stream buffer (131072 samples) fills in ~1.5s if WebSocket stalls
- No warning, no backpressure, no recovery

### Files
- `native-bridge/src/audio/engine.rs:870-875, 897-902`
- `native-bridge/src/protocol/server.rs:92-108`

### Fix

#### A. Add overflow detection and warning
```rust
// engine.rs - Add atomic counter for overflow tracking
overflow_count: Arc<AtomicU64>,

// In process_input, line 873:
if let Some(browser_prod) = browser_stream_producer {
    if let Ok(mut prod) = browser_prod.try_lock() {
        let pushed = prod.push_slice(stereo_buffer);
        if pushed < stereo_buffer.len() {
            // Overflow detected - increment counter (no allocation)
            overflow_count.fetch_add(1, Ordering::Relaxed);
        }
    }
}
```

#### B. Add diagnostic to server loop
```rust
// server.rs - In diagnostic logging (line 116):
let overflow = app.audio_engine.get_overflow_count();
if overflow > 0 {
    warn!("[Server] Browser stream overflow: {} batches dropped", overflow);
}
```

#### C. Consider backpressure mechanism
Option 1: Increase buffer size (simple but uses more memory)
Option 2: Add flow control messages (complex but robust)
Option 3: Drop oldest samples instead of newest (maintains continuity)

Recommended: Start with Option 1 + overflow warning, then implement Option 3 if needed.

---

## Issue 3: Single Track Architecture

### Problem
- `engine.rs:122` - Only one `TrackState` in `AudioProcessingState`
- `process_input` extracts ONE stereo pair from selected channels
- Multi-track is handled in browser, but native side has no per-track awareness
- All tracks share same gain/monitoring settings in native engine

### Files
- `native-bridge/src/audio/engine.rs:117-133`
- `native-bridge/src/mixing/track.rs`

### Current Behavior (Acceptable for Now)
The architecture intentionally handles multi-track in the browser:
- Native bridge captures single stereo stream
- Browser receives raw audio via WebSocket
- Browser's AudioEngine routes to per-track processors
- Per-track effects/mixing done in Web Audio

### Recommendation
For initial fix, **accept single-track native architecture**. The design comment at `native-bridge.ts:503-505` explicitly states:
> "Multi-track channel config is handled in the browser, not the native bridge."

Future enhancement: If per-track latency or channel isolation becomes critical, implement track multiplexing in native side.

---

## Issue 4: Mixer Disconnected from Audio Path

### Problem
- `server.rs:449` - `app.mixer.set_stem_state()` called
- `server.rs:456` - `app.mixer.set_master_effects_enabled()` called
- But `process_output` in `engine.rs` never reads from Mixer
- Stem/master effects settings have no effect

### Files
- `native-bridge/src/protocol/server.rs:446-458`
- `native-bridge/src/audio/engine.rs:906-977`
- `native-bridge/src/mixing/mixer.rs`

### Fix Options

#### Option A: Wire Mixer into process_output (Complex)
Would require:
- Passing Mixer state to audio callbacks
- Reading stem volumes in process_output
- Applying master effects chain

#### Option B: Route stem/master commands to AudioEngine (Simple)
```rust
// server.rs:446-458
BrowserMessage::SetStemState { stem, enabled, volume } => {
    let app = self.state.lock().await;
    // Route to audio engine instead of mixer
    app.audio_engine.set_stem_state(&stem, enabled, volume);
    None
}
```

### Recommendation
For initial fix, use **Option B** (route to AudioEngine). The Mixer was likely intended for future multi-track mixing that isn't fully implemented.

---

## Issue 5: Initialization Race Condition

### Problem
- `useNativeBridge.ts:370` - `nativeBridge.startAudio()` called
- Line 379 - `setRunning(true)` set immediately
- Lines 400-435 - Track processors set up AFTER audio starts
- Early audio packets (first ~50ms) may be dropped

### Files
- `src/hooks/useNativeBridge.ts:287-477`

### Current Mitigations
- Line 373: 50ms delay after startAudio
- Line 296-322: Audio engine initialization before startAudio
- Line 437-476: Final state resync after setup

### Additional Fix
Ensure track processors exist BEFORE startAudio:
```typescript
// In startAudio(), BEFORE nativeBridge.startAudio():
for (const track of userTracks) {
  const engine = (window as any).__openStudioAudioEngine;
  if (engine) {
    // Create track processor FIRST
    engine.getOrCreateTrackProcessor(track.id, track.audioSettings);

    // Set up bridge input with buffering
    const channelConfig = track.audioSettings.channelConfig || state.inputChannelConfig;
    await engine.setTrackBridgeInput(track.id, {
      channelConfig,
      asioBufferSize: state.bufferSize,
    });
  }
}

// THEN start native audio
nativeBridge.startAudio();
```

---

## Implementation Priority

1. **Issue 2: Ring Buffer Overflow** - HIGH (causes immediate audio death)
   - Add overflow detection/warning
   - Consider increasing buffer size temporarily

2. **Issue 5: Initialization Race** - HIGH (causes early audio drops)
   - Reorder track setup to before startAudio

3. **Issue 1: Remote Audio** - MEDIUM (affects multi-user rooms)
   - Implement msg_type 0 handler

4. **Issue 4: Mixer Disconnected** - LOW (stems/master effects not working)
   - Route commands to AudioEngine

5. **Issue 3: Single Track** - LOW (by design for now)
   - Document limitation, defer to future enhancement

---

## Testing Plan

1. **Ring Buffer Test**
   - Start audio, stall WebSocket read for 2s
   - Verify overflow warning appears
   - Verify audio resumes after stall clears

2. **Initialization Test**
   - Start audio with track armed
   - Verify audio flows within first 100ms
   - No "audio for 0.5s then silence"

3. **Remote Audio Test**
   - Two users in room
   - Verify User B hears User A via native bridge

4. **Stem/Master Test**
   - Load backing track with stems
   - Toggle stem enable/volume
   - Verify changes affect output
