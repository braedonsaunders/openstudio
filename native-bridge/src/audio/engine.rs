//! Audio engine - manages capture, playback, and processing

use super::{AudioDevice, BufferSize, ChannelConfig, DeviceInfo, SampleRate};
use crate::effects::EffectsChain;
use crate::mixing::TrackState;
use anyhow::Result;
use cpal::traits::{DeviceTrait, StreamTrait};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use std::sync::RwLock;
use tracing::{info, error};

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
    pub fn new() -> Result<Self> {
        let config = EngineConfig::default();

        let engine = Self {
            config,
            input_device: None,
            output_device: None,
            input_stream: None,
            output_stream: None,
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
    pub fn set_input_device(&mut self, device_id: &str) -> Result<()> {
        let was_running = self.is_running.load(Ordering::SeqCst);

        if was_running {
            self.stop()?;
        }

        self.input_device = Some(AudioDevice::get_by_id(device_id)?);
        self.config.input_device_id = Some(device_id.to_string());

        info!("Input device set: {}", self.input_device.as_ref().unwrap().info.name);

        if was_running {
            self.start()?;
        }

        Ok(())
    }

    /// Set output device
    pub fn set_output_device(&mut self, device_id: &str) -> Result<()> {
        let was_running = self.is_running.load(Ordering::SeqCst);

        if was_running {
            self.stop()?;
        }

        self.output_device = Some(AudioDevice::get_by_id(device_id)?);
        self.config.output_device_id = Some(device_id.to_string());

        info!("Output device set: {}", self.output_device.as_ref().unwrap().info.name);

        if was_running {
            self.start()?;
        }

        Ok(())
    }

    /// Set channel configuration
    pub fn set_channel_config(&mut self, config: ChannelConfig) -> Result<()> {
        self.config.channel_config = config;
        if self.is_running.load(Ordering::SeqCst) {
            self.stop()?;
            self.start()?;
        }
        Ok(())
    }

    /// Set buffer size
    pub fn set_buffer_size(&mut self, size: BufferSize) -> Result<()> {
        self.config.buffer_size = size;
        if self.is_running.load(Ordering::SeqCst) {
            self.stop()?;
            self.start()?;
        }
        Ok(())
    }

    /// Set sample rate
    pub fn set_sample_rate(&mut self, rate: SampleRate) -> Result<()> {
        self.config.sample_rate = rate;
        if self.is_running.load(Ordering::SeqCst) {
            self.stop()?;
            self.start()?;
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
    pub fn update_track_state(&self, state: TrackState) {
        if let Ok(mut track) = self.track_state.write() {
            *track = state;
        }
    }

    /// Update effects chain
    pub fn update_effects(&self, effects: crate::effects::EffectsSettings) {
        if let Ok(mut chain) = self.effects_chain.write() {
            chain.update_settings(effects);
        }
    }

    /// Get current audio levels
    pub fn get_levels(&self) -> AudioLevels {
        self.levels.read().map(|l| l.clone()).unwrap_or_default()
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

    /// Start audio streams
    pub fn start(&mut self) -> Result<()> {
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
        let levels = self.levels.clone();
        let channel_cfg = channel_config.clone();

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

                // Calculate input level
                let level = samples.iter()
                    .map(|s| s.abs())
                    .fold(0.0_f32, f32::max);

                // Update levels (non-blocking)
                if let Ok(mut lvl) = levels.try_write() {
                    lvl.input_level = level;
                    lvl.input_peak = lvl.input_peak.max(level);
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
        let output_levels = self.levels.clone();

        // Create output stream
        let output_stream = output_device.device.build_output_stream(
            &output_config,
            move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
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
            "Audio started: {} -> {} | Buffer: {} samples ({:.1}ms) @ {}Hz",
            self.input_device.as_ref().unwrap().info.name,
            self.output_device.as_ref().unwrap().info.name,
            latency.buffer_size_samples,
            latency.total_latency_ms,
            sample_rate
        );

        Ok(())
    }

    /// Stop audio streams
    pub fn stop(&mut self) -> Result<()> {
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
