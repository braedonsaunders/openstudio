//! Audio engine - manages capture, playback, and processing

use super::{AudioDevice, BufferSize, ChannelConfig, DeviceInfo, SampleRate};
use crate::effects::EffectsChain;
use crate::mixing::TrackState;
use anyhow::Result;
use cpal::traits::{DeviceTrait, StreamTrait};
use ringbuf::{HeapRb, HeapProducer, HeapConsumer};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};

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
}

/// Latency information
#[derive(Debug, Clone, Default)]
pub struct LatencyInfo {
    pub input_latency_ms: f32,
    pub output_latency_ms: f32,
    pub total_latency_ms: f32,
    pub buffer_size_samples: u32,
}

/// The main audio engine
pub struct AudioEngine {
    config: EngineConfig,

    // Devices
    input_device: Option<AudioDevice>,
    output_device: Option<AudioDevice>,

    // Streams (managed by CPAL)
    input_stream: Option<cpal::Stream>,
    output_stream: Option<cpal::Stream>,

    // Ring buffers for inter-thread audio
    // Browser -> Native (for backing tracks, remote audio)
    from_browser_producer: Option<HeapProducer<f32>>,
    from_browser_consumer: Option<HeapConsumer<f32>>,

    // Native -> Browser (captured audio after effects)
    to_browser_producer: Option<HeapProducer<f32>>,
    to_browser_consumer: Option<HeapConsumer<f32>>,

    // Effects chain
    effects_chain: Arc<RwLock<EffectsChain>>,

    // Track state
    track_state: Arc<RwLock<TrackState>>,

    // Monitoring
    is_monitoring: Arc<AtomicBool>,
    monitoring_volume: Arc<AtomicU32>, // f32 as bits

    // Levels (updated from audio thread)
    levels: Arc<RwLock<AudioLevels>>,

    // Running state
    is_running: Arc<AtomicBool>,
}

impl AudioEngine {
    pub async fn new() -> Result<Self> {
        let config = EngineConfig::default();

        // Create ring buffers (enough for ~100ms at 48kHz stereo)
        let buffer_size = 48000 / 10 * 2; // 100ms stereo
        let (from_browser_producer, from_browser_consumer) = HeapRb::<f32>::new(buffer_size).split();
        let (to_browser_producer, to_browser_consumer) = HeapRb::<f32>::new(buffer_size).split();

        let engine = Self {
            config,
            input_device: None,
            output_device: None,
            input_stream: None,
            output_stream: None,
            from_browser_producer: Some(from_browser_producer),
            from_browser_consumer: Some(from_browser_consumer),
            to_browser_producer: Some(to_browser_producer),
            to_browser_consumer: Some(to_browser_consumer),
            effects_chain: Arc::new(RwLock::new(EffectsChain::new())),
            track_state: Arc::new(RwLock::new(TrackState::default())),
            is_monitoring: Arc::new(AtomicBool::new(false)),
            monitoring_volume: Arc::new(AtomicU32::new(0.8_f32.to_bits())),
            levels: Arc::new(RwLock::new(AudioLevels::default())),
            is_running: Arc::new(AtomicBool::new(false)),
        };

        Ok(engine)
    }

    /// Get list of available input devices
    pub fn get_input_devices(&self) -> Result<Vec<DeviceInfo>> {
        Ok(AudioDevice::enumerate_inputs()?)
    }

    /// Get list of available output devices
    pub fn get_output_devices(&self) -> Result<Vec<DeviceInfo>> {
        Ok(AudioDevice::enumerate_outputs()?)
    }

    /// Set input device
    pub async fn set_input_device(&mut self, device_id: &str) -> Result<()> {
        let was_running = self.is_running.load(Ordering::SeqCst);

        if was_running {
            self.stop().await?;
        }

        self.input_device = Some(AudioDevice::get_by_id(device_id)?);
        self.config.input_device_id = Some(device_id.to_string());

        info!("Input device set: {}", self.input_device.as_ref().unwrap().info.name);

        if was_running {
            self.start().await?;
        }

        Ok(())
    }

    /// Set output device
    pub async fn set_output_device(&mut self, device_id: &str) -> Result<()> {
        let was_running = self.is_running.load(Ordering::SeqCst);

        if was_running {
            self.stop().await?;
        }

        self.output_device = Some(AudioDevice::get_by_id(device_id)?);
        self.config.output_device_id = Some(device_id.to_string());

        info!("Output device set: {}", self.output_device.as_ref().unwrap().info.name);

        if was_running {
            self.start().await?;
        }

        Ok(())
    }

    /// Set channel configuration
    pub async fn set_channel_config(&mut self, config: ChannelConfig) -> Result<()> {
        self.config.channel_config = config;
        // Restart streams if running to apply new channel config
        if self.is_running.load(Ordering::SeqCst) {
            self.stop().await?;
            self.start().await?;
        }
        Ok(())
    }

    /// Set buffer size
    pub async fn set_buffer_size(&mut self, size: BufferSize) -> Result<()> {
        self.config.buffer_size = size;
        if self.is_running.load(Ordering::SeqCst) {
            self.stop().await?;
            self.start().await?;
        }
        Ok(())
    }

    /// Set sample rate
    pub async fn set_sample_rate(&mut self, rate: SampleRate) -> Result<()> {
        self.config.sample_rate = rate;
        if self.is_running.load(Ordering::SeqCst) {
            self.stop().await?;
            self.start().await?;
        }
        Ok(())
    }

    /// Enable/disable direct monitoring
    pub fn set_monitoring(&self, enabled: bool) {
        self.is_monitoring.store(enabled, Ordering::SeqCst);
    }

    /// Set monitoring volume (0.0 - 1.0)
    pub fn set_monitoring_volume(&self, volume: f32) {
        self.monitoring_volume.store(volume.to_bits(), Ordering::SeqCst);
    }

    /// Update track state (armed, muted, solo, volume)
    pub async fn update_track_state(&self, state: TrackState) {
        let mut track = self.track_state.write().await;
        *track = state;
    }

    /// Update effects chain
    pub async fn update_effects(&self, effects: crate::effects::EffectsSettings) {
        let mut chain = self.effects_chain.write().await;
        chain.update_settings(effects);
    }

    /// Get current audio levels
    pub async fn get_levels(&self) -> AudioLevels {
        self.levels.read().await.clone()
    }

    /// Get latency information
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

    /// Get consumer for reading captured audio (to send to browser)
    pub fn get_capture_consumer(&mut self) -> Option<HeapConsumer<f32>> {
        self.to_browser_consumer.take()
    }

    /// Get producer for writing playback audio (from browser)
    pub fn get_playback_producer(&mut self) -> Option<HeapProducer<f32>> {
        self.from_browser_producer.take()
    }

    /// Start audio streams
    pub async fn start(&mut self) -> Result<()> {
        if self.is_running.load(Ordering::SeqCst) {
            return Ok(());
        }

        // Use default devices if not set
        if self.input_device.is_none() {
            self.input_device = Some(AudioDevice::default_input()?);
        }
        if self.output_device.is_none() {
            self.output_device = Some(AudioDevice::default_output()?);
        }

        let sample_rate = self.config.sample_rate as u32;
        let buffer_size = self.config.buffer_size as u32;
        let channel_config = self.config.channel_config.clone();

        // Build input stream config
        let input_device = self.input_device.as_ref().unwrap();
        let input_config = cpal::StreamConfig {
            channels: (channel_config.left_channel.max(
                channel_config.right_channel.unwrap_or(0)
            ) + 1) as u16,
            sample_rate: cpal::SampleRate(sample_rate),
            buffer_size: cpal::BufferSize::Fixed(buffer_size),
        };

        // Shared state for input stream
        let to_browser = self.to_browser_producer.take();
        let effects_chain = self.effects_chain.clone();
        let track_state = self.track_state.clone();
        let levels = self.levels.clone();
        let channel_cfg = channel_config.clone();
        let is_monitoring = self.is_monitoring.clone();
        let monitoring_volume = self.monitoring_volume.clone();

        // Create input stream
        let input_stream = input_device.device.build_input_stream(
            &input_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                // Extract selected channels
                let mut samples = Vec::with_capacity(data.len() / input_config.channels as usize * 2);
                let num_channels = input_config.channels as usize;

                for frame in data.chunks(num_channels) {
                    let left = frame.get(channel_cfg.left_channel as usize).copied().unwrap_or(0.0);
                    let right = if channel_cfg.channel_count == 2 {
                        frame.get(channel_cfg.right_channel.unwrap_or(1) as usize).copied().unwrap_or(left)
                    } else {
                        left // Mono: duplicate to both channels
                    };
                    samples.push(left);
                    samples.push(right);
                }

                // TODO: Apply effects chain here
                // let processed = effects_chain.blocking_read().process(&samples);

                // Calculate input level
                let level = samples.iter()
                    .map(|s| s.abs())
                    .fold(0.0_f32, f32::max);

                // Update levels (non-blocking)
                if let Ok(mut lvl) = levels.try_write() {
                    lvl.input_level = level;
                    lvl.input_peak = lvl.input_peak.max(level);
                }

                // Send to browser
                if let Some(ref mut producer) = to_browser.as_ref() {
                    // producer.push_slice(&samples);
                }
            },
            |err| {
                error!("Input stream error: {}", err);
            },
            None,
        )?;

        // Build output stream config
        let output_device = self.output_device.as_ref().unwrap();
        let output_config = cpal::StreamConfig {
            channels: 2,
            sample_rate: cpal::SampleRate(sample_rate),
            buffer_size: cpal::BufferSize::Fixed(buffer_size),
        };

        // Shared state for output stream
        let from_browser = self.from_browser_consumer.take();
        let output_levels = self.levels.clone();

        // Create output stream
        let output_stream = output_device.device.build_output_stream(
            &output_config,
            move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                // Read from browser ring buffer
                // if let Some(ref mut consumer) = from_browser.as_ref() {
                //     consumer.pop_slice(data);
                // }

                // For now, silence
                for sample in data.iter_mut() {
                    *sample = 0.0;
                }

                // Calculate output level
                let level = data.iter()
                    .map(|s| s.abs())
                    .fold(0.0_f32, f32::max);

                if let Ok(mut lvl) = output_levels.try_write() {
                    lvl.output_level = level;
                    lvl.output_peak = lvl.output_peak.max(level);
                }
            },
            |err| {
                error!("Output stream error: {}", err);
            },
            None,
        )?;

        // Start streams
        input_stream.play()?;
        output_stream.play()?;

        self.input_stream = Some(input_stream);
        self.output_stream = Some(output_stream);
        self.is_running.store(true, Ordering::SeqCst);

        let latency = self.get_latency_info();
        info!(
            "🎵 Audio started: {} → {} | Buffer: {} samples ({:.1}ms) @ {}Hz",
            self.input_device.as_ref().unwrap().info.name,
            self.output_device.as_ref().unwrap().info.name,
            latency.buffer_size_samples,
            latency.total_latency_ms,
            sample_rate
        );

        Ok(())
    }

    /// Stop audio streams
    pub async fn stop(&mut self) -> Result<()> {
        self.input_stream = None;
        self.output_stream = None;
        self.is_running.store(false, Ordering::SeqCst);
        info!("Audio stopped");
        Ok(())
    }

    /// Check if engine is running
    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }
}
