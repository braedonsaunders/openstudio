//! Audio engine - production-ready multi-source mixing with full effects processing
//!
//! Supports:
//! - Local input capture with channel selection
//! - Multiple remote user audio streams (WebRTC)
//! - Backing track playback with stems
//! - Full effects chain processing
//! - Real-time level metering
//! - Ultra-low-latency ASIO support

use super::{AudioDevice, BufferSize, ChannelConfig, DeviceInfo, SampleRate};
use crate::effects::EffectsChain;
use crate::mixing::{PartialTrackState, TrackState};
use anyhow::Result;
use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::SampleFormat;
use ringbuf::{
    traits::{Consumer, Observer, Producer, Split},
    HeapCons, HeapProd, HeapRb,
};
use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::sync::RwLock;
use tracing::info;

// NOTE: Thread-locals were REMOVED because they allocate on first access,
// which happens INSIDE audio callbacks. This kills ASIO.
// Instead, we now pre-allocate buffers in RefCells BEFORE building streams,
// and capture them in closures. See build_input_stream, build_output_stream,
// and start_asio for the pre-allocation pattern.

/// Ring buffer size for local audio (samples, stereo)
const LOCAL_RING_BUFFER_SIZE: usize = 8192;

/// Ring buffer size for remote user audio
const REMOTE_RING_BUFFER_SIZE: usize = 16384;

/// Ring buffer size for per-track local audio sent to the network.
const LOCAL_TRACK_NETWORK_RING_BUFFER_SIZE: usize = 16384;

/// Ring buffer size for per-track local audio streamed to the browser.
const LOCAL_TRACK_BROWSER_RING_BUFFER_SIZE: usize = 16384;

/// Ring buffer size for backing track
const BACKING_RING_BUFFER_SIZE: usize = 32768;

/// Ring buffer size for streaming to browser (power-of-two for efficiency)
/// 262144 samples = ~3 seconds at 44100Hz stereo - handles WebSocket jitter
/// Increased from 131072 to provide more headroom for browser stalls
const BROWSER_STREAM_BUFFER_SIZE: usize = 262144;

/// Audio engine configuration
#[derive(Debug, Clone)]
pub struct EngineConfig {
    pub sample_rate: SampleRate,
    pub buffer_size: BufferSize,
    pub input_device_id: Option<String>,
    pub output_device_id: Option<String>,
    pub channel_config: ChannelConfig,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            sample_rate: SampleRate::Hz48000,
            buffer_size: BufferSize::Samples256,
            input_device_id: None,
            output_device_id: None,
            channel_config: ChannelConfig::default(),
        }
    }
}

/// Real-time audio levels (stereo)
#[derive(Debug, Clone, Default)]
pub struct AudioLevels {
    pub input_level_l: f32,
    pub input_level_r: f32,
    pub output_level_l: f32,
    pub output_level_r: f32,
    pub input_peak_l: f32,
    pub input_peak_r: f32,
    pub output_peak_l: f32,
    pub output_peak_r: f32,
    pub remote_levels: Vec<(String, f32)>,
    pub backing_level: f32,
}

/// Latency information
#[derive(Debug, Clone, Default)]
pub struct LatencyInfo {
    pub input_latency_ms: f32,
    pub output_latency_ms: f32,
    pub total_latency_ms: f32,
    pub buffer_size_samples: u32,
}

/// Device info for TUI display
#[derive(Debug, Clone)]
pub struct TuiDeviceInfo {
    pub input_device: String,
    pub output_device: String,
    pub sample_rate: u32,
    pub buffer_size: u32,
}

/// Effects metering data
#[derive(Debug, Clone, Default)]
pub struct EffectsMetering {
    pub track_id: String,
    pub noise_gate_open: bool,
    pub compressor_reduction: f32,
    pub de_esser_reduction: f32,
    pub limiter_reduction: f32,
}

/// Backing track state
#[derive(Debug, Clone)]
pub struct BackingTrackState {
    pub is_loaded: bool,
    pub is_playing: bool,
    pub current_time: f32,
    pub duration: f32,
    pub volume: f32,
}

impl Default for BackingTrackState {
    fn default() -> Self {
        Self {
            is_loaded: false,
            is_playing: false,
            current_time: 0.0,
            duration: 0.0,
            volume: 1.0,
        }
    }
}

/// Remote user audio buffer
struct RemoteUserBuffer {
    consumer: Arc<std::sync::Mutex<HeapCons<f32>>>,
    producer: Arc<std::sync::Mutex<HeapProd<f32>>>,
    volume: f32,
    pan: f32, // -1.0 = left, 0.0 = center, 1.0 = right
    is_muted: bool,
    compensation_delay_samples: usize,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
struct RemoteTrackKey {
    user_id: String,
    bridge_track_id: u8,
}

struct RemoteTrackBuffer {
    consumer: Arc<std::sync::Mutex<HeapCons<f32>>>,
    producer: Arc<std::sync::Mutex<HeapProd<f32>>>,
    volume: f32,
    pan: f32,
    is_muted: bool,
    is_solo: bool,
    compensation_delay_samples: usize,
    track_name: String,
    browser_track_id: String,
}

struct LocalTrackIo {
    network_producer: Arc<std::sync::Mutex<HeapProd<f32>>>,
    network_consumer: Arc<std::sync::Mutex<HeapCons<f32>>>,
    browser_producer: Arc<std::sync::Mutex<HeapProd<f32>>>,
    browser_consumer: Arc<std::sync::Mutex<HeapCons<f32>>>,
}

struct LocalTrackState {
    bridge_track_id: u8,
    track_name: String,
    channel_config: ChannelConfig,
    track_state: TrackState,
    effects_chain: EffectsChain,
    scratch_buffer: Vec<f32>,
}

#[derive(Debug, Clone)]
pub struct LocalTrackDescriptor {
    pub browser_track_id: String,
    pub bridge_track_id: u8,
    pub track_name: String,
}

/// Shared state for audio processing
struct AudioProcessingState {
    /// Effects chain for the master bus
    master_effects_chain: EffectsChain,
    /// Whether master effects are currently enabled
    master_effects_enabled: bool,
    /// Local native tracks keyed by browser track ID
    local_tracks: HashMap<String, LocalTrackState>,
    /// Sample rate
    sample_rate: u32,
    /// Master volume
    master_volume: f32,
    /// Remote users (user_id -> settings)
    remote_users: HashMap<String, RemoteUserSettings>,
    /// Backing track state
    backing_track: BackingTrackState,
}

#[derive(Debug, Clone)]
struct RemoteUserSettings {
    volume: f32,
    pan: f32,
    is_muted: bool,
    compensation_delay_ms: f32,
}

/// The main audio engine
pub struct AudioEngine {
    config: EngineConfig,

    // Devices
    input_device: Option<AudioDevice>,
    output_device: Option<AudioDevice>,

    // Streams
    input_stream: Option<cpal::Stream>,
    output_stream: Option<cpal::Stream>,

    // Local audio ring buffer
    local_producer: Option<Arc<std::sync::Mutex<HeapProd<f32>>>>,
    local_consumer: Option<Arc<std::sync::Mutex<HeapCons<f32>>>>,

    // Remote user audio buffers
    remote_buffers: Arc<RwLock<HashMap<String, RemoteUserBuffer>>>,

    // Remote native track audio buffers
    remote_track_buffers: Arc<RwLock<HashMap<RemoteTrackKey, RemoteTrackBuffer>>>,

    // Per-track local browser/network buffers
    local_track_io: Arc<RwLock<HashMap<String, LocalTrackIo>>>,

    // Backing track ring buffer
    backing_producer: Option<Arc<std::sync::Mutex<HeapProd<f32>>>>,
    backing_consumer: Option<Arc<std::sync::Mutex<HeapCons<f32>>>>,

    // Browser streaming ring buffer (for sending raw audio to browser for WebRTC)
    browser_stream_producer: Option<Arc<std::sync::Mutex<HeapProd<f32>>>>,
    browser_stream_consumer: Option<Arc<std::sync::Mutex<HeapCons<f32>>>>,

    // Shared processing state
    processing_state: Arc<RwLock<AudioProcessingState>>,

    // Monitoring controls
    is_monitoring: Arc<AtomicBool>,
    monitoring_volume: Arc<AtomicU32>,

    // Levels
    levels: Arc<RwLock<AudioLevels>>,

    // Effects metering
    effects_metering: Arc<RwLock<EffectsMetering>>,

    // Running state
    is_running: Arc<AtomicBool>,

    // Callback counters for diagnostics (no allocation to increment)
    input_callback_count: Arc<AtomicU64>,
    output_callback_count: Arc<AtomicU64>,

    // Overflow tracking for browser stream (no allocation to increment)
    browser_stream_overflow_count: Arc<AtomicU64>,
    browser_stream_overflow_samples: Arc<AtomicU64>,

    // Connection health tracking
    last_browser_read_time: Arc<AtomicU64>,
}

impl AudioEngine {
    pub fn new() -> Result<Self> {
        let config = EngineConfig::default();

        let processing_state = AudioProcessingState {
            master_effects_chain: EffectsChain::new(),
            master_effects_enabled: true,
            local_tracks: HashMap::new(),
            sample_rate: 48000,
            master_volume: 1.0,
            remote_users: HashMap::new(),
            backing_track: BackingTrackState::default(),
        };

        Ok(Self {
            config,
            input_device: None,
            output_device: None,
            input_stream: None,
            output_stream: None,
            local_producer: None,
            local_consumer: None,
            remote_buffers: Arc::new(RwLock::new(HashMap::new())),
            remote_track_buffers: Arc::new(RwLock::new(HashMap::new())),
            local_track_io: Arc::new(RwLock::new(HashMap::new())),
            backing_producer: None,
            backing_consumer: None,
            browser_stream_producer: None,
            browser_stream_consumer: None,
            processing_state: Arc::new(RwLock::new(processing_state)),
            is_monitoring: Arc::new(AtomicBool::new(true)),
            monitoring_volume: Arc::new(AtomicU32::new(1.0_f32.to_bits())),
            levels: Arc::new(RwLock::new(AudioLevels::default())),
            effects_metering: Arc::new(RwLock::new(EffectsMetering::default())),
            is_running: Arc::new(AtomicBool::new(false)),
            input_callback_count: Arc::new(AtomicU64::new(0)),
            output_callback_count: Arc::new(AtomicU64::new(0)),
            browser_stream_overflow_count: Arc::new(AtomicU64::new(0)),
            browser_stream_overflow_samples: Arc::new(AtomicU64::new(0)),
            last_browser_read_time: Arc::new(AtomicU64::new(0)),
        })
    }

    // === Device Management ===

    pub fn get_input_devices(&self) -> Result<Vec<DeviceInfo>> {
        Ok(AudioDevice::enumerate_inputs()?)
    }

    pub fn get_output_devices(&self) -> Result<Vec<DeviceInfo>> {
        Ok(AudioDevice::enumerate_outputs()?)
    }

    pub fn set_input_device(&mut self, device_id: &str) -> Result<()> {
        let was_running = self.is_running.load(Ordering::SeqCst);
        if was_running {
            self.stop()?;
        }

        self.input_device = Some(AudioDevice::get_by_id(device_id)?);
        self.config.input_device_id = Some(device_id.to_string());
        if let Some(device) = self.input_device.as_ref() {
            info!("Input device set: {}", device.info.name);
        }

        if was_running {
            self.start()?;
        }
        Ok(())
    }

    pub fn set_output_device(&mut self, device_id: &str) -> Result<()> {
        let was_running = self.is_running.load(Ordering::SeqCst);
        if was_running {
            self.stop()?;
        }

        self.output_device = Some(AudioDevice::get_by_id(device_id)?);
        self.config.output_device_id = Some(device_id.to_string());
        if let Some(device) = self.output_device.as_ref() {
            info!("Output device set: {}", device.info.name);
        }

        if was_running {
            self.start()?;
        }
        Ok(())
    }

    pub fn set_channel_config(&mut self, config: ChannelConfig) -> Result<()> {
        // Avoid unnecessary restarts when config is unchanged
        if self.config.channel_config == config {
            info!("Channel config unchanged, skipping restart");
            return Ok(());
        }

        info!("Setting channel config: {:?}", config);
        self.config.channel_config = config.clone();

        // CRITICAL: Must update processing_state - this is what the audio callback reads
        // Use blocking write to ensure the config is applied
        match self.processing_state.write() {
            Ok(mut state) => {
                if let Some((_track_id, track)) = state.local_tracks.iter_mut().next() {
                    track.channel_config = config;
                    info!("Channel config updated on primary local track");
                }
            }
            Err(e) => {
                // This should never happen in practice, but log if it does
                tracing::error!("Failed to acquire write lock for channel config: {:?}", e);
            }
        }

        if self.is_running.load(Ordering::SeqCst) {
            self.stop()?;
            self.start()?;
        }
        Ok(())
    }

    pub fn set_buffer_size(&mut self, size: BufferSize) -> Result<()> {
        self.config.buffer_size = size;
        if self.is_running.load(Ordering::SeqCst) {
            self.stop()?;
            self.start()?;
        }
        Ok(())
    }

    pub fn set_sample_rate(&mut self, rate: SampleRate) -> Result<()> {
        self.config.sample_rate = rate;
        if let Ok(mut state) = self.processing_state.write() {
            state.sample_rate = rate as u32;
            for track in state.local_tracks.values_mut() {
                track.effects_chain.set_sample_rate(rate as u32);
            }
            state.master_effects_chain.set_sample_rate(rate as u32);
        }
        if self.is_running.load(Ordering::SeqCst) {
            self.stop()?;
            self.start()?;
        }
        Ok(())
    }

    // === Monitoring ===

    pub fn set_monitoring(&self, enabled: bool) {
        self.is_monitoring.store(enabled, Ordering::SeqCst);
    }

    pub fn set_monitoring_volume(&self, volume: f32) {
        self.monitoring_volume
            .store(volume.to_bits(), Ordering::SeqCst);
    }

    pub fn is_monitoring(&self) -> bool {
        self.is_monitoring.load(Ordering::Relaxed)
    }

    // === Track State ===

    /// Register or update a local track used by the native bridge.
    pub fn sync_local_track(
        &self,
        track_id: &str,
        bridge_track_id: u8,
        track_name: &str,
        channel_config: ChannelConfig,
    ) {
        if let Ok(mut state) = self.processing_state.write() {
            let sample_rate = state.sample_rate;
            let local_track = state
                .local_tracks
                .entry(track_id.to_string())
                .or_insert_with(|| {
                    let mut effects_chain = EffectsChain::new();
                    effects_chain.set_sample_rate(sample_rate);
                    LocalTrackState {
                        bridge_track_id,
                        track_name: track_name.to_string(),
                        channel_config: channel_config.clone(),
                        track_state: TrackState::new(),
                        effects_chain,
                        scratch_buffer: Vec::with_capacity(65536),
                    }
                });
            local_track.bridge_track_id = bridge_track_id;
            local_track.track_name = track_name.to_string();
            local_track.channel_config = channel_config;
        }

        if let Ok(mut local_track_io) = self.local_track_io.write() {
            local_track_io
                .entry(track_id.to_string())
                .or_insert_with(|| {
                    let network_ring = HeapRb::<f32>::new(LOCAL_TRACK_NETWORK_RING_BUFFER_SIZE);
                    let (network_producer, network_consumer) = network_ring.split();
                    let browser_ring = HeapRb::<f32>::new(LOCAL_TRACK_BROWSER_RING_BUFFER_SIZE);
                    let (browser_producer, browser_consumer) = browser_ring.split();

                    LocalTrackIo {
                        network_producer: Arc::new(std::sync::Mutex::new(network_producer)),
                        network_consumer: Arc::new(std::sync::Mutex::new(network_consumer)),
                        browser_producer: Arc::new(std::sync::Mutex::new(browser_producer)),
                        browser_consumer: Arc::new(std::sync::Mutex::new(browser_consumer)),
                    }
                });
        }
    }

    pub fn remove_local_track(&self, track_id: &str) {
        if let Ok(mut state) = self.processing_state.write() {
            state.local_tracks.remove(track_id);
        }
        if let Ok(mut local_track_io) = self.local_track_io.write() {
            local_track_io.remove(track_id);
        }
    }

    /// Update track state with partial update - only fields that are Some will be changed
    pub fn update_track_state(&self, track_id: &str, partial: PartialTrackState) {
        // CRITICAL: Sync atomic is_monitoring FIRST - this is read in audio callback
        // The atomic never fails, ensuring monitoring state is always current
        if let Some(monitoring) = partial.monitoring_enabled {
            self.is_monitoring.store(monitoring, Ordering::SeqCst);
        }
        // Then update the full state in RwLock (for state queries)
        if let Ok(mut proc_state) = self.processing_state.write() {
            let sample_rate = proc_state.sample_rate;
            let default_channel = self.config.channel_config.clone();
            let track = proc_state
                .local_tracks
                .entry(track_id.to_string())
                .or_insert_with(|| {
                    let mut effects_chain = EffectsChain::new();
                    effects_chain.set_sample_rate(sample_rate);
                    LocalTrackState {
                        bridge_track_id: 0,
                        track_name: track_id.to_string(),
                        channel_config: default_channel,
                        track_state: TrackState::new(),
                        effects_chain,
                        scratch_buffer: Vec::with_capacity(65536),
                    }
                });
            track.track_state.merge(&partial);
        }
    }

    pub fn update_effects(&self, track_id: &str, effects: crate::effects::EffectsSettings) {
        // Log which effects are enabled for debugging
        let enabled_effects: Vec<&str> = [
            ("wah", effects.wah.enabled),
            ("overdrive", effects.overdrive.enabled),
            ("distortion", effects.distortion.enabled),
            ("amp", effects.amp.enabled),
            ("reverb", effects.reverb.enabled),
            ("delay", effects.delay.enabled),
            ("chorus", effects.chorus.enabled),
            ("compressor", effects.compressor.enabled),
            ("eq", effects.eq.enabled),
        ]
        .iter()
        .filter(|(_, enabled)| *enabled)
        .map(|(name, _)| *name)
        .collect();

        info!("Updating effects chain. Enabled: {:?}", enabled_effects);

        match self.processing_state.write() {
            Ok(mut state) => {
                let sample_rate = state.sample_rate;
                let default_channel = self.config.channel_config.clone();
                let track = state
                    .local_tracks
                    .entry(track_id.to_string())
                    .or_insert_with(|| {
                        let mut effects_chain = EffectsChain::new();
                        effects_chain.set_sample_rate(sample_rate);
                        LocalTrackState {
                            bridge_track_id: 0,
                            track_name: track_id.to_string(),
                            channel_config: default_channel,
                            track_state: TrackState::new(),
                            effects_chain,
                            scratch_buffer: Vec::with_capacity(65536),
                        }
                    });
                track.effects_chain.update_settings(effects);
                info!("Effects chain updated successfully");
            }
            Err(e) => {
                tracing::error!("Failed to acquire write lock for effects update: {:?}", e);
            }
        }
    }

    /// Set room musical context for pitch/tempo-aware effects
    pub fn set_room_context(
        &self,
        key: Option<String>,
        scale: Option<String>,
        bpm: Option<f32>,
        time_sig_num: Option<u8>,
        time_sig_denom: Option<u8>,
    ) {
        if let Ok(mut state) = self.processing_state.write() {
            for track in state.local_tracks.values_mut() {
                track.effects_chain.set_room_context(
                    key.clone(),
                    scale.clone(),
                    bpm,
                    time_sig_num,
                    time_sig_denom,
                );
            }
        }
    }

    pub fn set_master_volume(&self, volume: f32) {
        if let Ok(mut state) = self.processing_state.write() {
            state.master_volume = volume;
        }
    }

    pub fn set_master_effects_enabled(&self, enabled: bool) {
        if let Ok(mut state) = self.processing_state.write() {
            state.master_effects_enabled = enabled;
        }
    }

    pub fn update_master_effects(
        &self,
        eq: Option<crate::effects::EqSettings>,
        compressor: Option<crate::effects::CompressorSettings>,
        reverb: Option<crate::effects::ReverbSettings>,
        limiter: Option<crate::effects::LimiterSettings>,
    ) {
        if let Ok(mut state) = self.processing_state.write() {
            let mut settings = state.master_effects_chain.get_settings().clone();
            if let Some(eq_settings) = eq {
                settings.eq = eq_settings;
            }
            if let Some(compressor_settings) = compressor {
                settings.compressor = compressor_settings;
            }
            if let Some(reverb_settings) = reverb {
                settings.reverb = reverb_settings;
            }
            if let Some(limiter_settings) = limiter {
                settings.limiter = limiter_settings;
            }
            state.master_effects_chain.update_settings(settings);
        }
    }

    // === Remote Users ===

    pub fn add_remote_user(&self, user_id: &str, user_name: &str) {
        // Create ring buffer for this user
        let ring_buffer = HeapRb::<f32>::new(REMOTE_RING_BUFFER_SIZE);
        let (producer, consumer) = ring_buffer.split();

        let buffer = RemoteUserBuffer {
            producer: Arc::new(std::sync::Mutex::new(producer)),
            consumer: Arc::new(std::sync::Mutex::new(consumer)),
            volume: 1.0,
            pan: 0.0, // Center by default
            is_muted: false,
            compensation_delay_samples: 0,
        };

        if let Ok(mut buffers) = self.remote_buffers.write() {
            buffers.insert(user_id.to_string(), buffer);
        }

        if let Ok(mut state) = self.processing_state.write() {
            state.remote_users.insert(
                user_id.to_string(),
                RemoteUserSettings {
                    volume: 1.0,
                    pan: 0.0,
                    is_muted: false,
                    compensation_delay_ms: 0.0,
                },
            );
        }

        info!("Added remote user: {} ({})", user_name, user_id);
    }

    pub fn remove_remote_user(&self, user_id: &str) {
        if let Ok(mut buffers) = self.remote_buffers.write() {
            buffers.remove(user_id);
        }
        if let Ok(mut state) = self.processing_state.write() {
            state.remote_users.remove(user_id);
        }
        info!("Removed remote user: {}", user_id);
    }

    pub fn update_remote_user(
        &self,
        user_id: &str,
        volume: f32,
        pan: f32,
        muted: bool,
        delay_ms: f32,
    ) {
        if let Ok(mut buffers) = self.remote_buffers.write() {
            if let Some(buffer) = buffers.get_mut(user_id) {
                buffer.volume = volume;
                buffer.pan = pan;
                buffer.is_muted = muted;
                // Convert delay_ms to samples
                let sample_rate = self.config.sample_rate as u32;
                buffer.compensation_delay_samples =
                    (delay_ms * sample_rate as f32 / 1000.0) as usize;
            }
        }
        if let Ok(mut state) = self.processing_state.write() {
            if let Some(settings) = state.remote_users.get_mut(user_id) {
                settings.volume = volume;
                settings.pan = pan;
                settings.is_muted = muted;
                settings.compensation_delay_ms = delay_ms;
            }
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn sync_remote_track(
        &self,
        user_id: &str,
        browser_track_id: &str,
        bridge_track_id: u8,
        track_name: &str,
        volume: f32,
        pan: f32,
        muted: bool,
        solo: bool,
    ) {
        let key = RemoteTrackKey {
            user_id: user_id.to_string(),
            bridge_track_id,
        };

        if let Ok(mut buffers) = self.remote_track_buffers.write() {
            buffers.entry(key).or_insert_with(|| {
                let ring_buffer = HeapRb::<f32>::new(REMOTE_RING_BUFFER_SIZE);
                let (producer, consumer) = ring_buffer.split();

                RemoteTrackBuffer {
                    producer: Arc::new(std::sync::Mutex::new(producer)),
                    consumer: Arc::new(std::sync::Mutex::new(consumer)),
                    volume,
                    pan,
                    is_muted: muted,
                    is_solo: solo,
                    compensation_delay_samples: 0,
                    track_name: track_name.to_string(),
                    browser_track_id: browser_track_id.to_string(),
                }
            });

            if let Some(buffer) = buffers.get_mut(&RemoteTrackKey {
                user_id: user_id.to_string(),
                bridge_track_id,
            }) {
                buffer.volume = volume;
                buffer.pan = pan;
                buffer.is_muted = muted;
                buffer.is_solo = solo;
                buffer.track_name = track_name.to_string();
                buffer.browser_track_id = browser_track_id.to_string();
            }
        }
    }

    pub fn remove_remote_track(&self, user_id: &str, bridge_track_id: u8) {
        if let Ok(mut buffers) = self.remote_track_buffers.write() {
            buffers.remove(&RemoteTrackKey {
                user_id: user_id.to_string(),
                bridge_track_id,
            });
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn update_remote_track(
        &self,
        user_id: &str,
        bridge_track_id: u8,
        volume: f32,
        pan: f32,
        muted: bool,
        solo: bool,
        delay_ms: f32,
    ) {
        if let Ok(mut buffers) = self.remote_track_buffers.write() {
            if let Some(buffer) = buffers.get_mut(&RemoteTrackKey {
                user_id: user_id.to_string(),
                bridge_track_id,
            }) {
                buffer.volume = volume;
                buffer.pan = pan;
                buffer.is_muted = muted;
                buffer.is_solo = solo;
                buffer.compensation_delay_samples =
                    (delay_ms * self.config.sample_rate as u32 as f32 / 1000.0) as usize;
            }
        }
    }

    pub fn push_remote_track_audio(&self, user_id: &str, bridge_track_id: u8, samples: &[f32]) {
        let key = RemoteTrackKey {
            user_id: user_id.to_string(),
            bridge_track_id,
        };

        if let Ok(mut buffers) = self.remote_track_buffers.write() {
            let buffer = buffers.entry(key).or_insert_with(|| {
                let ring_buffer = HeapRb::<f32>::new(REMOTE_RING_BUFFER_SIZE);
                let (producer, consumer) = ring_buffer.split();

                RemoteTrackBuffer {
                    producer: Arc::new(std::sync::Mutex::new(producer)),
                    consumer: Arc::new(std::sync::Mutex::new(consumer)),
                    volume: 1.0,
                    pan: 0.0,
                    is_muted: false,
                    is_solo: false,
                    compensation_delay_samples: 0,
                    track_name: format!("Track {}", bridge_track_id),
                    browser_track_id: format!("bridge-{}", bridge_track_id),
                }
            });

            if let Ok(mut prod) = buffer.producer.try_lock() {
                for &sample in samples {
                    let _ = prod.try_push(sample);
                }
            }
        }
    }

    /// Push audio data for a remote user (called when WebRTC audio arrives)
    pub fn push_remote_audio(&self, user_id: &str, samples: &[f32]) {
        if let Ok(buffers) = self.remote_buffers.read() {
            if let Some(buffer) = buffers.get(user_id) {
                if let Ok(mut prod) = buffer.producer.try_lock() {
                    for &sample in samples {
                        let _ = prod.try_push(sample);
                    }
                }
            }
        }
    }

    // === Backing Track ===

    pub fn load_backing_track(&self, duration: f32) {
        if let Ok(mut state) = self.processing_state.write() {
            state.backing_track.is_loaded = true;
            state.backing_track.is_playing = false;
            state.backing_track.current_time = 0.0;
            state.backing_track.duration = duration.max(0.0);
        }
    }

    pub fn set_backing_track_state(&self, is_playing: bool, current_time: f32) {
        if let Ok(mut state) = self.processing_state.write() {
            state.backing_track.is_loaded = true;
            state.backing_track.is_playing = is_playing;
            state.backing_track.current_time = current_time;
        }
    }

    pub fn set_backing_track_volume(&self, volume: f32) {
        if let Ok(mut state) = self.processing_state.write() {
            state.backing_track.volume = volume;
        }
    }

    /// Push backing track audio samples
    pub fn push_backing_audio(&self, samples: &[f32]) {
        if let Some(ref producer) = self.backing_producer {
            if let Ok(mut prod) = producer.try_lock() {
                for &sample in samples {
                    let _ = prod.try_push(sample);
                }
            }
        }
    }

    // === Metering ===

    pub fn get_levels(&self) -> AudioLevels {
        self.levels.read().map(|l| l.clone()).unwrap_or_default()
    }

    pub fn get_effects_metering(&self) -> EffectsMetering {
        self.effects_metering
            .read()
            .map(|m| m.clone())
            .unwrap_or_default()
    }

    pub fn get_latency_info(&self) -> LatencyInfo {
        let buffer_samples = self.config.buffer_size as u32;
        let sample_rate = self.config.sample_rate as u32;
        let buffer_latency = (buffer_samples as f32 / sample_rate as f32) * 1000.0;

        LatencyInfo {
            input_latency_ms: buffer_latency,
            output_latency_ms: buffer_latency,
            total_latency_ms: buffer_latency * 2.0,
            buffer_size_samples: buffer_samples,
        }
    }

    /// Get device info for TUI display
    pub fn get_device_info(&self) -> TuiDeviceInfo {
        TuiDeviceInfo {
            input_device: self
                .input_device
                .as_ref()
                .map(|d| d.info.name.clone())
                .unwrap_or_else(|| "None".to_string()),
            output_device: self
                .output_device
                .as_ref()
                .map(|d| d.info.name.clone())
                .unwrap_or_else(|| "None".to_string()),
            sample_rate: self.config.sample_rate as u32,
            buffer_size: self.config.buffer_size as u32,
        }
    }

    /// Get current input device ID
    pub fn get_input_device_id(&self) -> Option<String> {
        self.config.input_device_id.clone()
    }

    /// Get current output device ID
    pub fn get_output_device_id(&self) -> Option<String> {
        self.config.output_device_id.clone()
    }

    /// Get current channel configuration
    pub fn get_channel_config(&self) -> ChannelConfig {
        if let Ok(state) = self.processing_state.try_read() {
            state
                .local_tracks
                .values()
                .next()
                .map(|track| track.channel_config.clone())
                .unwrap_or_else(|| self.config.channel_config.clone())
        } else {
            self.config.channel_config.clone()
        }
    }

    pub fn get_local_track_descriptors(&self) -> Vec<LocalTrackDescriptor> {
        if let Ok(state) = self.processing_state.try_read() {
            return state
                .local_tracks
                .iter()
                .map(|(browser_track_id, track)| LocalTrackDescriptor {
                    browser_track_id: browser_track_id.clone(),
                    bridge_track_id: track.bridge_track_id,
                    track_name: track.track_name.clone(),
                })
                .collect();
        }

        Vec::new()
    }

    pub fn get_local_track_browser_audio(
        &self,
        browser_track_id: &str,
        max_samples: usize,
    ) -> Vec<f32> {
        if let Ok(local_track_io) = self.local_track_io.read() {
            if let Some(track_io) = local_track_io.get(browser_track_id) {
                if let Ok(mut consumer) = track_io.browser_consumer.try_lock() {
                    let available = consumer.occupied_len();
                    let to_read = available.min(max_samples);
                    if to_read > 0 {
                        let mut buffer = vec![0.0f32; to_read];
                        let read = consumer.pop_slice(&mut buffer);
                        buffer.truncate(read);
                        return buffer;
                    }
                }
            }
        }

        Vec::new()
    }

    pub fn get_local_track_network_audio(
        &self,
        browser_track_id: &str,
        max_samples: usize,
    ) -> Vec<f32> {
        if let Ok(local_track_io) = self.local_track_io.read() {
            if let Some(track_io) = local_track_io.get(browser_track_id) {
                if let Ok(mut consumer) = track_io.network_consumer.try_lock() {
                    let available = consumer.occupied_len();
                    let to_read = available.min(max_samples);
                    if to_read > 0 {
                        let mut buffer = vec![0.0f32; to_read];
                        let read = consumer.pop_slice(&mut buffer);
                        buffer.truncate(read);
                        return buffer;
                    }
                }
            }
        }

        Vec::new()
    }

    /// Get raw audio samples for streaming to browser (for WebRTC broadcast)
    /// Returns up to `max_samples` stereo samples, or fewer if buffer has less
    pub fn get_browser_stream_audio(&self, max_samples: usize) -> Vec<f32> {
        if let Some(ref consumer) = self.browser_stream_consumer {
            if let Ok(mut cons) = consumer.try_lock() {
                let available = cons.occupied_len();
                let to_read = available.min(max_samples);
                if to_read > 0 {
                    let mut buffer = vec![0.0f32; to_read];
                    let read = cons.pop_slice(&mut buffer);
                    buffer.truncate(read);
                    return buffer;
                }
            }
        }
        Vec::new()
    }

    /// Check if there's audio available for browser streaming
    pub fn has_browser_stream_audio(&self) -> bool {
        if let Ok(local_track_io) = self.local_track_io.read() {
            if !local_track_io.is_empty() {
                return local_track_io.values().any(|track_io| {
                    track_io
                        .browser_consumer
                        .try_lock()
                        .map(|cons| cons.occupied_len() > 0)
                        .unwrap_or(false)
                });
            }
        }

        if let Some(ref consumer) = self.browser_stream_consumer {
            if let Ok(cons) = consumer.try_lock() {
                return cons.occupied_len() > 0;
            }
        }
        false
    }

    // === Audio Stream Control ===

    pub fn start(&mut self) -> Result<()> {
        if self.is_running.load(Ordering::SeqCst) {
            return Ok(());
        }

        if let Ok(mut state) = self.processing_state.write() {
            for track in state.local_tracks.values_mut() {
                if track.channel_config != self.config.channel_config && track.bridge_track_id == 0
                {
                    track.channel_config = self.config.channel_config.clone();
                }
            }
        }

        // Create ring buffers
        let local_ring = HeapRb::<f32>::new(LOCAL_RING_BUFFER_SIZE);
        let (local_prod, local_cons) = local_ring.split();
        self.local_producer = Some(Arc::new(std::sync::Mutex::new(local_prod)));
        self.local_consumer = Some(Arc::new(std::sync::Mutex::new(local_cons)));

        let backing_ring = HeapRb::<f32>::new(BACKING_RING_BUFFER_SIZE);
        let (backing_prod, backing_cons) = backing_ring.split();
        self.backing_producer = Some(Arc::new(std::sync::Mutex::new(backing_prod)));
        self.backing_consumer = Some(Arc::new(std::sync::Mutex::new(backing_cons)));

        // Browser stream ring buffer (for sending raw audio to browser for WebRTC broadcast)
        let browser_ring = HeapRb::<f32>::new(BROWSER_STREAM_BUFFER_SIZE);
        let (browser_prod, browser_cons) = browser_ring.split();
        self.browser_stream_producer = Some(Arc::new(std::sync::Mutex::new(browser_prod)));
        self.browser_stream_consumer = Some(Arc::new(std::sync::Mutex::new(browser_cons)));

        let input_device_id = self.config.input_device_id.clone();
        let is_asio = input_device_id
            .as_ref()
            .map(|id| id.starts_with("asio:"))
            .unwrap_or(false);

        if is_asio {
            return self.start_asio();
        }

        self.start_standard()
    }

    fn start_standard(&mut self) -> Result<()> {
        // Get devices
        if let Some(ref device_id) = self.config.input_device_id {
            self.input_device = Some(AudioDevice::get_by_id(device_id)?);
        } else if self.input_device.is_none() {
            self.input_device = Some(AudioDevice::default_input()?);
        }

        if let Some(ref device_id) = self.config.output_device_id {
            self.output_device = Some(AudioDevice::get_by_id(device_id)?);
        } else if self.output_device.is_none() {
            self.output_device = Some(AudioDevice::default_output()?);
        }

        let input_device = self
            .input_device
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No input device available"))?;
        let output_device = self
            .output_device
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No output device available"))?;

        let input_default_config = input_device
            .device
            .default_input_config()
            .map_err(|e| anyhow::anyhow!("No input config: {}", e))?;
        let output_default_config = output_device
            .device
            .default_output_config()
            .map_err(|e| anyhow::anyhow!("No output config: {}", e))?;

        let buffer_size_samples = self.config.buffer_size as u32;
        let sample_rate = self.config.sample_rate as u32;

        let input_config = cpal::StreamConfig {
            channels: input_default_config.channels(),
            sample_rate: cpal::SampleRate(sample_rate),
            buffer_size: cpal::BufferSize::Fixed(buffer_size_samples),
        };

        let output_config = cpal::StreamConfig {
            channels: output_default_config.channels().min(2),
            sample_rate: cpal::SampleRate(sample_rate),
            buffer_size: cpal::BufferSize::Fixed(buffer_size_samples),
        };

        // Create input stream
        let input_stream = self.build_input_stream(
            &input_device.device,
            &input_config,
            input_default_config.sample_format(),
        )?;

        // Create output stream
        let output_stream = self.build_output_stream(
            &output_device.device,
            &output_config,
            output_default_config.sample_format(),
        )?;

        input_stream.play()?;
        output_stream.play()?;

        self.input_stream = Some(input_stream);
        self.output_stream = Some(output_stream);
        self.is_running.store(true, Ordering::SeqCst);

        let latency_ms = (buffer_size_samples as f32 / sample_rate as f32) * 1000.0;
        info!(
            "Audio started: {} -> {} @ {}Hz ({:.1}ms latency)",
            input_device.info.name,
            output_device.info.name,
            sample_rate,
            latency_ms * 2.0
        );

        Ok(())
    }

    fn build_input_stream(
        &self,
        device: &cpal::Device,
        config: &cpal::StreamConfig,
        sample_format: SampleFormat,
    ) -> Result<cpal::Stream> {
        let producer = self
            .local_producer
            .clone()
            .ok_or_else(|| anyhow::anyhow!("Local input ring buffer not initialized"))?;
        let local_track_io = self.local_track_io.clone();
        let browser_stream_producer = self.browser_stream_producer.clone();
        let levels = self.levels.clone();
        let is_monitoring = self.is_monitoring.clone();
        let monitoring_volume = self.monitoring_volume.clone();
        let processing_state = self.processing_state.clone();
        let effects_metering = self.effects_metering.clone();
        let overflow_count = self.browser_stream_overflow_count.clone();
        let overflow_samples = self.browser_stream_overflow_samples.clone();
        let input_channels = config.channels as usize;

        // Pre-allocate stereo buffer BEFORE building stream (allocation happens here, not in callback!)
        // Use 65536 to handle any ASIO buffer size without reallocation
        let stereo_buffer = RefCell::new(Vec::<f32>::with_capacity(65536));

        let stream = match sample_format {
            SampleFormat::F32 => device.build_input_stream(
                config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    let mut stereo_buf = stereo_buffer.borrow_mut();
                    Self::process_input(
                        data,
                        input_channels,
                        &mut stereo_buf,
                        &producer,
                        &local_track_io,
                        browser_stream_producer.as_ref(),
                        &levels,
                        &is_monitoring,
                        &monitoring_volume,
                        &processing_state,
                        &effects_metering,
                        &overflow_count,
                        &overflow_samples,
                    );
                },
                |_err| {}, // No logging - allocates memory which kills ASIO
                None,
            )?,
            SampleFormat::I32 => {
                let browser_stream_producer = self.browser_stream_producer.clone();
                let local_track_io = self.local_track_io.clone();
                let overflow_count = self.browser_stream_overflow_count.clone();
                let overflow_samples = self.browser_stream_overflow_samples.clone();
                // Pre-allocate both conversion buffer and stereo buffer
                // Use 65536 to handle any ASIO buffer size without reallocation
                let conversion_buffer = RefCell::new(Vec::<f32>::with_capacity(65536));
                let stereo_buffer = RefCell::new(Vec::<f32>::with_capacity(65536));

                device.build_input_stream(
                    config,
                    move |data: &[i32], _: &cpal::InputCallbackInfo| {
                        let mut conv_buf = conversion_buffer.borrow_mut();
                        let mut stereo_buf = stereo_buffer.borrow_mut();

                        // Convert I32 to F32 using pre-allocated buffer
                        conv_buf.clear();
                        conv_buf.extend(data.iter().map(|&s| s as f32 / i32::MAX as f32));

                        Self::process_input(
                            &conv_buf,
                            input_channels,
                            &mut stereo_buf,
                            &producer,
                            &local_track_io,
                            browser_stream_producer.as_ref(),
                            &levels,
                            &is_monitoring,
                            &monitoring_volume,
                            &processing_state,
                            &effects_metering,
                            &overflow_count,
                            &overflow_samples,
                        );
                    },
                    |_err| {}, // No logging - allocates memory which kills ASIO
                    None,
                )?
            }
            SampleFormat::I16 => {
                let browser_stream_producer = self.browser_stream_producer.clone();
                let local_track_io = self.local_track_io.clone();
                let overflow_count = self.browser_stream_overflow_count.clone();
                let overflow_samples = self.browser_stream_overflow_samples.clone();
                // Pre-allocate both conversion buffer and stereo buffer
                // Use 65536 to handle any ASIO buffer size without reallocation
                let conversion_buffer = RefCell::new(Vec::<f32>::with_capacity(65536));
                let stereo_buffer = RefCell::new(Vec::<f32>::with_capacity(65536));

                device.build_input_stream(
                    config,
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        let mut conv_buf = conversion_buffer.borrow_mut();
                        let mut stereo_buf = stereo_buffer.borrow_mut();

                        // Convert I16 to F32 using pre-allocated buffer
                        conv_buf.clear();
                        conv_buf.extend(data.iter().map(|&s| s as f32 / i16::MAX as f32));

                        Self::process_input(
                            &conv_buf,
                            input_channels,
                            &mut stereo_buf,
                            &producer,
                            &local_track_io,
                            browser_stream_producer.as_ref(),
                            &levels,
                            &is_monitoring,
                            &monitoring_volume,
                            &processing_state,
                            &effects_metering,
                            &overflow_count,
                            &overflow_samples,
                        );
                    },
                    |_err| {}, // No logging - allocates memory which kills ASIO
                    None,
                )?
            }
            _ => {
                return Err(anyhow::anyhow!(
                    "Unsupported input format: {:?}",
                    sample_format
                ))
            }
        };

        Ok(stream)
    }

    fn build_output_stream(
        &self,
        device: &cpal::Device,
        config: &cpal::StreamConfig,
        sample_format: SampleFormat,
    ) -> Result<cpal::Stream> {
        let local_consumer = self
            .local_consumer
            .clone()
            .ok_or_else(|| anyhow::anyhow!("Local output ring buffer not initialized"))?;
        let remote_buffers = self.remote_buffers.clone();
        let remote_track_buffers = self.remote_track_buffers.clone();
        let backing_consumer = self
            .backing_consumer
            .clone()
            .ok_or_else(|| anyhow::anyhow!("Backing track ring buffer not initialized"))?;
        let levels = self.levels.clone();
        let processing_state = self.processing_state.clone();

        let stream = match sample_format {
            SampleFormat::F32 => device.build_output_stream(
                config,
                move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                    Self::process_output_f32(
                        data,
                        &local_consumer,
                        &remote_buffers,
                        &remote_track_buffers,
                        &backing_consumer,
                        &levels,
                        &processing_state,
                    );
                },
                |_err| {}, // No logging - allocates memory which kills ASIO
                None,
            )?,
            SampleFormat::I32 => {
                // Pre-allocate conversion buffer
                // Use 65536 to handle any ASIO buffer size without reallocation
                let float_buffer = RefCell::new(Vec::<f32>::with_capacity(65536));

                device.build_output_stream(
                    config,
                    move |data: &mut [i32], _: &cpal::OutputCallbackInfo| {
                        let mut float_buf = float_buffer.borrow_mut();
                        Self::process_output_i32(
                            data,
                            &mut float_buf,
                            &local_consumer,
                            &remote_buffers,
                            &remote_track_buffers,
                            &backing_consumer,
                            &levels,
                            &processing_state,
                        );
                    },
                    |_err| {}, // No logging - allocates memory which kills ASIO
                    None,
                )?
            }
            SampleFormat::I16 => {
                // Pre-allocate conversion buffer
                // Use 65536 to handle any ASIO buffer size without reallocation
                let float_buffer = RefCell::new(Vec::<f32>::with_capacity(65536));

                device.build_output_stream(
                    config,
                    move |data: &mut [i16], _: &cpal::OutputCallbackInfo| {
                        let mut float_buf = float_buffer.borrow_mut();
                        Self::process_output_i16(
                            data,
                            &mut float_buf,
                            &local_consumer,
                            &remote_buffers,
                            &remote_track_buffers,
                            &backing_consumer,
                            &levels,
                            &processing_state,
                        );
                    },
                    |_err| {}, // No logging - allocates memory which kills ASIO
                    None,
                )?
            }
            _ => {
                return Err(anyhow::anyhow!(
                    "Unsupported output format: {:?}",
                    sample_format
                ))
            }
        };

        Ok(stream)
    }

    /// Process input audio
    /// stereo_buffer: Pre-allocated buffer for stereo extraction. MUST be allocated before ASIO starts!
    #[allow(clippy::too_many_arguments)]
    fn process_input(
        data: &[f32],
        input_channels: usize,
        stereo_buffer: &mut Vec<f32>,
        producer: &Arc<std::sync::Mutex<HeapProd<f32>>>,
        local_track_io: &Arc<RwLock<HashMap<String, LocalTrackIo>>>,
        browser_stream_producer: Option<&Arc<std::sync::Mutex<HeapProd<f32>>>>,
        levels: &Arc<RwLock<AudioLevels>>,
        is_monitoring: &Arc<AtomicBool>,
        monitoring_volume: &Arc<AtomicU32>,
        processing_state: &Arc<RwLock<AudioProcessingState>>,
        effects_metering: &Arc<RwLock<EffectsMetering>>,
        overflow_count: &Arc<AtomicU64>,
        overflow_samples: &Arc<AtomicU64>,
    ) {
        // NO LOGGING IN THIS FUNCTION - logging allocates memory which kills ASIO

        if let Ok(mut state) = processing_state.try_write() {
            if !state.local_tracks.is_empty() {
                let frame_count = data.len() / input_channels.max(1);
                stereo_buffer.clear();
                stereo_buffer.resize(frame_count * 2, 0.0);

                let mut level_l = 0.0_f32;
                let mut level_r = 0.0_f32;
                let monitoring_enabled = is_monitoring.load(Ordering::Relaxed);
                let global_monitoring_volume =
                    f32::from_bits(monitoring_volume.load(Ordering::Relaxed));
                let any_solo = state
                    .local_tracks
                    .values()
                    .any(|track| track.track_state.is_solo);
                let local_track_io_guard = local_track_io.try_read().ok();
                let mut metering_updated = false;

                for (track_id, track) in state.local_tracks.iter_mut() {
                    track.scratch_buffer.clear();

                    let left_channel = track.channel_config.left_channel as usize;
                    let right_channel = track.channel_config.right_channel.unwrap_or(1) as usize;
                    let is_stereo = track.channel_config.channel_count == 2;

                    for frame in data.chunks(input_channels) {
                        let left_sample = frame.get(left_channel).copied().unwrap_or(0.0);
                        let right_sample = if is_stereo {
                            frame.get(right_channel).copied().unwrap_or(left_sample)
                        } else {
                            left_sample
                        };
                        track.scratch_buffer.push(left_sample);
                        track.scratch_buffer.push(right_sample);
                    }

                    let gain = track.track_state.input_gain_linear();
                    for sample in track.scratch_buffer.iter_mut() {
                        *sample *= gain;
                    }

                    track.effects_chain.process(&mut track.scratch_buffer);

                    if !metering_updated {
                        if let Ok(mut metering) = effects_metering.try_write() {
                            let chain_metering = track.effects_chain.get_metering();
                            metering.noise_gate_open = chain_metering.noise_gate_open;
                            metering.compressor_reduction = chain_metering.compressor_reduction;
                            metering.de_esser_reduction = chain_metering.de_esser_reduction;
                            metering.limiter_reduction = chain_metering.limiter_reduction;
                        }
                        metering_updated = true;
                    }

                    for chunk in track.scratch_buffer.chunks_exact(2) {
                        level_l = level_l.max(chunk[0].abs());
                        level_r = level_r.max(chunk[1].abs());
                    }

                    if let Some(local_track_io_guard) = local_track_io_guard.as_ref() {
                        if let Some(track_io) = local_track_io_guard.get(track_id) {
                            if let Ok(mut network_prod) = track_io.network_producer.try_lock() {
                                let _ = network_prod.push_slice(&track.scratch_buffer);
                            }
                            if let Ok(mut browser_prod) = track_io.browser_producer.try_lock() {
                                let pushed = browser_prod.push_slice(&track.scratch_buffer);
                                let dropped = track.scratch_buffer.len() - pushed;
                                if dropped > 0 {
                                    overflow_count.fetch_add(1, Ordering::Relaxed);
                                    overflow_samples.fetch_add(dropped as u64, Ordering::Relaxed);
                                }
                            }
                        }
                    }

                    if monitoring_enabled
                        && track.track_state.monitoring_enabled
                        && track.track_state.should_pass_audio(any_solo)
                    {
                        let (pan_left, pan_right) = track.track_state.pan_gains();
                        let base_gain = track.track_state.volume
                            * track.track_state.monitoring_volume
                            * global_monitoring_volume;

                        for (monitor_chunk, track_chunk) in stereo_buffer
                            .chunks_exact_mut(2)
                            .zip(track.scratch_buffer.chunks_exact(2))
                        {
                            monitor_chunk[0] += track_chunk[0] * base_gain * pan_left;
                            monitor_chunk[1] += track_chunk[1] * base_gain * pan_right;
                        }
                    }
                }

                if let Ok(mut lvl) = levels.try_write() {
                    lvl.input_level_l = level_l;
                    lvl.input_level_r = level_r;
                    lvl.input_peak_l = lvl.input_peak_l.max(level_l);
                    lvl.input_peak_r = lvl.input_peak_r.max(level_r);
                }

                if let Ok(mut prod) = producer.try_lock() {
                    let _ = prod.push_slice(stereo_buffer);
                }

                return;
            }
        }

        // Fallback single-stream path when no local tracks are configured yet.
        stereo_buffer.clear();
        for frame in data.chunks(input_channels) {
            let left_sample = frame.first().copied().unwrap_or(0.0);
            stereo_buffer.push(left_sample);
            stereo_buffer.push(left_sample);
        }

        // Calculate input levels (stereo) - interleaved L/R samples
        let (level_l, level_r) = stereo_buffer
            .chunks_exact(2)
            .fold((0.0_f32, 0.0_f32), |(max_l, max_r), chunk| {
                (max_l.max(chunk[0].abs()), max_r.max(chunk[1].abs()))
            });
        if let Ok(mut lvl) = levels.try_write() {
            lvl.input_level_l = level_l;
            lvl.input_level_r = level_r;
            lvl.input_peak_l = lvl.input_peak_l.max(level_l);
            lvl.input_peak_r = lvl.input_peak_r.max(level_r);
        }

        // Legacy browser stream path used before track registration completes.
        if let Some(browser_prod) = browser_stream_producer {
            if let Ok(mut prod) = browser_prod.try_lock() {
                let pushed = prod.push_slice(stereo_buffer);
                let dropped = stereo_buffer.len() - pushed;
                if dropped > 0 {
                    // Track overflow without allocation (atomic increment)
                    overflow_count.fetch_add(1, Ordering::Relaxed);
                    overflow_samples.fetch_add(dropped as u64, Ordering::Relaxed);
                }
            }
        }

        let mon_vol = f32::from_bits(monitoring_volume.load(Ordering::Relaxed));
        let monitoring_enabled = is_monitoring.load(Ordering::Relaxed);
        if monitoring_enabled {
            for chunk in stereo_buffer.chunks_exact_mut(2) {
                chunk[0] *= mon_vol;
                chunk[1] *= mon_vol;
            }
            // Push to output ring buffer
            if let Ok(mut prod) = producer.try_lock() {
                let _ = prod.push_slice(stereo_buffer);
            }
        }
    }

    /// Process output audio (mix all sources)
    /// NO LOGGING IN THIS FUNCTION - logging allocates memory which kills ASIO
    fn process_output_f32(
        data: &mut [f32],
        local_consumer: &Arc<std::sync::Mutex<HeapCons<f32>>>,
        remote_buffers: &Arc<RwLock<HashMap<String, RemoteUserBuffer>>>,
        remote_track_buffers: &Arc<RwLock<HashMap<RemoteTrackKey, RemoteTrackBuffer>>>,
        backing_consumer: &Arc<std::sync::Mutex<HeapCons<f32>>>,
        levels: &Arc<RwLock<AudioLevels>>,
        processing_state: &Arc<RwLock<AudioProcessingState>>,
    ) {
        // Clear output
        for sample in data.iter_mut() {
            *sample = 0.0;
        }

        // Mix local audio (from DRY monitoring)
        if let Ok(mut cons) = local_consumer.try_lock() {
            for sample in data.iter_mut() {
                *sample += cons.try_pop().unwrap_or(0.0);
            }
        }

        // Mix remote user audio with pan
        if let Ok(buffers) = remote_buffers.try_read() {
            for (_user_id, buffer) in buffers.iter() {
                if buffer.is_muted {
                    continue;
                }
                // Calculate constant-power pan gains
                let pan_angle = (buffer.pan + 1.0) * 0.25 * std::f32::consts::PI; // 0 to PI/2
                let left_gain = pan_angle.cos() * buffer.volume;
                let right_gain = pan_angle.sin() * buffer.volume;

                if let Ok(mut cons) = buffer.consumer.try_lock() {
                    // Process stereo pairs (L, R, L, R, ...)
                    for chunk in data.chunks_exact_mut(2) {
                        let left_sample = cons.try_pop().unwrap_or(0.0);
                        let right_sample = cons.try_pop().unwrap_or(0.0);
                        chunk[0] += left_sample * left_gain;
                        chunk[1] += right_sample * right_gain;
                    }
                }
            }
        }

        if let Ok(buffers) = remote_track_buffers.try_read() {
            let any_solo = buffers.values().any(|buffer| buffer.is_solo);

            for buffer in buffers.values() {
                if buffer.is_muted || (any_solo && !buffer.is_solo) {
                    continue;
                }

                let pan_angle = (buffer.pan + 1.0) * 0.25 * std::f32::consts::PI;
                let left_gain = pan_angle.cos() * buffer.volume;
                let right_gain = pan_angle.sin() * buffer.volume;

                if let Ok(mut cons) = buffer.consumer.try_lock() {
                    for chunk in data.chunks_exact_mut(2) {
                        let left_sample = cons.try_pop().unwrap_or(0.0);
                        let right_sample = cons.try_pop().unwrap_or(0.0);
                        chunk[0] += left_sample * left_gain;
                        chunk[1] += right_sample * right_gain;
                    }
                }
            }
        }

        // Mix backing track
        let backing_volume = processing_state
            .try_read()
            .map(|s| {
                if s.backing_track.is_loaded && s.backing_track.is_playing {
                    s.backing_track.volume
                } else {
                    0.0
                }
            })
            .unwrap_or(0.0);

        let mut backing_level = 0.0_f32;
        if backing_volume > 0.0 {
            if let Ok(mut cons) = backing_consumer.try_lock() {
                for sample in data.iter_mut() {
                    let s = cons.try_pop().unwrap_or(0.0) * backing_volume;
                    backing_level = backing_level.max(s.abs());
                    *sample += s;
                }
            }
        }

        let master_vol = if let Ok(mut state) = processing_state.try_write() {
            if state.master_effects_enabled {
                state.master_effects_chain.process(data);
            }
            state.master_volume
        } else {
            1.0
        };

        // Apply master volume
        for sample in data.iter_mut() {
            *sample *= master_vol;
        }

        // Soft clip to prevent harsh clipping
        for sample in data.iter_mut() {
            *sample = sample.tanh();
        }

        // Update output levels for metering (stereo) - interleaved L/R samples
        let (level_l, level_r) = data
            .chunks_exact(2)
            .fold((0.0_f32, 0.0_f32), |(max_l, max_r), chunk| {
                (max_l.max(chunk[0].abs()), max_r.max(chunk[1].abs()))
            });
        if let Ok(mut lvl) = levels.try_write() {
            lvl.output_level_l = level_l;
            lvl.output_level_r = level_r;
            lvl.output_peak_l = lvl.output_peak_l.max(level_l);
            lvl.output_peak_r = lvl.output_peak_r.max(level_r);
            lvl.backing_level = backing_level;
        }
    }

    /// Process I32 output - converts to F32, processes, converts back
    /// float_buffer: Pre-allocated buffer for F32 conversion. MUST be allocated before ASIO starts!
    #[allow(clippy::too_many_arguments)]
    fn process_output_i32(
        data: &mut [i32],
        float_buffer: &mut Vec<f32>,
        local_consumer: &Arc<std::sync::Mutex<HeapCons<f32>>>,
        remote_buffers: &Arc<RwLock<HashMap<String, RemoteUserBuffer>>>,
        remote_track_buffers: &Arc<RwLock<HashMap<RemoteTrackKey, RemoteTrackBuffer>>>,
        backing_consumer: &Arc<std::sync::Mutex<HeapCons<f32>>>,
        levels: &Arc<RwLock<AudioLevels>>,
        processing_state: &Arc<RwLock<AudioProcessingState>>,
    ) {
        // resize() doesn't allocate if capacity is sufficient
        float_buffer.resize(data.len(), 0.0);

        Self::process_output_f32(
            float_buffer,
            local_consumer,
            remote_buffers,
            remote_track_buffers,
            backing_consumer,
            levels,
            processing_state,
        );

        // Convert to i32
        for (out, &f) in data.iter_mut().zip(float_buffer.iter()) {
            *out = (f * i32::MAX as f32) as i32;
        }
    }

    /// Process I16 output - converts to F32, processes, converts back
    /// float_buffer: Pre-allocated buffer for F32 conversion. MUST be allocated before ASIO starts!
    #[allow(clippy::too_many_arguments)]
    fn process_output_i16(
        data: &mut [i16],
        float_buffer: &mut Vec<f32>,
        local_consumer: &Arc<std::sync::Mutex<HeapCons<f32>>>,
        remote_buffers: &Arc<RwLock<HashMap<String, RemoteUserBuffer>>>,
        remote_track_buffers: &Arc<RwLock<HashMap<RemoteTrackKey, RemoteTrackBuffer>>>,
        backing_consumer: &Arc<std::sync::Mutex<HeapCons<f32>>>,
        levels: &Arc<RwLock<AudioLevels>>,
        processing_state: &Arc<RwLock<AudioProcessingState>>,
    ) {
        // resize() doesn't allocate if capacity is sufficient
        float_buffer.resize(data.len(), 0.0);

        Self::process_output_f32(
            float_buffer,
            local_consumer,
            remote_buffers,
            remote_track_buffers,
            backing_consumer,
            levels,
            processing_state,
        );

        for (out, &f) in data.iter_mut().zip(float_buffer.iter()) {
            *out = (f * i16::MAX as f32) as i16;
        }
    }

    // === ASIO Support ===

    #[cfg(target_os = "windows")]
    fn start_asio(&mut self) -> Result<()> {
        use cpal::traits::HostTrait;

        let device_id = self
            .config
            .input_device_id
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No ASIO device selected"))?;

        info!("Starting ASIO with device: {}", device_id);

        let asio_host = cpal::host_from_id(cpal::HostId::Asio)
            .map_err(|e| anyhow::anyhow!("Failed to get ASIO host: {}", e))?;

        let device_name = device_id.strip_prefix("asio:").unwrap_or(device_id);
        let device = asio_host
            .devices()
            .map_err(|e| anyhow::anyhow!("Failed to enumerate ASIO devices: {}", e))?
            .find(|d| {
                d.name()
                    .ok()
                    .map(|n| {
                        n.replace(' ', "_").to_lowercase()
                            == device_name.replace(' ', "_").to_lowercase()
                    })
                    .unwrap_or(false)
            })
            .ok_or_else(|| anyhow::anyhow!("ASIO device not found: {}", device_id))?;

        let device_name_display = device.name().unwrap_or_else(|_| "Unknown".to_string());
        info!("Found ASIO device: {}", device_name_display);

        let input_config = device
            .default_input_config()
            .map_err(|e| anyhow::anyhow!("Failed to get ASIO input config: {}", e))?;
        let output_config = device
            .default_output_config()
            .map_err(|e| anyhow::anyhow!("Failed to get ASIO output config: {}", e))?;

        let buffer_size_samples = self.config.buffer_size as u32;
        let sample_rate = self.config.sample_rate as u32;

        // Log device capabilities
        let device_input_channels = input_config.channels();
        let device_output_channels = output_config.channels();
        info!(
            "ASIO device - input channels: {}, output channels: {}",
            device_input_channels, device_output_channels
        );

        // For multitrack, we want all input channels but only 2 output channels
        // DIAGNOSTIC: If ASIO is dying, try limiting input to 2 as well
        let requested_input_channels = device_input_channels; // Change to .min(2) if ASIO issues persist

        let stream_input_config = cpal::StreamConfig {
            channels: requested_input_channels,
            sample_rate: cpal::SampleRate(sample_rate),
            buffer_size: cpal::BufferSize::Fixed(buffer_size_samples),
        };

        let stream_output_config = cpal::StreamConfig {
            channels: device_output_channels.min(2),
            sample_rate: cpal::SampleRate(sample_rate),
            buffer_size: cpal::BufferSize::Fixed(buffer_size_samples),
        };

        let input_channels = stream_input_config.channels as usize;
        let input_sample_format = input_config.sample_format();
        let output_sample_format = output_config.sample_format();

        info!(
            "ASIO stream config - input: {} ch {:?}, output: {} ch {:?}",
            input_channels,
            input_sample_format,
            stream_output_config.channels,
            output_sample_format
        );

        // Clone shared state for callbacks
        let producer = self
            .local_producer
            .clone()
            .ok_or_else(|| anyhow::anyhow!("Local input ring buffer not initialized"))?;
        let local_track_io = self.local_track_io.clone();
        let browser_stream_producer = self.browser_stream_producer.clone();
        let levels_in = self.levels.clone();
        let is_monitoring = self.is_monitoring.clone();
        let monitoring_volume = self.monitoring_volume.clone();
        let processing_state_in = self.processing_state.clone();
        let effects_metering = self.effects_metering.clone();
        let overflow_count = self.browser_stream_overflow_count.clone();
        let overflow_samples = self.browser_stream_overflow_samples.clone();

        // Build input stream
        // CRITICAL: Pre-allocate ALL buffers BEFORE building streams!
        // ASIO callbacks cannot tolerate ANY memory allocation.
        let input_stream = match input_sample_format {
            SampleFormat::F32 => {
                // Pre-allocate stereo buffer
                // Use 65536 to handle any ASIO buffer size without reallocation
                let stereo_buffer = RefCell::new(Vec::<f32>::with_capacity(65536));

                device.build_input_stream(
                    &stream_input_config,
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        let mut stereo_buf = stereo_buffer.borrow_mut();
                        Self::process_input(
                            data,
                            input_channels,
                            &mut stereo_buf,
                            &producer,
                            &local_track_io,
                            browser_stream_producer.as_ref(),
                            &levels_in,
                            &is_monitoring,
                            &monitoring_volume,
                            &processing_state_in,
                            &effects_metering,
                            &overflow_count,
                            &overflow_samples,
                        );
                    },
                    |_err| {}, // No logging - allocates memory which kills ASIO
                    None,
                )?
            }
            SampleFormat::I32 => {
                let overflow_count = self.browser_stream_overflow_count.clone();
                let overflow_samples = self.browser_stream_overflow_samples.clone();
                let local_track_io = self.local_track_io.clone();
                // Pre-allocate ALL buffers BEFORE building stream
                let conversion_buffer = RefCell::new(Vec::<f32>::with_capacity(65536));
                let stereo_buffer = RefCell::new(Vec::<f32>::with_capacity(65536));

                device.build_input_stream(
                    &stream_input_config,
                    move |data: &[i32], _: &cpal::InputCallbackInfo| {
                        let mut conv_buf = conversion_buffer.borrow_mut();
                        let mut stereo_buf = stereo_buffer.borrow_mut();

                        // Convert I32 to F32 using pre-allocated buffer
                        conv_buf.clear();
                        conv_buf.extend(data.iter().map(|&s| s as f32 / i32::MAX as f32));

                        Self::process_input(
                            &conv_buf,
                            input_channels,
                            &mut stereo_buf,
                            &producer,
                            &local_track_io,
                            browser_stream_producer.as_ref(),
                            &levels_in,
                            &is_monitoring,
                            &monitoring_volume,
                            &processing_state_in,
                            &effects_metering,
                            &overflow_count,
                            &overflow_samples,
                        );
                    },
                    |_err| {},
                    None,
                )?
            }
            _ => {
                return Err(anyhow::anyhow!(
                    "Unsupported ASIO input format: {:?}",
                    input_sample_format
                ))
            }
        };

        // Build output stream
        let local_consumer = self
            .local_consumer
            .clone()
            .ok_or_else(|| anyhow::anyhow!("Local output ring buffer not initialized"))?;
        let remote_buffers = self.remote_buffers.clone();
        let remote_track_buffers = self.remote_track_buffers.clone();
        let backing_consumer = self
            .backing_consumer
            .clone()
            .ok_or_else(|| anyhow::anyhow!("Backing track ring buffer not initialized"))?;
        let levels_out = self.levels.clone();
        let processing_state_out = self.processing_state.clone();

        let output_stream = match output_sample_format {
            SampleFormat::F32 => {
                device.build_output_stream(
                    &stream_output_config,
                    move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                        Self::process_output_f32(
                            data,
                            &local_consumer,
                            &remote_buffers,
                            &remote_track_buffers,
                            &backing_consumer,
                            &levels_out,
                            &processing_state_out,
                        );
                    },
                    |_err| {}, // No logging - allocates memory which kills ASIO
                    None,
                )?
            }
            SampleFormat::I32 => {
                // Pre-allocate conversion buffer BEFORE building stream
                let float_buffer = RefCell::new(Vec::<f32>::with_capacity(65536));

                device.build_output_stream(
                    &stream_output_config,
                    move |data: &mut [i32], _: &cpal::OutputCallbackInfo| {
                        let mut float_buf = float_buffer.borrow_mut();
                        Self::process_output_i32(
                            data,
                            &mut float_buf,
                            &local_consumer,
                            &remote_buffers,
                            &remote_track_buffers,
                            &backing_consumer,
                            &levels_out,
                            &processing_state_out,
                        );
                    },
                    |_err| {},
                    None,
                )?
            }
            _ => {
                return Err(anyhow::anyhow!(
                    "Unsupported ASIO output format: {:?}",
                    output_sample_format
                ))
            }
        };

        // Reset callback counters for diagnostics
        self.input_callback_count.store(0, Ordering::Relaxed);
        self.output_callback_count.store(0, Ordering::Relaxed);

        input_stream.play()?;
        output_stream.play()?;

        self.input_stream = Some(input_stream);
        self.output_stream = Some(output_stream);
        self.is_running.store(true, Ordering::SeqCst);

        if let Ok(mut state) = self.processing_state.write() {
            state.sample_rate = sample_rate;
            for track in state.local_tracks.values_mut() {
                track.effects_chain.set_sample_rate(sample_rate);
            }
            state.master_effects_chain.set_sample_rate(sample_rate);
        }

        let latency_ms = (buffer_size_samples as f32 / sample_rate as f32) * 1000.0;
        info!(
            "ASIO audio started: {} @ {}Hz, {}samples ({:.1}ms latency)",
            device_name_display,
            sample_rate,
            buffer_size_samples,
            latency_ms * 2.0
        );

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    fn start_asio(&mut self) -> Result<()> {
        Err(anyhow::anyhow!("ASIO is only available on Windows"))
    }

    pub fn stop(&mut self) -> Result<()> {
        self.input_stream = None;
        self.output_stream = None;
        self.is_running.store(false, Ordering::SeqCst);
        info!("Audio stopped");
        Ok(())
    }

    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    /// Get callback counts for diagnostics (input, output)
    pub fn get_callback_counts(&self) -> (u64, u64) {
        (
            self.input_callback_count.load(Ordering::Relaxed),
            self.output_callback_count.load(Ordering::Relaxed),
        )
    }

    /// Get overflow statistics for browser stream (count, samples_dropped)
    /// Returns the counts and resets them to zero
    pub fn get_and_reset_overflow_stats(&self) -> (u64, u64) {
        let count = self
            .browser_stream_overflow_count
            .swap(0, Ordering::Relaxed);
        let samples = self
            .browser_stream_overflow_samples
            .swap(0, Ordering::Relaxed);
        (count, samples)
    }

    /// Get overflow statistics without resetting
    pub fn get_overflow_stats(&self) -> (u64, u64) {
        (
            self.browser_stream_overflow_count.load(Ordering::Relaxed),
            self.browser_stream_overflow_samples.load(Ordering::Relaxed),
        )
    }

    /// Mark that browser has read from the stream (for health monitoring)
    pub fn mark_browser_read(&self) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or(0);
        self.last_browser_read_time.store(now, Ordering::Relaxed);
    }

    /// Get milliseconds since last browser read (0 if never read)
    pub fn ms_since_last_browser_read(&self) -> u64 {
        let last = self.last_browser_read_time.load(Ordering::Relaxed);
        if last == 0 {
            return 0;
        }
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or(last);
        now.saturating_sub(last)
    }

    /// Check if browser stream is healthy (reading regularly)
    pub fn is_browser_stream_healthy(&self) -> bool {
        let ms_since = self.ms_since_last_browser_read();
        // Healthy if never started or read within last 500ms
        ms_since == 0 || ms_since < 500
    }

    /// Get browser stream buffer occupancy (samples available, capacity)
    pub fn get_browser_stream_occupancy(&self) -> (usize, usize) {
        if let Ok(local_track_io) = self.local_track_io.read() {
            if !local_track_io.is_empty() {
                let mut used = 0usize;
                let mut capacity = 0usize;

                for track_io in local_track_io.values() {
                    capacity += LOCAL_TRACK_BROWSER_RING_BUFFER_SIZE;
                    if let Ok(cons) = track_io.browser_consumer.try_lock() {
                        used += cons.occupied_len();
                    }
                }

                return (used, capacity.max(LOCAL_TRACK_BROWSER_RING_BUFFER_SIZE));
            }
        }

        if let Some(ref consumer) = self.browser_stream_consumer {
            if let Ok(cons) = consumer.try_lock() {
                return (cons.occupied_len(), BROWSER_STREAM_BUFFER_SIZE);
            }
        }
        (0, BROWSER_STREAM_BUFFER_SIZE)
    }

    /// Create a thread-safe handle for use from the network bridge.
    /// This handle can be safely sent to other threads.
    pub fn create_bridge_handle(&self) -> AudioBridgeHandle {
        AudioBridgeHandle {
            remote_buffers: self.remote_buffers.clone(),
            remote_track_buffers: self.remote_track_buffers.clone(),
            local_track_io: self.local_track_io.clone(),
            browser_stream_consumer: self.browser_stream_consumer.clone(),
            processing_state: self.processing_state.clone(),
            sample_rate: self.config.sample_rate as u32,
        }
    }
}

/// Thread-safe handle for audio operations from the network bridge.
///
/// This struct contains only the thread-safe Arc-wrapped fields from AudioEngine
/// that are needed by the network bridge. It can be safely cloned and sent to
/// other threads.
#[derive(Clone)]
pub struct AudioBridgeHandle {
    remote_buffers: Arc<RwLock<HashMap<String, RemoteUserBuffer>>>,
    remote_track_buffers: Arc<RwLock<HashMap<RemoteTrackKey, RemoteTrackBuffer>>>,
    local_track_io: Arc<RwLock<HashMap<String, LocalTrackIo>>>,
    browser_stream_consumer: Option<Arc<std::sync::Mutex<HeapCons<f32>>>>,
    processing_state: Arc<RwLock<AudioProcessingState>>,
    sample_rate: u32,
}

// Explicitly mark AudioBridgeHandle as Send + Sync
// This is safe because all fields are Arc-wrapped thread-safe types
unsafe impl Send for AudioBridgeHandle {}
unsafe impl Sync for AudioBridgeHandle {}

impl AudioBridgeHandle {
    /// Add a remote user's audio buffer
    pub fn add_remote_user(&self, user_id: &str, user_name: &str) {
        // Create ring buffer for this user
        let ring_buffer = HeapRb::<f32>::new(REMOTE_RING_BUFFER_SIZE);
        let (producer, consumer) = ring_buffer.split();

        let buffer = RemoteUserBuffer {
            producer: Arc::new(std::sync::Mutex::new(producer)),
            consumer: Arc::new(std::sync::Mutex::new(consumer)),
            volume: 1.0,
            pan: 0.0,
            is_muted: false,
            compensation_delay_samples: 0,
        };

        if let Ok(mut buffers) = self.remote_buffers.write() {
            buffers.insert(user_id.to_string(), buffer);
        }

        if let Ok(mut state) = self.processing_state.write() {
            state.remote_users.insert(
                user_id.to_string(),
                RemoteUserSettings {
                    volume: 1.0,
                    pan: 0.0,
                    is_muted: false,
                    compensation_delay_ms: 0.0,
                },
            );
        }

        info!("Added remote user: {} ({})", user_name, user_id);
    }

    /// Remove a remote user's audio buffer
    pub fn remove_remote_user(&self, user_id: &str) {
        if let Ok(mut buffers) = self.remote_buffers.write() {
            buffers.remove(user_id);
        }
        if let Ok(mut state) = self.processing_state.write() {
            state.remote_users.remove(user_id);
        }
        info!("Removed remote user: {}", user_id);
    }

    /// Update remote user settings
    pub fn update_remote_user(
        &self,
        user_id: &str,
        volume: f32,
        pan: f32,
        muted: bool,
        delay_ms: f32,
    ) {
        if let Ok(mut buffers) = self.remote_buffers.write() {
            if let Some(buffer) = buffers.get_mut(user_id) {
                buffer.volume = volume;
                buffer.pan = pan;
                buffer.is_muted = muted;
                buffer.compensation_delay_samples =
                    (delay_ms * self.sample_rate as f32 / 1000.0) as usize;
            }
        }
        if let Ok(mut state) = self.processing_state.write() {
            if let Some(settings) = state.remote_users.get_mut(user_id) {
                settings.volume = volume;
                settings.pan = pan;
                settings.is_muted = muted;
                settings.compensation_delay_ms = delay_ms;
            }
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn sync_remote_track(
        &self,
        user_id: &str,
        browser_track_id: &str,
        bridge_track_id: u8,
        track_name: &str,
        volume: f32,
        pan: f32,
        muted: bool,
        solo: bool,
    ) {
        let key = RemoteTrackKey {
            user_id: user_id.to_string(),
            bridge_track_id,
        };

        if let Ok(mut buffers) = self.remote_track_buffers.write() {
            buffers.entry(key.clone()).or_insert_with(|| {
                let ring_buffer = HeapRb::<f32>::new(REMOTE_RING_BUFFER_SIZE);
                let (producer, consumer) = ring_buffer.split();

                RemoteTrackBuffer {
                    producer: Arc::new(std::sync::Mutex::new(producer)),
                    consumer: Arc::new(std::sync::Mutex::new(consumer)),
                    volume,
                    pan,
                    is_muted: muted,
                    is_solo: solo,
                    compensation_delay_samples: 0,
                    track_name: track_name.to_string(),
                    browser_track_id: browser_track_id.to_string(),
                }
            });

            if let Some(buffer) = buffers.get_mut(&key) {
                buffer.volume = volume;
                buffer.pan = pan;
                buffer.is_muted = muted;
                buffer.is_solo = solo;
                buffer.track_name = track_name.to_string();
                buffer.browser_track_id = browser_track_id.to_string();
            }
        }
    }

    pub fn remove_remote_track(&self, user_id: &str, bridge_track_id: u8) {
        if let Ok(mut buffers) = self.remote_track_buffers.write() {
            buffers.remove(&RemoteTrackKey {
                user_id: user_id.to_string(),
                bridge_track_id,
            });
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn update_remote_track(
        &self,
        user_id: &str,
        bridge_track_id: u8,
        volume: f32,
        pan: f32,
        muted: bool,
        solo: bool,
        delay_ms: f32,
    ) {
        if let Ok(mut buffers) = self.remote_track_buffers.write() {
            if let Some(buffer) = buffers.get_mut(&RemoteTrackKey {
                user_id: user_id.to_string(),
                bridge_track_id,
            }) {
                buffer.volume = volume;
                buffer.pan = pan;
                buffer.is_muted = muted;
                buffer.is_solo = solo;
                buffer.compensation_delay_samples =
                    (delay_ms * self.sample_rate as f32 / 1000.0) as usize;
            }
        }
    }

    /// Push audio data for a remote user
    pub fn push_remote_audio(&self, user_id: &str, samples: &[f32]) {
        if let Ok(buffers) = self.remote_buffers.read() {
            if let Some(buffer) = buffers.get(user_id) {
                if let Ok(mut prod) = buffer.producer.try_lock() {
                    for &sample in samples {
                        let _ = prod.try_push(sample);
                    }
                }
            }
        }
    }

    pub fn push_remote_track_audio(&self, user_id: &str, bridge_track_id: u8, samples: &[f32]) {
        let key = RemoteTrackKey {
            user_id: user_id.to_string(),
            bridge_track_id,
        };

        if let Ok(mut buffers) = self.remote_track_buffers.write() {
            let buffer = buffers.entry(key).or_insert_with(|| {
                let ring_buffer = HeapRb::<f32>::new(REMOTE_RING_BUFFER_SIZE);
                let (producer, consumer) = ring_buffer.split();

                RemoteTrackBuffer {
                    producer: Arc::new(std::sync::Mutex::new(producer)),
                    consumer: Arc::new(std::sync::Mutex::new(consumer)),
                    volume: 1.0,
                    pan: 0.0,
                    is_muted: false,
                    is_solo: false,
                    compensation_delay_samples: 0,
                    track_name: format!("Track {}", bridge_track_id),
                    browser_track_id: format!("bridge-{}", bridge_track_id),
                }
            });

            if let Ok(mut prod) = buffer.producer.try_lock() {
                for &sample in samples {
                    let _ = prod.try_push(sample);
                }
            }
        }
    }

    pub fn get_local_track_descriptors(&self) -> Vec<LocalTrackDescriptor> {
        if let Ok(state) = self.processing_state.try_read() {
            return state
                .local_tracks
                .iter()
                .map(|(browser_track_id, track)| LocalTrackDescriptor {
                    browser_track_id: browser_track_id.clone(),
                    bridge_track_id: track.bridge_track_id,
                    track_name: track.track_name.clone(),
                })
                .collect();
        }

        Vec::new()
    }

    pub fn get_local_track_network_audio(
        &self,
        browser_track_id: &str,
        max_samples: usize,
    ) -> Vec<f32> {
        if let Ok(local_track_io) = self.local_track_io.read() {
            if let Some(track_io) = local_track_io.get(browser_track_id) {
                if let Ok(mut consumer) = track_io.network_consumer.try_lock() {
                    let available = consumer.occupied_len();
                    let to_read = available.min(max_samples);
                    if to_read > 0 {
                        let mut buffer = vec![0.0f32; to_read];
                        let read = consumer.pop_slice(&mut buffer);
                        buffer.truncate(read);
                        return buffer;
                    }
                }
            }
        }

        Vec::new()
    }

    pub fn get_local_track_browser_audio(
        &self,
        browser_track_id: &str,
        max_samples: usize,
    ) -> Vec<f32> {
        if let Ok(local_track_io) = self.local_track_io.read() {
            if let Some(track_io) = local_track_io.get(browser_track_id) {
                if let Ok(mut consumer) = track_io.browser_consumer.try_lock() {
                    let available = consumer.occupied_len();
                    let to_read = available.min(max_samples);
                    if to_read > 0 {
                        let mut buffer = vec![0.0f32; to_read];
                        let read = consumer.pop_slice(&mut buffer);
                        buffer.truncate(read);
                        return buffer;
                    }
                }
            }
        }

        Vec::new()
    }

    /// Get raw audio samples for streaming to browser
    pub fn get_browser_stream_audio(&self, max_samples: usize) -> Vec<f32> {
        if let Some(ref consumer) = self.browser_stream_consumer {
            if let Ok(mut cons) = consumer.try_lock() {
                let available = cons.occupied_len();
                let to_read = available.min(max_samples);
                if to_read > 0 {
                    let mut buffer = vec![0.0f32; to_read];
                    let read = cons.pop_slice(&mut buffer);
                    buffer.truncate(read);
                    return buffer;
                }
            }
        }
        Vec::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty_consumer() -> Arc<std::sync::Mutex<HeapCons<f32>>> {
        let ring = HeapRb::<f32>::new(32);
        let (_producer, consumer) = ring.split();
        Arc::new(std::sync::Mutex::new(consumer))
    }

    #[test]
    fn remote_track_mute_keeps_other_tracks_from_same_peer_audible() {
        let engine = AudioEngine::new().expect("create audio engine for remote track mix test");

        engine.sync_remote_track("peer-a", "guitar-track", 1, "Guitar", 1.0, 1.0, true, false);
        engine.sync_remote_track("peer-a", "vocal-track", 2, "Vocal", 1.0, -1.0, false, false);

        engine.push_remote_track_audio("peer-a", 1, &[0.9, 0.9, 0.9, 0.9]);
        engine.push_remote_track_audio("peer-a", 2, &[0.25, 0.25, 0.25, 0.25]);

        let local_consumer = empty_consumer();
        let backing_consumer = empty_consumer();
        let mut output = vec![0.0f32; 4];

        AudioEngine::process_output_f32(
            &mut output,
            &local_consumer,
            &engine.remote_buffers,
            &engine.remote_track_buffers,
            &backing_consumer,
            &engine.levels,
            &engine.processing_state,
        );

        for frame in output.chunks_exact(2) {
            assert!(frame[0] > 0.20, "expected vocal track on the left channel");
            assert!(
                frame[1].abs() < 0.0001,
                "expected muted guitar and hard-left vocal to leave right channel silent"
            );
        }
    }
}
