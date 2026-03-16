//! Adaptive Jitter Buffer
//!
//! Handles network jitter, packet reordering, and loss concealment.
//! Inspired by AOO but with adaptive sizing based on network conditions.

use parking_lot::Mutex;
use std::collections::BTreeMap;
use std::time::Instant;

/// Jitter buffer configuration
#[derive(Debug, Clone)]
pub struct JitterConfig {
    /// Minimum buffer size in samples
    pub min_size: usize,
    /// Maximum buffer size in samples
    pub max_size: usize,
    /// Target jitter in milliseconds
    pub target_jitter_ms: f32,
    /// Sample rate
    pub sample_rate: u32,
    /// Channels per frame
    pub channels: u8,
    /// Frame size in samples
    pub frame_size: usize,
}

impl Default for JitterConfig {
    fn default() -> Self {
        Self {
            min_size: 480,  // 10ms at 48kHz
            max_size: 4800, // 100ms at 48kHz
            target_jitter_ms: 5.0,
            sample_rate: 48000,
            channels: 2,
            frame_size: 480,
        }
    }
}

impl JitterConfig {
    /// Live jamming preset (minimal buffering)
    pub fn live_jamming() -> Self {
        Self {
            min_size: 240,  // 5ms
            max_size: 1920, // 40ms
            target_jitter_ms: 2.0,
            ..Default::default()
        }
    }

    /// Balanced preset
    pub fn balanced() -> Self {
        Self::default()
    }

    /// Stable preset (more buffering, less glitches)
    pub fn stable() -> Self {
        Self {
            min_size: 960,  // 20ms
            max_size: 9600, // 200ms
            target_jitter_ms: 10.0,
            ..Default::default()
        }
    }
}

/// Statistics for jitter buffer operation
#[derive(Debug, Clone, Default)]
pub struct JitterStats {
    /// Current buffer level in samples
    pub buffer_level: usize,
    /// Average jitter in ms
    pub avg_jitter_ms: f32,
    /// Maximum jitter observed in ms
    pub max_jitter_ms: f32,
    /// Packet loss percentage
    pub packet_loss_percent: f32,
    /// Number of underruns (buffer empty)
    pub underruns: u64,
    /// Number of overruns (buffer full, dropped packets)
    pub overruns: u64,
    /// Number of packets reordered
    pub reordered: u64,
    /// Number of PLC frames generated
    pub plc_frames: u64,
}

/// A single audio frame in the buffer
#[derive(Debug, Clone)]
#[allow(dead_code)]
struct BufferedFrame {
    /// Sequence number
    sequence: u16,
    /// Timestamp from sender
    timestamp: u16,
    /// Arrival time
    arrival: Instant,
    /// Audio samples (decoded PCM)
    samples: Vec<f32>,
    /// Whether this is a PLC frame
    is_plc: bool,
}

/// Adaptive jitter buffer for a single audio stream
pub struct JitterBuffer {
    config: JitterConfig,
    /// Frames ordered by sequence number
    frames: Mutex<BTreeMap<u16, BufferedFrame>>,
    /// Next expected sequence number for playback
    play_sequence: Mutex<u16>,
    /// Statistics
    stats: Mutex<JitterStats>,
    /// Arrival time tracking for jitter calculation
    arrival_times: Mutex<Vec<(u16, Instant)>>,
    /// Current adaptive buffer target
    adaptive_target: Mutex<usize>,
    /// Last received sequence
    last_recv_sequence: Mutex<Option<u16>>,
}

impl std::fmt::Debug for JitterBuffer {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("JitterBuffer")
            .field("config", &self.config)
            .field("stats", &*self.stats.lock())
            .finish_non_exhaustive()
    }
}

impl JitterBuffer {
    pub fn new(config: JitterConfig) -> Self {
        let initial_target = config.min_size;
        Self {
            config,
            frames: Mutex::new(BTreeMap::new()),
            play_sequence: Mutex::new(0),
            stats: Mutex::new(JitterStats::default()),
            arrival_times: Mutex::new(Vec::with_capacity(100)),
            adaptive_target: Mutex::new(initial_target),
            last_recv_sequence: Mutex::new(None),
        }
    }

    /// Push a new frame into the buffer
    pub fn push(&self, sequence: u16, timestamp: u16, samples: Vec<f32>) {
        let arrival = Instant::now();
        let mut frames = self.frames.lock();
        let mut stats = self.stats.lock();
        let mut arrival_times = self.arrival_times.lock();
        let mut last_recv = self.last_recv_sequence.lock();

        // Check for duplicate
        if frames.contains_key(&sequence) {
            return;
        }

        // Check for reordering
        if let Some(last) = *last_recv {
            let expected = last.wrapping_add(1);
            if sequence != expected {
                // Handle wraparound
                let diff = sequence.wrapping_sub(expected);
                if diff < 32768 {
                    // Packet is from the future - some were lost
                } else {
                    // Packet arrived out of order
                    stats.reordered += 1;
                }
            }
        }
        *last_recv = Some(sequence);

        // Track arrival time for jitter calculation
        arrival_times.push((sequence, arrival));
        if arrival_times.len() > 100 {
            arrival_times.remove(0);
        }

        // Check for overflow
        let buffer_samples: usize = frames.values().map(|f| f.samples.len()).sum();
        if buffer_samples + samples.len() > self.config.max_size * self.config.channels as usize {
            // Drop oldest frame
            if let Some((&oldest_seq, _)) = frames.first_key_value() {
                frames.remove(&oldest_seq);
                stats.overruns += 1;
            }
        }

        // Insert frame
        frames.insert(
            sequence,
            BufferedFrame {
                sequence,
                timestamp,
                arrival,
                samples,
                is_plc: false,
            },
        );

        // Update buffer level stat
        stats.buffer_level = frames.values().map(|f| f.samples.len()).sum();

        // Update jitter calculation
        self.update_jitter_stats(&arrival_times, &mut stats);
    }

    /// Pop the next frame for playback
    /// Returns None if buffer is building, Some(samples) if ready
    pub fn pop(&self) -> Option<Vec<f32>> {
        let mut frames = self.frames.lock();
        let mut play_seq = self.play_sequence.lock();
        let mut stats = self.stats.lock();
        let adaptive_target = *self.adaptive_target.lock();

        // Check if we have enough buffered
        let buffer_samples: usize = frames.values().map(|f| f.samples.len()).sum();
        if buffer_samples < adaptive_target * self.config.channels as usize {
            // Still building buffer
            return None;
        }

        // Get the next frame in sequence
        if let Some(frame) = frames.remove(&*play_seq) {
            *play_seq = play_seq.wrapping_add(1);
            stats.buffer_level = frames.values().map(|f| f.samples.len()).sum();
            if frame.is_plc {
                stats.plc_frames += 1;
            }
            Some(frame.samples)
        } else {
            // Frame missing - check if we should skip ahead
            if let Some((&next_seq, _)) = frames.first_key_value() {
                // Calculate gap
                let gap = next_seq.wrapping_sub(*play_seq);
                if gap < 32768 && gap > 0 {
                    // Skip to next available frame
                    let skipped = gap;
                    *play_seq = next_seq;
                    stats.packet_loss_percent =
                        (stats.packet_loss_percent * 0.99) + (skipped as f32 * 0.01);

                    if let Some(frame) = frames.remove(&*play_seq) {
                        *play_seq = play_seq.wrapping_add(1);
                        stats.buffer_level = frames.values().map(|f| f.samples.len()).sum();
                        return Some(frame.samples);
                    }
                }
            }

            // Underrun
            stats.underruns += 1;
            None
        }
    }

    /// Get current buffer level in samples
    pub fn buffer_level(&self) -> usize {
        self.stats.lock().buffer_level
    }

    /// Get buffer level in milliseconds
    pub fn buffer_level_ms(&self) -> f32 {
        let samples = self.buffer_level();
        (samples as f32 / self.config.channels as f32 / self.config.sample_rate as f32) * 1000.0
    }

    /// Get statistics
    pub fn stats(&self) -> JitterStats {
        self.stats.lock().clone()
    }

    /// Reset the buffer
    pub fn reset(&self) {
        let mut frames = self.frames.lock();
        let mut play_seq = self.play_sequence.lock();
        let mut stats = self.stats.lock();
        let mut arrival_times = self.arrival_times.lock();
        let mut last_recv = self.last_recv_sequence.lock();
        let mut adaptive_target = self.adaptive_target.lock();

        frames.clear();
        *play_seq = 0;
        *stats = JitterStats::default();
        arrival_times.clear();
        *last_recv = None;
        *adaptive_target = self.config.min_size;
    }

    /// Update jitter statistics and adaptive target
    fn update_jitter_stats(&self, arrival_times: &[(u16, Instant)], stats: &mut JitterStats) {
        if arrival_times.len() < 2 {
            return;
        }

        // Calculate inter-arrival jitter
        let mut jitters = Vec::new();
        for i in 1..arrival_times.len() {
            let (seq_a, time_a) = arrival_times[i - 1];
            let (seq_b, time_b) = arrival_times[i];

            // Expected interval based on sequence delta
            let seq_delta = seq_b.wrapping_sub(seq_a) as f32;
            let expected_ms = seq_delta
                * (self.config.frame_size as f32 / self.config.sample_rate as f32)
                * 1000.0;

            // Actual interval
            let actual_ms = time_b.duration_since(time_a).as_secs_f32() * 1000.0;

            // Jitter is the difference
            let jitter = (actual_ms - expected_ms).abs();
            jitters.push(jitter);
        }

        if !jitters.is_empty() {
            let avg_jitter: f32 = jitters.iter().sum::<f32>() / jitters.len() as f32;
            let max_jitter = jitters.iter().cloned().fold(0.0f32, f32::max);

            // Exponential moving average
            stats.avg_jitter_ms = stats.avg_jitter_ms * 0.9 + avg_jitter * 0.1;
            stats.max_jitter_ms = stats.max_jitter_ms.max(max_jitter);

            // Update adaptive target
            let mut adaptive_target = self.adaptive_target.lock();
            let target_samples =
                (stats.avg_jitter_ms * 2.0 * self.config.sample_rate as f32 / 1000.0) as usize;
            let new_target = target_samples.clamp(self.config.min_size, self.config.max_size);

            // Smooth adaptation
            *adaptive_target = (*adaptive_target * 7 + new_target) / 8;
        }
    }

    /// Generate PLC (Packet Loss Concealment) frame
    /// Returns the last known samples repeated with fade
    pub fn generate_plc(&self) -> Vec<f32> {
        let frames = self.frames.lock();

        // Find most recent frame
        if let Some((_, frame)) = frames.iter().next_back() {
            // Simple fade-out of last frame
            let mut plc = frame.samples.clone();
            let plc_len = plc.len() as f32;
            for (i, sample) in plc.iter_mut().enumerate() {
                let fade = 1.0 - (i as f32 / plc_len) * 0.3;
                *sample *= fade;
            }
            plc
        } else {
            // No data - return silence
            vec![0.0; self.config.frame_size * self.config.channels as usize]
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jitter_buffer_basic() {
        let config = JitterConfig::default();
        let buffer = JitterBuffer::new(config.clone());

        // Push some frames
        for i in 0..10 {
            let samples = vec![i as f32 * 0.1; config.frame_size * config.channels as usize];
            buffer.push(i, i * 10, samples);
        }

        assert!(buffer.buffer_level() > 0);
    }

    #[test]
    fn test_jitter_buffer_reordering() {
        let config = JitterConfig::default();
        let buffer = JitterBuffer::new(config.clone());

        // Push frames out of order
        let samples = || vec![0.5; config.frame_size * config.channels as usize];
        buffer.push(0, 0, samples());
        buffer.push(2, 20, samples());
        buffer.push(1, 10, samples()); // Late arrival

        let stats = buffer.stats();
        assert_eq!(stats.reordered, 1);
    }
}
