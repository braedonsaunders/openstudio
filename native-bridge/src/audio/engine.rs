//! Audio engine - manages capture, playback, and processing

use super::{AudioDevice, BufferSize, ChannelConfig, DeviceInfo, SampleRate};
use crate::effects::EffectsChain;
use crate::mixing::TrackState;
use anyhow::Result;
use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::SampleFormat;
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

        let input_device = self.input_device.as_ref().unwrap();
        let output_device = self.output_device.as_ref().unwrap();

        // Get default configs from devices (works with WASAPI)
        let input_default_config = input_device.device.default_input_config()
            .map_err(|e| {
                let msg = e.to_string();
                // Log the actual error for debugging
                tracing::error!("Failed to get input config: {}", msg);
                if msg.contains("no longer available") || msg.contains("unplugged") {
                    anyhow::anyhow!("ASIO device error ({}). Try: 1) Close other audio apps, 2) Unplug/replug device, 3) Restart bridge", msg)
                } else {
                    anyhow::anyhow!("No input config: {}", e)
                }
            })?;
        let output_default_config = output_device.device.default_output_config()
            .map_err(|e| anyhow::anyhow!("No output config: {}", e))?;

        info!("Input device config: {:?}", input_default_config);
        info!("Output device config: {:?}", output_default_config);

        // Use default config but request our preferred buffer size and sample rate
        let buffer_size_samples = self.config.buffer_size as u32;

        let input_config = cpal::StreamConfig {
            channels: input_default_config.channels(),
            sample_rate: cpal::SampleRate(self.config.sample_rate as u32),
            buffer_size: cpal::BufferSize::Fixed(buffer_size_samples),
        };

        let output_config = cpal::StreamConfig {
            channels: output_default_config.channels().min(2), // Limit to stereo
            sample_rate: cpal::SampleRate(self.config.sample_rate as u32),
            buffer_size: cpal::BufferSize::Fixed(buffer_size_samples),
        };

        // Store actual sample rate for latency calculation
        let actual_sample_rate = output_config.sample_rate.0;

        // Shared state for input stream
        let levels = self.levels.clone();
        let input_channels = input_config.channels as usize;
        let input_sample_format = input_default_config.sample_format();
        let output_sample_format = output_default_config.sample_format();

        info!("Input sample format: {:?}, Output sample format: {:?}", input_sample_format, output_sample_format);

        // Create input stream based on device's native sample format
        let input_stream: cpal::Stream = match input_sample_format {
            SampleFormat::F32 => {
                input_device.device.build_input_stream(
                    &input_config,
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        let level = data.chunks(input_channels)
                            .map(|frame| frame.first().copied().unwrap_or(0.0).abs())
                            .fold(0.0_f32, f32::max);

                        if let Ok(mut lvl) = levels.try_write() {
                            lvl.input_level = level;
                            lvl.input_peak = lvl.input_peak.max(level);
                        }
                    },
                    |err| { error!("Input stream error: {}", err); },
                    None,
                )?
            }
            SampleFormat::I32 => {
                input_device.device.build_input_stream(
                    &input_config,
                    move |data: &[i32], _: &cpal::InputCallbackInfo| {
                        // Convert i32 to f32 (i32 range is -2^31 to 2^31-1)
                        let level = data.chunks(input_channels)
                            .map(|frame| {
                                let sample = frame.first().copied().unwrap_or(0);
                                (sample as f32 / i32::MAX as f32).abs()
                            })
                            .fold(0.0_f32, f32::max);

                        if let Ok(mut lvl) = levels.try_write() {
                            lvl.input_level = level;
                            lvl.input_peak = lvl.input_peak.max(level);
                        }
                    },
                    |err| { error!("Input stream error: {}", err); },
                    None,
                )?
            }
            SampleFormat::I16 => {
                input_device.device.build_input_stream(
                    &input_config,
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        let level = data.chunks(input_channels)
                            .map(|frame| {
                                let sample = frame.first().copied().unwrap_or(0);
                                (sample as f32 / i16::MAX as f32).abs()
                            })
                            .fold(0.0_f32, f32::max);

                        if let Ok(mut lvl) = levels.try_write() {
                            lvl.input_level = level;
                            lvl.input_peak = lvl.input_peak.max(level);
                        }
                    },
                    |err| { error!("Input stream error: {}", err); },
                    None,
                )?
            }
            _ => {
                return Err(anyhow::anyhow!("Unsupported input sample format: {:?}", input_sample_format));
            }
        };

        // Shared state for output stream
        let output_levels = self.levels.clone();

        // Create output stream based on device's native sample format
        let output_stream: cpal::Stream = match output_sample_format {
            SampleFormat::F32 => {
                output_device.device.build_output_stream(
                    &output_config,
                    move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                        for sample in data.iter_mut() {
                            *sample = 0.0;
                        }

                        let level = data.iter()
                            .map(|s| s.abs())
                            .fold(0.0_f32, f32::max);

                        if let Ok(mut lvl) = output_levels.try_write() {
                            lvl.output_level = level;
                            lvl.output_peak = lvl.output_peak.max(level);
                        }
                    },
                    |err| { error!("Output stream error: {}", err); },
                    None,
                )?
            }
            SampleFormat::I32 => {
                output_device.device.build_output_stream(
                    &output_config,
                    move |data: &mut [i32], _: &cpal::OutputCallbackInfo| {
                        for sample in data.iter_mut() {
                            *sample = 0;
                        }

                        // Output is silence, level is 0
                        if let Ok(mut lvl) = output_levels.try_write() {
                            lvl.output_level = 0.0;
                        }
                    },
                    |err| { error!("Output stream error: {}", err); },
                    None,
                )?
            }
            SampleFormat::I16 => {
                output_device.device.build_output_stream(
                    &output_config,
                    move |data: &mut [i16], _: &cpal::OutputCallbackInfo| {
                        for sample in data.iter_mut() {
                            *sample = 0;
                        }

                        if let Ok(mut lvl) = output_levels.try_write() {
                            lvl.output_level = 0.0;
                        }
                    },
                    |err| { error!("Output stream error: {}", err); },
                    None,
                )?
            }
            _ => {
                return Err(anyhow::anyhow!("Unsupported output sample format: {:?}", output_sample_format));
            }
        };

        // Start streams
        input_stream.play()?;
        output_stream.play()?;

        self.input_stream = Some(input_stream);
        self.output_stream = Some(output_stream);
        self.is_running.store(true, Ordering::SeqCst);

        // Estimate latency (WASAPI typically uses ~10ms buffers)
        let estimated_buffer_ms = 10.0;
        info!(
            "Audio started: {} -> {} @ {}Hz (estimated latency: {:.1}ms)",
            input_device.info.name,
            output_device.info.name,
            actual_sample_rate,
            estimated_buffer_ms * 2.0
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
