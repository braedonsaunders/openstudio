//! Opus Audio Codec Wrapper
//!
//! Low-latency audio encoding/decoding using Opus codec.
//! Optimized for real-time music transmission.

use super::{NetworkError, Result};
use opus::{Application, Bandwidth, Bitrate, Channels, Decoder, Encoder, Signal};
use std::sync::Mutex;

/// Opus codec configuration
#[derive(Debug, Clone)]
pub struct OpusConfig {
    /// Sample rate (48000 recommended for music)
    pub sample_rate: u32,
    /// Number of channels (1 or 2)
    pub channels: u8,
    /// Bitrate in bits per second (64000-510000)
    pub bitrate: u32,
    /// Frame size in samples (120, 240, 480, 960, 1920, 2880)
    /// Lower = lower latency but more overhead
    pub frame_size: usize,
    /// Enable forward error correction
    pub fec: bool,
    /// Enable discontinuous transmission (VAD)
    pub dtx: bool,
    /// Complexity (0-10, higher = better quality, more CPU)
    pub complexity: i32,
}

impl Default for OpusConfig {
    fn default() -> Self {
        Self {
            sample_rate: 48000,
            channels: 2,
            bitrate: 128000, // 128 kbps - good quality for music
            frame_size: 480, // 10ms at 48kHz - low latency
            fec: true,
            dtx: false,     // Keep stream constant for music
            complexity: 10, // Max quality
        }
    }
}

impl OpusConfig {
    /// Ultra-low latency preset (5ms frames)
    pub fn ultra_low_latency() -> Self {
        Self {
            frame_size: 240, // 5ms at 48kHz
            bitrate: 96000,
            complexity: 5, // Balance CPU vs quality
            ..Default::default()
        }
    }

    /// Low latency preset (10ms frames)
    pub fn low_latency() -> Self {
        Self::default()
    }

    /// Balanced preset (20ms frames)
    pub fn balanced() -> Self {
        Self {
            frame_size: 960, // 20ms at 48kHz
            bitrate: 160000,
            ..Default::default()
        }
    }

    /// High quality preset (20ms frames, high bitrate)
    pub fn high_quality() -> Self {
        Self {
            frame_size: 960,
            bitrate: 256000,
            ..Default::default()
        }
    }

    /// Frame duration in milliseconds
    pub fn frame_duration_ms(&self) -> f32 {
        (self.frame_size as f32 / self.sample_rate as f32) * 1000.0
    }

    /// Get opus Channels enum
    fn opus_channels(&self) -> Result<Channels> {
        match self.channels {
            1 => Ok(Channels::Mono),
            2 => Ok(Channels::Stereo),
            _ => Err(NetworkError::CodecError(format!(
                "Unsupported channel count: {}",
                self.channels
            ))),
        }
    }
}

/// Opus encoder wrapper
pub struct OpusEncoder {
    encoder: Mutex<Encoder>,
    config: OpusConfig,
    encode_buffer: Mutex<Vec<u8>>,
}

impl OpusEncoder {
    pub fn new(config: OpusConfig) -> Result<Self> {
        let channels = config.opus_channels()?;

        let mut encoder = Encoder::new(config.sample_rate, channels, Application::Audio)
            .map_err(|e| NetworkError::CodecError(e.to_string()))?;

        // Configure encoder for music
        encoder
            .set_bitrate(Bitrate::Bits(config.bitrate as i32))
            .map_err(|e| NetworkError::CodecError(e.to_string()))?;

        encoder
            .set_complexity(config.complexity)
            .map_err(|e| NetworkError::CodecError(e.to_string()))?;

        encoder
            .set_signal(Signal::Music)
            .map_err(|e| NetworkError::CodecError(e.to_string()))?;

        encoder
            .set_bandwidth(Bandwidth::Fullband)
            .map_err(|e| NetworkError::CodecError(e.to_string()))?;

        encoder
            .set_inband_fec(config.fec)
            .map_err(|e| NetworkError::CodecError(e.to_string()))?;

        encoder
            .set_dtx(config.dtx)
            .map_err(|e| NetworkError::CodecError(e.to_string()))?;

        // Max Opus packet size
        let encode_buffer = vec![0u8; 4000];

        Ok(Self {
            encoder: Mutex::new(encoder),
            config,
            encode_buffer: Mutex::new(encode_buffer),
        })
    }

    /// Encode PCM samples to Opus
    /// Input: interleaved f32 samples (frame_size * channels)
    /// Output: Opus-encoded bytes
    pub fn encode(&self, pcm: &[f32]) -> Result<Vec<u8>> {
        let expected_samples = self.config.frame_size * self.config.channels as usize;
        if pcm.len() != expected_samples {
            return Err(NetworkError::CodecError(format!(
                "Expected {} samples, got {}",
                expected_samples,
                pcm.len()
            )));
        }

        let mut encoder = self.encoder.lock().unwrap();
        let mut buffer = self.encode_buffer.lock().unwrap();

        // opus crate's encode_float takes f32 directly
        let len = encoder
            .encode_float(pcm, &mut buffer)
            .map_err(|e| NetworkError::CodecError(e.to_string()))?;

        Ok(buffer[..len].to_vec())
    }

    /// Encode PCM samples from i16
    pub fn encode_i16(&self, pcm: &[i16]) -> Result<Vec<u8>> {
        let expected_samples = self.config.frame_size * self.config.channels as usize;
        if pcm.len() != expected_samples {
            return Err(NetworkError::CodecError(format!(
                "Expected {} samples, got {}",
                expected_samples,
                pcm.len()
            )));
        }

        let mut encoder = self.encoder.lock().unwrap();
        let mut buffer = self.encode_buffer.lock().unwrap();

        let len = encoder
            .encode(pcm, &mut buffer)
            .map_err(|e| NetworkError::CodecError(e.to_string()))?;

        Ok(buffer[..len].to_vec())
    }

    /// Get the configured frame size
    pub fn frame_size(&self) -> usize {
        self.config.frame_size
    }

    /// Get the configured channel count
    pub fn channels(&self) -> u8 {
        self.config.channels
    }

    /// Get config
    pub fn config(&self) -> &OpusConfig {
        &self.config
    }
}

/// Opus decoder wrapper
pub struct OpusDecoder {
    decoder: Mutex<Decoder>,
    config: OpusConfig,
    decode_buffer: Mutex<Vec<f32>>,
}

impl OpusDecoder {
    pub fn new(config: OpusConfig) -> Result<Self> {
        let channels = config.opus_channels()?;

        let decoder = Decoder::new(config.sample_rate, channels)
            .map_err(|e| NetworkError::CodecError(e.to_string()))?;

        // Buffer for max frame size (120ms at 48kHz stereo = 5760 * 2)
        let decode_buffer = vec![0f32; 5760 * config.channels as usize];

        Ok(Self {
            decoder: Mutex::new(decoder),
            config,
            decode_buffer: Mutex::new(decode_buffer),
        })
    }

    /// Decode Opus packet to PCM samples
    /// Input: Opus-encoded bytes
    /// Output: interleaved f32 samples
    pub fn decode(&self, opus_data: &[u8]) -> Result<Vec<f32>> {
        let mut decoder = self.decoder.lock().unwrap();
        let mut buffer = self.decode_buffer.lock().unwrap();

        let samples = decoder
            .decode_float(opus_data, &mut buffer, false)
            .map_err(|e| NetworkError::CodecError(e.to_string()))?;

        let total_samples = samples * self.config.channels as usize;

        Ok(buffer[..total_samples].to_vec())
    }

    /// Decode to i16 samples
    pub fn decode_i16(&self, opus_data: &[u8]) -> Result<Vec<i16>> {
        let mut decoder = self.decoder.lock().unwrap();
        let mut buffer = vec![0i16; 5760 * self.config.channels as usize];

        let samples = decoder
            .decode(opus_data, &mut buffer, false)
            .map_err(|e| NetworkError::CodecError(e.to_string()))?;

        let total_samples = samples * self.config.channels as usize;

        Ok(buffer[..total_samples].to_vec())
    }

    /// Decode with packet loss concealment (when packet is lost)
    pub fn decode_plc(&self, frame_size: usize) -> Result<Vec<f32>> {
        let mut decoder = self.decoder.lock().unwrap();
        let output_size = frame_size * self.config.channels as usize;
        let mut buffer = vec![0f32; output_size];

        // Pass fec=true to enable forward error correction
        let samples = decoder
            .decode_float(&[], &mut buffer, true)
            .map_err(|e| NetworkError::CodecError(e.to_string()))?;

        let total_samples = samples * self.config.channels as usize;

        Ok(buffer[..total_samples].to_vec())
    }

    /// Get config
    pub fn config(&self) -> &OpusConfig {
        &self.config
    }
}

/// Combined codec for a single stream
pub struct OpusCodec {
    pub encoder: OpusEncoder,
    pub decoder: OpusDecoder,
    pub config: OpusConfig,
}

impl OpusCodec {
    pub fn new(config: OpusConfig) -> Result<Self> {
        let encoder = OpusEncoder::new(config.clone())?;
        let decoder = OpusDecoder::new(config.clone())?;
        Ok(Self {
            encoder,
            decoder,
            config,
        })
    }

    /// Create with low-latency preset
    pub fn low_latency() -> Result<Self> {
        Self::new(OpusConfig::low_latency())
    }

    /// Create with ultra-low-latency preset
    pub fn ultra_low_latency() -> Result<Self> {
        Self::new(OpusConfig::ultra_low_latency())
    }

    /// Create with high-quality preset
    pub fn high_quality() -> Result<Self> {
        Self::new(OpusConfig::high_quality())
    }

    /// Get frame duration in ms
    pub fn frame_duration_ms(&self) -> f32 {
        self.config.frame_duration_ms()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_decode_roundtrip() {
        let config = OpusConfig::low_latency();
        let codec = OpusCodec::new(config.clone()).unwrap();

        // Create test signal (sine wave)
        let frame_size = config.frame_size * config.channels as usize;
        let pcm: Vec<f32> = (0..frame_size)
            .map(|i| (i as f32 * 0.1).sin() * 0.5)
            .collect();

        // Encode
        let encoded = codec.encoder.encode(&pcm).unwrap();
        assert!(encoded.len() < pcm.len() * 4); // Should be compressed

        // Decode
        let decoded = codec.decoder.decode(&encoded).unwrap();
        assert_eq!(decoded.len(), pcm.len());

        // Verify approximate match (lossy codec)
        let mse: f32 = pcm
            .iter()
            .zip(decoded.iter())
            .map(|(a, b)| (a - b).powi(2))
            .sum::<f32>()
            / pcm.len() as f32;

        assert!(mse < 0.01, "MSE too high: {}", mse);
    }

    #[test]
    fn test_config_presets() {
        assert_eq!(OpusConfig::ultra_low_latency().frame_duration_ms(), 5.0);
        assert_eq!(OpusConfig::low_latency().frame_duration_ms(), 10.0);
        assert_eq!(OpusConfig::balanced().frame_duration_ms(), 20.0);
    }
}
