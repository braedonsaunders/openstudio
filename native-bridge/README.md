# OpenStudio Native Audio Bridge

Ultra-low-latency audio I/O via ASIO (Windows) / CoreAudio (macOS) for OpenStudio.

## Why?

Web browsers use WASAPI (Windows) which adds 25-50ms latency. This native bridge bypasses that using ASIO drivers, achieving 5-10ms total latency - suitable for real-time jamming.

## Building

### Prerequisites

- [Rust](https://rustup.rs/) 1.70+
- Windows: ASIO SDK (optional, for ASIO support)
- macOS: Xcode Command Line Tools

### Build

```bash
# Development build
cargo build

# Release build (optimized, ~2MB)
cargo build --release

# Windows with ASIO support
cargo build --release --features asio
```

### ASIO Setup (Windows)

1. Download ASIO SDK from [Steinberg](https://www.steinberg.net/developers/)
2. Extract to `C:\ASIOSDK` or set `CPAL_ASIO_DIR` environment variable
3. Build with `--features asio`

## Running

```bash
# Direct run
./target/release/openstudio-bridge

# With room context (from protocol handler)
./openstudio-bridge "openstudio://join?room=abc123&user=bob&token=xyz"

# CLI args
./openstudio-bridge --room=abc123 --user=bob
```

## Protocol

The bridge runs a WebSocket server on `ws://localhost:9999`.

### Message Format

All messages are JSON with a `type` field. See `src/protocol/messages.rs` for full specification.

### Example: Get Devices

```json
// Request
{"type": "getDevices"}

// Response
{
  "type": "devices",
  "inputs": [
    {
      "id": "asio:focusrite_usb_asio",
      "name": "Focusrite USB ASIO",
      "isInput": true,
      "isOutput": true,
      "channels": [
        {"index": 0, "name": "Input 1"},
        {"index": 1, "name": "Input 2"}
      ],
      "sampleRates": [44100, 48000, 96000],
      "isDefault": false,
      "driverType": "Asio"
    }
  ],
  "outputs": [...]
}
```

### Example: Start Audio

```json
// Set device
{"type": "setInputDevice", "deviceId": "asio:focusrite_usb_asio"}
{"type": "setOutputDevice", "deviceId": "asio:focusrite_usb_asio"}

// Set channels (mono from input 1)
{"type": "setChannelConfig", "channelCount": 1, "leftChannel": 0}

// Start
{"type": "startAudio"}

// Response
{
  "type": "audioStatus",
  "isRunning": true,
  "inputLatencyMs": 2.67,
  "outputLatencyMs": 2.67,
  "totalLatencyMs": 5.33
}
```

## Custom Protocol Handler

The app registers `openstudio://` as a custom protocol:

```
openstudio://join?room=abc123&user=bob&token=xyz
```

On Windows, this is registered in the Registry. On macOS, it's in the app's Info.plist.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (OpenStudio)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ WebRTC      │  │ Web Audio   │  │ Native Bridge   │  │
│  │ (remote)    │  │ (fallback)  │  │ Client          │  │
│  └─────────────┘  └─────────────┘  └────────┬────────┘  │
└─────────────────────────────────────────────┼───────────┘
                                              │ WebSocket
                                              │ localhost:9999
┌─────────────────────────────────────────────┼───────────┐
│                 Native Bridge               │           │
│  ┌─────────────┐  ┌─────────────┐  ┌───────┴─────────┐ │
│  │ Audio I/O   │  │ Effects     │  │ WebSocket       │ │
│  │ CPAL/ASIO   │  │ Processing  │  │ Server          │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Effects Chain

Matches the browser implementation exactly:

1. Wah
2. Overdrive
3. Distortion
4. Amp Simulator
5. Cabinet Simulator
6. Noise Gate
7. EQ (5-band parametric)
8. Compressor
9. Chorus
10. Flanger
11. Phaser
12. Delay
13. Tremolo
14. Reverb
15. Limiter (always on)

## License

MIT
