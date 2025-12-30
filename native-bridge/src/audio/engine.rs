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
use crate::mixing::TrackState;
use anyhow::Result;
use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::SampleFormat;
use ringbuf::{
    traits::{Consumer, Producer, Split},
    HeapRb, HeapCons, HeapProd,
};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicUsize, Ordering};
use std::sync::Arc;
use std::sync::RwLock;
use tracing::{debug, error, info, warn};

/// Debug frame counter for periodic logging
static INPUT_FRAME_COUNT: AtomicUsize = AtomicUsize::new(0);
static OUTPUT_FRAME_COUNT: AtomicUsize = AtomicUsize::new(0);

/// Ring buffer size for local audio (samples, stereo)
const LOCAL_RING_BUFFER_SIZE: usize = 8192;

/// Ring buffer size for remote user audio
const REMOTE_RING_BUFFER_SIZE: usize = 16384;

/// Ring buffer size for backing track
const BACKING_RING_BUFFER_SIZE: usize = 32768;

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

/// Real-time audio levels
#[derive(Debug, Clone, Default)]
pub struct AudioLevels {
    pub input_level: f32,
    pub output_level: f32,
    pub input_peak: f32,
    pub output_peak: f32,
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
}

impl AudioEngine {
    pub fn new() -> Result<Self> {
        let config = EngineConfig::default();

        let processing_state = AudioProcessingState {
            effects_chain: EffectsChain::new(),
            track_state: TrackState::default(),
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
            processing_state: Arc::new(RwLock::new(processing_state)),
            is_monitoring: Arc::new(AtomicBool::new(true)),
            monitoring_volume: Arc::new(AtomicU32::new(1.0_f32.to_bits())),
            levels: Arc::new(RwLock::new(AudioLevels::default())),
            effects_metering: Arc::new(RwLock::new(EffectsMetering::default())),
            is_running: Arc::new(AtomicBool::new(false)),
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

    // === Track State ===

    pub fn update_track_state(&self, state: TrackState) {
        if let Ok(mut proc_state) = self.processing_state.write() {
            proc_state.track_state = state;
        }
    }

    pub fn update_effects(&self, effects: crate::effects::EffectsSettings) {
        if let Ok(mut state) = self.processing_state.write() {
            state.effects_chain.update_settings(effects);
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

    pub fn update_remote_user(&self, user_id: &str, volume: f32, muted: bool, delay_ms: f32) {
        if let Ok(mut buffers) = self.remote_buffers.write() {
            if let Some(buffer) = buffers.get_mut(user_id) {
                buffer.volume = volume;
                buffer.is_muted = muted;
                // Convert delay_ms to samples
                let sample_rate = self.config.sample_rate as u32;
                buffer.compensation_delay_samples = (delay_ms * sample_rate as f32 / 1000.0) as usize;
            }
        }
        if let Ok(mut state) = self.processing_state.write() {
            if let Some(settings) = state.remote_users.get_mut(user_id) {
                settings.volume = volume;
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
            input_device.info.name, output_device.info.name, sample_rate, latency_ms * 2.0
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
        let levels = self.levels.clone();
        let is_monitoring = self.is_monitoring.clone();
        let monitoring_volume = self.monitoring_volume.clone();
        let processing_state = self.processing_state.clone();
        let effects_metering = self.effects_metering.clone();
        let input_channels = config.channels as usize;

        let stream = match sample_format {
            SampleFormat::F32 => device.build_input_stream(
                config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    Self::process_input(
                        data,
                        input_channels,
                        &producer,
                        &levels,
                        &is_monitoring,
                        &monitoring_volume,
                        &processing_state,
                        &effects_metering,
                    );
                },
                |err| error!("Input stream error: {}", err),
                None,
            )?,
            SampleFormat::I32 => {
                device.build_input_stream(
                    config,
                    move |data: &[i32], _: &cpal::InputCallbackInfo| {
                        let float_data: Vec<f32> =
                            data.iter().map(|&s| s as f32 / i32::MAX as f32).collect();
                        Self::process_input(
                            &float_data,
                            input_channels,
                            &producer,
                            &levels,
                            &is_monitoring,
                            &monitoring_volume,
                            &processing_state,
                            &effects_metering,
                        );
                    },
                    |err| error!("Input stream error: {}", err),
                    None,
                )?
            }
            SampleFormat::I16 => {
                device.build_input_stream(
                    config,
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        let float_data: Vec<f32> =
                            data.iter().map(|&s| s as f32 / i16::MAX as f32).collect();
                        Self::process_input(
                            &float_data,
                            input_channels,
                            &producer,
                            &levels,
                            &is_monitoring,
                            &monitoring_volume,
                            &processing_state,
                            &effects_metering,
                        );
                    },
                    |err| error!("Input stream error: {}", err),
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
                |err| error!("Output stream error: {}", err),
                None,
            )?,
            SampleFormat::I32 => {
                device.build_output_stream(
                    config,
                    move |data: &mut [i32], _: &cpal::OutputCallbackInfo| {
                        Self::process_output_i32(
                            data,
                            &local_consumer,
                            &remote_buffers,
                            &backing_consumer,
                            &levels,
                            &processing_state,
                        );
                    },
                    |err| error!("Output stream error: {}", err),
                    None,
                )?
            }
            SampleFormat::I16 => {
                device.build_output_stream(
                    config,
                    move |data: &mut [i16], _: &cpal::OutputCallbackInfo| {
                        Self::process_output_i16(
                            data,
                            &local_consumer,
                            &remote_buffers,
                            &backing_consumer,
                            &levels,
                            &processing_state,
                        );
                    },
                    |err| error!("Output stream error: {}", err),
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
    fn process_input(
        data: &[f32],
        input_channels: usize,
        producer: &Arc<std::sync::Mutex<HeapProd<f32>>>,
        levels: &Arc<RwLock<AudioLevels>>,
        is_monitoring: &Arc<AtomicBool>,
        monitoring_volume: &Arc<AtomicU32>,
        processing_state: &Arc<RwLock<AudioProcessingState>>,
        effects_metering: &Arc<RwLock<EffectsMetering>>,
    ) {
        let frame_num = INPUT_FRAME_COUNT.fetch_add(1, Ordering::Relaxed);
        let should_log = frame_num % 500 == 0; // Log every 500 frames (~every 0.67s at 64 samples/48kHz)

        // Get channel config
        let (left_ch, right_ch, is_stereo) = if let Ok(state) = processing_state.try_read() {
            let left = state.channel_config.left_channel as usize;
            let right = state.channel_config.right_channel.unwrap_or(1) as usize;
            let stereo = state.channel_config.channel_count == 2;
            (left, right, stereo)
        } else {
            (0, 1, true)
        };

        if should_log {
            info!("[INPUT] Frame {} | data_len={} input_ch={} left_ch={} right_ch={} stereo={}",
                  frame_num, data.len(), input_channels, left_ch, right_ch, is_stereo);
        }

        // Check if we're getting any signal from raw input
        let raw_peak: f32 = data.iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
        if should_log {
            info!("[INPUT] Raw input peak: {:.6}", raw_peak);
        }

        // Extract selected channels to stereo
        let mut stereo_buffer: Vec<f32> = Vec::with_capacity(data.len() / input_channels * 2);
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

        // Calculate input level
        let level = stereo_buffer.iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
        if let Ok(mut lvl) = levels.try_write() {
            lvl.input_level = level;
            lvl.input_peak = lvl.input_peak.max(level);
        }

        if should_log {
            info!("[INPUT] Extracted stereo peak: {:.6} | buffer_size={}", level, stereo_buffer.len());
        }

        let monitoring_enabled = is_monitoring.load(Ordering::Relaxed);
        let mon_vol = f32::from_bits(monitoring_volume.load(Ordering::Relaxed));

        if should_log {
            info!("[INPUT] Monitoring: enabled={} volume={:.2}", monitoring_enabled, mon_vol);
        }

        // If monitoring enabled, process and send to output
        if monitoring_enabled {
            let (gain, volume) = if let Ok(mut state) = processing_state.try_write() {
                // Apply input gain
                let gain = state.track_state.input_gain_linear();
                for sample in stereo_buffer.iter_mut() {
                    *sample *= gain;
                }

                // Process through effects chain
                state.effects_chain.process(&mut stereo_buffer);

                // Get effects metering
                let metering = state.effects_chain.get_metering();
                if let Ok(mut em) = effects_metering.try_write() {
                    em.noise_gate_open = metering.noise_gate_open;
                    em.compressor_reduction = metering.compressor_reduction;
                    em.limiter_reduction = metering.limiter_reduction;
                }

                // Apply track volume and monitoring volume
                let volume = state.track_state.volume;
                for sample in stereo_buffer.iter_mut() {
                    *sample *= volume * mon_vol;
                }
                (gain, volume)
            } else {
                if should_log {
                    warn!("[INPUT] Could not acquire processing state lock!");
                }
                (1.0, 1.0)
            };

            // Calculate level after processing
            let processed_peak: f32 = stereo_buffer.iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
            if should_log {
                info!("[INPUT] After processing: gain={:.2} vol={:.2} peak={:.6}", gain, volume, processed_peak);
            }

            // Push to ring buffer
            let mut pushed = 0;
            if let Ok(mut prod) = producer.try_lock() {
                for sample in stereo_buffer.iter() {
                    if prod.try_push(*sample).is_ok() {
                        pushed += 1;
                    }
                }
            } else {
                if should_log {
                    warn!("[INPUT] Could not acquire producer lock!");
                }
            }

            if should_log {
                info!("[INPUT] Pushed {} samples to ring buffer", pushed);
            }
        } else if should_log {
            info!("[INPUT] Monitoring DISABLED - not sending to output");
        }
    }

    /// Process output audio (mix all sources)
    fn process_output_f32(
        data: &mut [f32],
        local_consumer: &Arc<std::sync::Mutex<HeapCons<f32>>>,
        remote_buffers: &Arc<RwLock<HashMap<String, RemoteUserBuffer>>>,
        backing_consumer: &Arc<std::sync::Mutex<HeapCons<f32>>>,
        levels: &Arc<RwLock<AudioLevels>>,
        processing_state: &Arc<RwLock<AudioProcessingState>>,
    ) {
        let frame_num = OUTPUT_FRAME_COUNT.fetch_add(1, Ordering::Relaxed);
        let should_log = frame_num % 500 == 0;

        if should_log {
            info!("[OUTPUT] Frame {} | output_buffer_len={}", frame_num, data.len());
        }

        // Clear output
        for sample in data.iter_mut() {
            *sample = 0.0;
        }

        // Mix local audio
        let mut local_samples = 0;
        let mut local_peak = 0.0_f32;
        if let Ok(mut cons) = local_consumer.try_lock() {
            for sample in data.iter_mut() {
                let s = cons.try_pop().unwrap_or(0.0);
                if s != 0.0 {
                    local_samples += 1;
                    local_peak = local_peak.max(s.abs());
                }
                *sample += s;
            }
        } else if should_log {
            warn!("[OUTPUT] Could not acquire local_consumer lock!");
        }

        if should_log {
            info!("[OUTPUT] Local audio: non_zero_samples={} peak={:.6}", local_samples, local_peak);
        }

        // Mix remote user audio
        let mut remote_levels_vec = Vec::new();
        if let Ok(buffers) = remote_buffers.try_read() {
            for (user_id, buffer) in buffers.iter() {
                if buffer.is_muted {
                    continue;
                }

                if let Ok(mut cons) = buffer.consumer.try_lock() {
                    let mut user_level = 0.0_f32;
                    for sample in data.iter_mut() {
                        let s = cons.try_pop().unwrap_or(0.0) * buffer.volume;
                        user_level = user_level.max(s.abs());
                        *sample += s;
                    }
                    remote_levels_vec.push((user_id.clone(), user_level));
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

        if should_log {
            info!("[OUTPUT] Master volume: {:.2}", master_vol);
        }

        // Soft clip to prevent harsh clipping
        for sample in data.iter_mut() {
            *sample = sample.tanh();
        }

        // Calculate output level
        let level = data.iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
        if let Ok(mut lvl) = levels.try_write() {
            lvl.output_level = level;
            lvl.output_peak = lvl.output_peak.max(level);
            lvl.remote_levels = remote_levels_vec;
            lvl.backing_level = backing_level;
        }

        if should_log {
            info!("[OUTPUT] Final output peak: {:.6}", level);
            // Also log first few samples to verify they're not all zero
            let first_samples: Vec<String> = data.iter().take(8).map(|s| format!("{:.6}", s)).collect();
            info!("[OUTPUT] First 8 samples: [{}]", first_samples.join(", "));
        }
    }

    fn process_output_i32(
        data: &mut [i32],
        local_consumer: &Arc<std::sync::Mutex<HeapCons<f32>>>,
        remote_buffers: &Arc<RwLock<HashMap<String, RemoteUserBuffer>>>,
        backing_consumer: &Arc<std::sync::Mutex<HeapCons<f32>>>,
        levels: &Arc<RwLock<AudioLevels>>,
        processing_state: &Arc<RwLock<AudioProcessingState>>,
    ) {
        // Process to float buffer first
        let mut float_buffer = vec![0.0_f32; data.len()];
        Self::process_output_f32(
            &mut float_buffer,
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

    fn process_output_i16(
        data: &mut [i16],
        local_consumer: &Arc<std::sync::Mutex<HeapCons<f32>>>,
        remote_buffers: &Arc<RwLock<HashMap<String, RemoteUserBuffer>>>,
        backing_consumer: &Arc<std::sync::Mutex<HeapCons<f32>>>,
        levels: &Arc<RwLock<AudioLevels>>,
        processing_state: &Arc<RwLock<AudioProcessingState>>,
    ) {
        let mut float_buffer = vec![0.0_f32; data.len()];
        Self::process_output_f32(
            &mut float_buffer,
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

        let stream_input_config = cpal::StreamConfig {
            channels: input_config.channels(),
            sample_rate: cpal::SampleRate(sample_rate),
            buffer_size: cpal::BufferSize::Fixed(buffer_size_samples),
        };

        let stream_output_config = cpal::StreamConfig {
            channels: output_config.channels().min(2),
            sample_rate: cpal::SampleRate(sample_rate),
            buffer_size: cpal::BufferSize::Fixed(buffer_size_samples),
        };

        let input_channels = stream_input_config.channels as usize;
        let input_sample_format = input_config.sample_format();
        let output_sample_format = output_config.sample_format();

        info!(
            "ASIO config - input: {:?}, output: {:?}",
            input_sample_format, output_sample_format
        );

        // Clone shared state for callbacks
        let producer = self.local_producer.clone().unwrap();
        let levels_in = self.levels.clone();
        let is_monitoring = self.is_monitoring.clone();
        let monitoring_volume = self.monitoring_volume.clone();
        let processing_state_in = self.processing_state.clone();
        let effects_metering = self.effects_metering.clone();

        // Build input stream
        let input_stream = match input_sample_format {
            SampleFormat::F32 => device.build_input_stream(
                &stream_input_config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    Self::process_input(
                        data,
                        input_channels,
                        &producer,
                        &levels_in,
                        &is_monitoring,
                        &monitoring_volume,
                        &processing_state_in,
                        &effects_metering,
                    );
                },
                |err| error!("ASIO input error: {}", err),
                None,
            )?,
            SampleFormat::I32 => {
                let producer = self.local_producer.clone().unwrap();
                let levels_in = self.levels.clone();
                let is_monitoring = self.is_monitoring.clone();
                let monitoring_volume = self.monitoring_volume.clone();
                let processing_state_in = self.processing_state.clone();
                let effects_metering = self.effects_metering.clone();

                device.build_input_stream(
                    &stream_input_config,
                    move |data: &[i32], _: &cpal::InputCallbackInfo| {
                        let float_data: Vec<f32> =
                            data.iter().map(|&s| s as f32 / i32::MAX as f32).collect();
                        Self::process_input(
                            &float_data,
                            input_channels,
                            &producer,
                            &levels_in,
                            &is_monitoring,
                            &monitoring_volume,
                            &processing_state_in,
                            &effects_metering,
                        );
                    },
                    |err| error!("ASIO input error: {}", err),
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
            SampleFormat::F32 => device.build_output_stream(
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
                |err| error!("ASIO output error: {}", err),
                None,
            )?,
            SampleFormat::I32 => {
                let local_consumer = self.local_consumer.clone().unwrap();
                let remote_buffers = self.remote_buffers.clone();
                let backing_consumer = self.backing_consumer.clone().unwrap();
                let levels_out = self.levels.clone();
                let processing_state_out = self.processing_state.clone();

                device.build_output_stream(
                    &stream_output_config,
                    move |data: &mut [i32], _: &cpal::OutputCallbackInfo| {
                        Self::process_output_i32(
                            data,
                            &local_consumer,
                            &remote_buffers,
                            &backing_consumer,
                            &levels_out,
                            &processing_state_out,
                        );
                    },
                    |err| error!("ASIO output error: {}", err),
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
}
