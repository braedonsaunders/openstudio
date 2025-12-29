//! Audio I/O module - handles ASIO/CoreAudio device access

mod device;
mod engine;
mod stream;

pub use device::{AudioDevice, ChannelConfig, DeviceInfo};
pub use engine::AudioEngine;

/// Supported sample rates
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum SampleRate {
    Hz44100 = 44100,
    Hz48000 = 48000,
}

impl Default for SampleRate {
    fn default() -> Self {
        SampleRate::Hz48000
    }
}

/// Buffer size in samples
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum BufferSize {
    Samples32 = 32,
    Samples64 = 64,
    Samples128 = 128,
    Samples256 = 256,
    Samples512 = 512,
    Samples1024 = 1024,
}

impl Default for BufferSize {
    fn default() -> Self {
        BufferSize::Samples128
    }
}

impl BufferSize {
    pub fn latency_ms(&self, sample_rate: SampleRate) -> f32 {
        (*self as u32) as f32 / (sample_rate as u32) as f32 * 1000.0
    }
}
