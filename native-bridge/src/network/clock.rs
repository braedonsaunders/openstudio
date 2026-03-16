//! Clock Synchronization
//!
//! NTP-style clock synchronization for sub-millisecond beat sync.
//! Essential for tight jam sessions where everyone plays to the same beat.

use parking_lot::RwLock;
use std::cmp::Ordering;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

/// Clock sync configuration
#[derive(Debug, Clone)]
pub struct ClockConfig {
    /// Sync interval in milliseconds
    pub sync_interval_ms: u64,
    /// Number of samples to average for offset calculation
    pub sample_count: usize,
    /// Maximum acceptable clock offset before forcing resync (ms)
    pub max_offset_ms: f64,
}

impl Default for ClockConfig {
    fn default() -> Self {
        Self {
            sync_interval_ms: 1000,
            sample_count: 8,
            max_offset_ms: 50.0,
        }
    }
}

/// A single clock sync sample
#[derive(Debug, Clone, Copy)]
pub struct ClockSample {
    /// Local time when request was sent
    pub t1: u64,
    /// Remote time when request was received
    pub t2: u64,
    /// Remote time when response was sent
    pub t3: u64,
    /// Local time when response was received
    pub t4: u64,
}

impl ClockSample {
    /// Calculate round-trip time
    pub fn rtt(&self) -> f64 {
        ((self.t4 - self.t1) - (self.t3 - self.t2)) as f64
    }

    /// Calculate clock offset (positive = remote is ahead)
    pub fn offset(&self) -> f64 {
        (((self.t2 as i128 - self.t1 as i128) + (self.t3 as i128 - self.t4 as i128)) / 2) as f64
    }
}

/// Clock synchronization state
#[derive(Debug, Clone)]
pub struct ClockState {
    /// Current clock offset in milliseconds (positive = remote is ahead)
    pub offset_ms: f64,
    /// Round-trip time in milliseconds
    pub rtt_ms: f64,
    /// Jitter (variance in RTT) in milliseconds
    pub jitter_ms: f64,
    /// Whether we're synchronized
    pub is_synced: bool,
    /// Number of sync samples collected
    pub sample_count: usize,
    /// Time of last sync
    pub last_sync: Option<Instant>,
}

impl Default for ClockState {
    fn default() -> Self {
        Self {
            offset_ms: 0.0,
            rtt_ms: 0.0,
            jitter_ms: 0.0,
            is_synced: false,
            sample_count: 0,
            last_sync: None,
        }
    }
}

/// Clock synchronization manager
pub struct ClockSync {
    config: ClockConfig,
    state: RwLock<ClockState>,
    samples: RwLock<Vec<ClockSample>>,
    /// Are we the master clock?
    is_master: RwLock<bool>,
    /// Master's beat position
    beat_position: RwLock<f64>,
    /// Master's BPM
    bpm: RwLock<f32>,
    /// Master's time signature
    time_signature: RwLock<(u8, u8)>,
    /// Last beat sync time
    last_beat_sync: RwLock<Option<(Instant, f64)>>,
}

impl ClockSync {
    pub fn new(config: ClockConfig) -> Self {
        Self {
            config,
            state: RwLock::new(ClockState::default()),
            samples: RwLock::new(Vec::new()),
            is_master: RwLock::new(false),
            beat_position: RwLock::new(0.0),
            bpm: RwLock::new(120.0),
            time_signature: RwLock::new((4, 4)),
            last_beat_sync: RwLock::new(None),
        }
    }

    /// Get current time in milliseconds since epoch
    pub fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    /// Get synchronized time (adjusted for offset)
    pub fn synced_time_ms(&self) -> u64 {
        let state = self.state.read();
        let local = Self::now_ms();
        (local as f64 + state.offset_ms) as u64
    }

    /// Process a clock sync response
    pub fn process_sync(&self, sample: ClockSample) {
        let mut samples = self.samples.write();
        samples.push(sample);

        // Keep only recent samples
        if samples.len() > self.config.sample_count {
            samples.remove(0);
        }

        // Calculate weighted average (recent samples weighted more)
        if samples.len() >= 3 {
            let mut state = self.state.write();

            // Sort by RTT and take best half (filter outliers)
            let mut sorted: Vec<_> = samples.iter().cloned().collect();
            sorted.sort_by(|a, b| a.rtt().partial_cmp(&b.rtt()).unwrap_or(Ordering::Equal));
            let best = &sorted[..sorted.len() / 2 + 1];

            // Weighted average offset
            let total_weight: f64 = best.iter().enumerate().map(|(i, _)| (i + 1) as f64).sum();
            let weighted_offset: f64 = best
                .iter()
                .enumerate()
                .map(|(i, s)| s.offset() * (i + 1) as f64)
                .sum::<f64>()
                / total_weight;

            // Average RTT
            let avg_rtt: f64 = best.iter().map(|s| s.rtt()).sum::<f64>() / best.len() as f64;

            // Jitter (variance in RTT)
            let jitter: f64 = best
                .iter()
                .map(|s| (s.rtt() - avg_rtt).powi(2))
                .sum::<f64>()
                .sqrt()
                / best.len() as f64;

            state.offset_ms = weighted_offset;
            state.rtt_ms = avg_rtt;
            state.jitter_ms = jitter;
            state.sample_count = samples.len();
            state.is_synced = true;
            state.last_sync = Some(Instant::now());
        }
    }

    /// Create a sync request timestamp
    pub fn create_sync_request(&self) -> u64 {
        Self::now_ms()
    }

    /// Process sync request and create response timestamps
    pub fn process_sync_request(&self, _t1: u64) -> (u64, u64) {
        let t2 = Self::now_ms();
        let t3 = Self::now_ms();
        (t2, t3)
    }

    /// Get current clock state
    pub fn state(&self) -> ClockState {
        self.state.read().clone()
    }

    /// Check if we're the master clock
    pub fn is_master(&self) -> bool {
        *self.is_master.read()
    }

    /// Set master status
    pub fn set_master(&self, is_master: bool) {
        *self.is_master.write() = is_master;
    }

    /// Update beat position from master
    pub fn update_beat_position(&self, beat: f64, bpm: f32, time_sig: (u8, u8)) {
        *self.beat_position.write() = beat;
        *self.bpm.write() = bpm;
        *self.time_signature.write() = time_sig;
        *self.last_beat_sync.write() = Some((Instant::now(), beat));
    }

    /// Get current beat position (interpolated from last sync)
    pub fn current_beat_position(&self) -> f64 {
        let last_sync = self.last_beat_sync.read();
        let bpm = *self.bpm.read();

        if let Some((sync_time, sync_beat)) = *last_sync {
            let elapsed = sync_time.elapsed().as_secs_f64();
            let beats_elapsed = (bpm as f64 / 60.0) * elapsed;
            sync_beat + beats_elapsed
        } else {
            0.0
        }
    }

    /// Get beat position within current bar
    pub fn beat_in_bar(&self) -> f64 {
        let beat = self.current_beat_position();
        let (num, _) = *self.time_signature.read();
        beat % num as f64
    }

    /// Get current bar number
    pub fn current_bar(&self) -> u64 {
        let beat = self.current_beat_position();
        let (num, _) = *self.time_signature.read();
        (beat / num as f64) as u64
    }

    /// Get current BPM
    pub fn bpm(&self) -> f32 {
        *self.bpm.read()
    }

    /// Get time signature
    pub fn time_signature(&self) -> (u8, u8) {
        *self.time_signature.read()
    }

    /// Calculate latency compensation delay for a peer
    /// Returns the delay in samples that should be applied
    pub fn calculate_compensation_delay(&self, peer_rtt_ms: f32, sample_rate: u32) -> usize {
        let _state = self.state.read();

        // Total round-trip budget for the group
        // We want everyone to be synchronized to the slowest peer
        let max_acceptable_rtt = 100.0f32; // 100ms max

        // Calculate how much we need to delay this peer
        let delay_ms = (max_acceptable_rtt - peer_rtt_ms).max(0.0);

        // Convert to samples
        ((delay_ms / 1000.0) * sample_rate as f32) as usize
    }

    /// Reset synchronization state
    pub fn reset(&self) {
        *self.state.write() = ClockState::default();
        self.samples.write().clear();
        *self.last_beat_sync.write() = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn test_clock_sample_offset() {
        // Simulate a scenario where remote is 10ms ahead
        let sample = ClockSample {
            t1: 1000,
            t2: 1015, // Remote received 15ms after we sent (including 5ms network delay)
            t3: 1016, // Remote sent 1ms later
            t4: 1011, // We received 5ms later on the local clock
        };

        // RTT should be ~10ms (5ms each way, minus 1ms processing)
        assert!((sample.rtt() - 10.0).abs() < 1.0);

        // Offset should be ~10ms (remote is ahead)
        assert!((sample.offset() - 10.0).abs() < 1.0);
    }

    #[test]
    fn test_beat_position() {
        let clock = ClockSync::new(ClockConfig::default());
        clock.update_beat_position(0.0, 120.0, (4, 4));

        // At 120 BPM, we should advance 2 beats per second
        std::thread::sleep(Duration::from_millis(500));

        let beat = clock.current_beat_position();
        assert!(beat > 0.9 && beat < 1.1, "Beat position: {}", beat);
    }
}
