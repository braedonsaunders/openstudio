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
            buffer_size: BufferSize::Samples128,
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
    pub limiter_reduction: f32,
}

/// Backing track state
#[derive(Debug, Clone, Default)]
pub struct BackingTrackState {
    pub is_loaded: bool,
    pub is_playing: bool,
    pub current_time: f32,
    pub duration: f32,
    pub volume: f32,
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

/// Shared state for audio processing
struct AudioProcessingState {
    /// Effects chain for local track
    effects_chain: EffectsChain,
    /// Track state for local track
    track_state: TrackState,
    /// Channel configuration
    channel_config: ChannelConfig,
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
            effects_chain: EffectsChain::new(),
            track_state: TrackState::new(), // Use new() not default() - default() sets volume to 0!
            channel_config: ChannelConfig::default(),
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
        info!(
            "Input device set: {}",
            self.input_device.as_ref().unwrap().info.name
        );

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
        info!(
            "Output device set: {}",
            self.output_device.as_ref().unwrap().info.name
        );

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

        self.config.channel_config = config.clone();
        if let Ok(mut state) = self.processing_state.write() {
            state.channel_config = config;
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
            state.effects_chain.set_sample_rate(rate as u32);
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

    /// Update track state with partial update - only fields that are Some will be changed
    pub fn update_track_state(&self, partial: PartialTrackState) {
        // CRITICAL: Sync atomic is_monitoring FIRST - this is read in audio callback
        // The atomic never fails, ensuring monitoring state is always current
        if let Some(monitoring) = partial.monitoring_enabled {
            self.is_monitoring.store(monitoring, Ordering::SeqCst);
        }
        // Then update the full state in RwLock (for state queries)
        if let Ok(mut proc_state) = self.processing_state.write() {
            proc_state.track_state.merge(&partial);
        }
    }

    pub fn update_effects(&self, effects: crate::effects::EffectsSettings) {
        if let Ok(mut state) = self.processing_state.write() {
            state.effects_chain.update_settings(effects);
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
            state
                .effects_chain
                .set_room_context(key, scale, bpm, time_sig_num, time_sig_denom);
        }
    }

    pub fn set_master_volume(&self, volume: f32) {
        if let Ok(mut state) = self.processing_state.write() {
            state.master_volume = volume;
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

    pub fn set_backing_track_state(&self, is_playing: bool, current_time: f32) {
        if let Ok(mut state) = self.processing_state.write() {
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

        let input_device = self.input_device.as_ref().unwrap();
        let output_device = self.output_device.as_ref().unwrap();

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
        let producer = self.local_producer.clone().unwrap();
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
        let local_consumer = self.local_consumer.clone().unwrap();
        let remote_buffers = self.remote_buffers.clone();
        let backing_consumer = self.backing_consumer.clone().unwrap();
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
    fn process_input(
        data: &[f32],
        input_channels: usize,
        stereo_buffer: &mut Vec<f32>,
        producer: &Arc<std::sync::Mutex<HeapProd<f32>>>,
        browser_stream_producer: Option<&Arc<std::sync::Mutex<HeapProd<f32>>>>,
        levels: &Arc<RwLock<AudioLevels>>,
        is_monitoring: &Arc<AtomicBool>,
        monitoring_volume: &Arc<AtomicU32>,
        processing_state: &Arc<RwLock<AudioProcessingState>>,
        _effects_metering: &Arc<RwLock<EffectsMetering>>,
        overflow_count: &Arc<AtomicU64>,
        overflow_samples: &Arc<AtomicU64>,
    ) {
        // NO LOGGING IN THIS FUNCTION - logging allocates memory which kills ASIO

        // Get channel config
        let (left_ch, right_ch, is_stereo) = if let Ok(state) = processing_state.try_read() {
            let left = state.channel_config.left_channel as usize;
            let right = state.channel_config.right_channel.unwrap_or(1) as usize;
            let stereo = state.channel_config.channel_count == 2;
            (left, right, stereo)
        } else {
            (0, 1, true)
        };

        // Clear and reuse the pre-allocated stereo buffer (no allocation!)
        stereo_buffer.clear();

        // Extract selected channels to stereo
        for frame in data.chunks(input_channels) {
            let left_sample = frame.get(left_ch).copied().unwrap_or(0.0);
            let right_sample = if is_stereo {
                frame.get(right_ch).copied().unwrap_or(left_sample)
            } else {
                left_sample
            };
            stereo_buffer.push(left_sample);
            stereo_buffer.push(right_sample);
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

        // Stream audio to browser (browser applies effects via Web Audio)
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

        // Get monitoring state - use atomic flag for monitoring_enabled (never fails!)
        let mon_vol = f32::from_bits(monitoring_volume.load(Ordering::Relaxed));
        let monitoring_enabled = is_monitoring.load(Ordering::Relaxed);
        let is_muted = if let Ok(state) = processing_state.try_read() {
            state.track_state.is_muted
        } else {
            false // Default to not muted - let audio through
        };

        // WET monitoring: apply effects chain for local monitoring
        let should_monitor = monitoring_enabled && !is_muted;

        if should_monitor {
            if let Ok(mut state) = processing_state.try_write() {
                let gain = state.track_state.input_gain_linear();
                let volume = state.track_state.volume;
                let (pan_left, pan_right) = state.track_state.pan_gains();

                // Apply input gain first
                for sample in stereo_buffer.iter_mut() {
                    *sample *= gain;
                }

                // Process through effects chain (if any effects are enabled)
                state.effects_chain.process(stereo_buffer);

                // Apply volume, pan, and monitoring volume to stereo pairs
                for chunk in stereo_buffer.chunks_exact_mut(2) {
                    let base_gain = volume * mon_vol;
                    chunk[0] *= base_gain * pan_left;
                    chunk[1] *= base_gain * pan_right;
                }
            }

            // Push to output ring buffer
            if let Ok(mut prod) = producer.try_lock() {
                for sample in stereo_buffer.iter() {
                    let _ = prod.try_push(*sample);
                }
            }
        }
    }

    /// Process output audio (mix all sources)
    /// NO LOGGING IN THIS FUNCTION - logging allocates memory which kills ASIO
    fn process_output_f32(
        data: &mut [f32],
        local_consumer: &Arc<std::sync::Mutex<HeapCons<f32>>>,
        remote_buffers: &Arc<RwLock<HashMap<String, RemoteUserBuffer>>>,
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

        // Mix backing track
        let backing_volume = processing_state
            .try_read()
            .map(|s| {
                if s.backing_track.is_playing {
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

        // Apply master volume
        let master_vol = processing_state
            .try_read()
            .map(|s| s.master_volume)
            .unwrap_or(1.0);
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
    fn process_output_i32(
        data: &mut [i32],
        float_buffer: &mut Vec<f32>,
        local_consumer: &Arc<std::sync::Mutex<HeapCons<f32>>>,
        remote_buffers: &Arc<RwLock<HashMap<String, RemoteUserBuffer>>>,
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
    fn process_output_i16(
        data: &mut [i16],
        float_buffer: &mut Vec<f32>,
        local_consumer: &Arc<std::sync::Mutex<HeapCons<f32>>>,
        remote_buffers: &Arc<RwLock<HashMap<String, RemoteUserBuffer>>>,
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
        let producer = self.local_producer.clone().unwrap();
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
        let local_consumer = self.local_consumer.clone().unwrap();
        let remote_buffers = self.remote_buffers.clone();
        let backing_consumer = self.backing_consumer.clone().unwrap();
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
            state.effects_chain.set_sample_rate(sample_rate);
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
            .unwrap()
            .as_millis() as u64;
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
            .unwrap()
            .as_millis() as u64;
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
