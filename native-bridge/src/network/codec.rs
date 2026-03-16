//! Opus Audio Codec Wrapper
//!
//! Low-latency audio encoding/decoding using Opus codec.
//! Optimized for real-time music transmission.

use super::{NetworkError, Result};
use opus::{Application, Bitrate, Channels, Decoder, Encoder};
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

        // Note: Signal type, complexity, bandwidth, and DTX are set at Opus library level
        // when available. The opus crate only exposes bitrate and FEC configuration.

        encoder
            .set_inband_fec(config.fec)
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

        let mut encoder = self
            .encoder
            .lock()
            .map_err(|_| NetworkError::CodecError("Encoder mutex poisoned".to_string()))?;
        let mut buffer = self
            .encode_buffer
            .lock()
            .map_err(|_| NetworkError::CodecError("Encode buffer mutex poisoned".to_string()))?;

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

        let mut encoder = self
            .encoder
            .lock()
            .map_err(|_| NetworkError::CodecError("Encoder mutex poisoned".to_string()))?;
        let mut buffer = self
            .encode_buffer
            .lock()
            .map_err(|_| NetworkError::CodecError("Encode buffer mutex poisoned".to_string()))?;

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
        let mut decoder = self
            .decoder
            .lock()
            .map_err(|_| NetworkError::CodecError("Decoder mutex poisoned".to_string()))?;
        let mut buffer = self
            .decode_buffer
            .lock()
            .map_err(|_| NetworkError::CodecError("Decode buffer mutex poisoned".to_string()))?;

        let samples = decoder
            .decode_float(opus_data, &mut buffer, false)
            .map_err(|e| NetworkError::CodecError(e.to_string()))?;

        let total_samples = samples * self.config.channels as usize;

        Ok(buffer[..total_samples].to_vec())
    }

    /// Decode to i16 samples
    pub fn decode_i16(&self, opus_data: &[u8]) -> Result<Vec<i16>> {
        let mut decoder = self
            .decoder
            .lock()
            .map_err(|_| NetworkError::CodecError("Decoder mutex poisoned".to_string()))?;
        let mut buffer = vec![0i16; 5760 * self.config.channels as usize];

        let samples = decoder
            .decode(opus_data, &mut buffer, false)
            .map_err(|e| NetworkError::CodecError(e.to_string()))?;

        let total_samples = samples * self.config.channels as usize;

        Ok(buffer[..total_samples].to_vec())
    }

    /// Decode with packet loss concealment (when packet is lost)
    pub fn decode_plc(&self, frame_size: usize) -> Result<Vec<f32>> {
        let mut decoder = self
            .decoder
            .lock()
            .map_err(|_| NetworkError::CodecError("Decoder mutex poisoned".to_string()))?;
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

    fn rms(samples: &[f32]) -> f32 {
        (samples.iter().map(|sample| sample * sample).sum::<f32>() / samples.len() as f32).sqrt()
    }

    fn correlation(a: &[f32], b: &[f32]) -> f32 {
        let mean_a = a.iter().copied().sum::<f32>() / a.len() as f32;
        let mean_b = b.iter().copied().sum::<f32>() / b.len() as f32;

        let mut numerator = 0.0;
        let mut denom_a = 0.0;
        let mut denom_b = 0.0;

        for (sample_a, sample_b) in a.iter().zip(b.iter()) {
            let centered_a = *sample_a - mean_a;
            let centered_b = *sample_b - mean_b;
            numerator += centered_a * centered_b;
            denom_a += centered_a * centered_a;
            denom_b += centered_b * centered_b;
        }

        if denom_a == 0.0 || denom_b == 0.0 {
            return 0.0;
        }

        numerator / (denom_a.sqrt() * denom_b.sqrt())
    }

    fn best_alignment_correlation(
        reference: &[f32],
        decoded: &[f32],
        max_lag: usize,
    ) -> (isize, f32) {
        let mut best_lag = 0isize;
        let mut best_corr = f32::NEG_INFINITY;

        for lag in -(max_lag as isize)..=(max_lag as isize) {
            let (reference_slice, decoded_slice) = if lag >= 0 {
                let lag = lag as usize;
                let overlap = reference.len().saturating_sub(lag);
                if overlap < 64 {
                    continue;
                }
                (&reference[..overlap], &decoded[lag..lag + overlap])
            } else {
                let lag = (-lag) as usize;
                let overlap = decoded.len().saturating_sub(lag);
                if overlap < 64 {
                    continue;
                }
                (&reference[lag..lag + overlap], &decoded[..overlap])
            };

            let corr = correlation(reference_slice, decoded_slice);
            if corr > best_corr {
                best_corr = corr;
                best_lag = lag;
            }
        }

        (best_lag, best_corr)
    }

    #[test]
    fn test_encode_decode_roundtrip() {
        let config = OpusConfig::low_latency();
        let codec = OpusCodec::new(config.clone()).unwrap();

        // Create a continuous test signal and validate that the decoded stream
        // preserves energy and correlation after alignment. Opus is lossy and
        // introduces codec delay, so sample-perfect roundtrips are not expected.
        let frame_size = config.frame_size * config.channels as usize;
        let frame_count = 8usize;
        let pcm: Vec<f32> = (0..frame_size * frame_count)
            .map(|i| {
                let phase = i as f32 * 0.07;
                (phase.sin() * 0.35) + ((phase * 0.37).sin() * 0.15)
            })
            .collect();

        let mut decoded = Vec::with_capacity(pcm.len());
        for frame in pcm.chunks(frame_size) {
            let encoded = codec.encoder.encode(frame).unwrap();
            assert!(encoded.len() < frame.len() * 4);

            let decoded_frame = codec.decoder.decode(&encoded).unwrap();
            assert_eq!(decoded_frame.len(), frame.len());
            decoded.extend(decoded_frame);
        }

        assert_eq!(decoded.len(), pcm.len());

        let (best_lag, best_corr) = best_alignment_correlation(&pcm, &decoded, config.frame_size);
        let input_rms = rms(&pcm);
        let output_rms = rms(&decoded);
        let rms_ratio = if input_rms > 0.0 {
            output_rms / input_rms
        } else {
            0.0
        };

        assert!(
            best_corr > 0.7,
            "Decoded stream correlation too low: corr={best_corr}, lag={best_lag}"
        );
        assert!(
            (0.35..=1.6).contains(&rms_ratio),
            "Decoded stream RMS drifted too far: input={input_rms}, output={output_rms}, ratio={rms_ratio}"
        );
    }

    #[test]
    fn test_config_presets() {
        assert_eq!(OpusConfig::ultra_low_latency().frame_duration_ms(), 5.0);
        assert_eq!(OpusConfig::low_latency().frame_duration_ms(), 10.0);
        assert_eq!(OpusConfig::balanced().frame_duration_ms(), 20.0);
    }
}
