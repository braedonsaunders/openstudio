# Native Bridge Audio Validation

This document describes the production test path for verifying native bridge audio transport between two performer endpoints.

## Automated validation

Run these from `/Users/braedonsaunders/Documents/Code/openstudio/native-bridge`:

```bash
source "$HOME/.cargo/env"
cargo test test_audio_transmission_end_to_end_between_two_peers -- --nocapture
cargo test test_audio_transmission_with_simulated_network_delay -- --nocapture
```

What they verify:

- `test_audio_transmission_end_to_end_between_two_peers`
  - Starts two real `P2PNetwork` instances on separate UDP sockets
  - Joins both peers to the same room
  - Establishes a real handshake between them
  - Sends multi-frame Opus audio from peer A to peer B
  - Fails unless peer B receives the expected PCM and the decoded waveform still correlates with the source signal
  - Prints measured first-frame latency and peer RTT

- `test_audio_transmission_with_simulated_network_delay`
  - Runs the same two-peer flow through a bidirectional UDP proxy
  - Injects deterministic one-way delay before forwarding packets
  - Fails unless audio still arrives intact and the measured latency reflects the added network delay
  - Prints measured first-frame latency and peer RTT through the simulated network

The proxy helper is implemented in the test module and can be extended to inject jitter or packet loss when a less deterministic soak test is needed.

## Full bridge regression

Before shipping native transport changes, run:

```bash
source "$HOME/.cargo/env"
cargo test
cargo clippy --all-targets -- -D warnings
```

## Real cross-machine smoke test

For a higher-confidence WAN test, use two physical machines.

1. Install the bridge binary on both machines.
2. Connect both machines over the same Tailscale or WireGuard network.
3. Launch one bridge per machine and join the same room and secret.
4. Generate a known source signal on machine A.
5. Confirm machine B receives audio and capture timestamps from the bridge logs or app telemetry.
6. Compare first-frame arrival time and RTT against the local simulated-network baseline.

Expected outcome:

- LAN or VPN peers complete handshake successfully
- Audio frames are received continuously without transport errors
- Measured latency increases relative to loopback and remains within the expected network budget
