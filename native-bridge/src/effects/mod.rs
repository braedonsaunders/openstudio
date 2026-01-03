//! Effects processing module
//!
//! Implements the full unified effects chain matching the browser:
//! Wah → Overdrive → Distortion → Amp → Cabinet → NoiseGate → EQ →
//! Compressor → Chorus → Flanger → Phaser → Delay → Tremolo → Reverb → Limiter
//! Plus 20 extended effects for a total of 35.

mod chain;
pub mod dsp;
pub mod pitch;
mod types;

// Individual effects
mod amp;
mod auto_pan;
mod bitcrusher;
mod cabinet;
mod chorus;
mod compressor;
mod de_esser;
mod delay;
mod distortion;
mod eq;
mod exciter;
mod flanger;
mod formant_shifter;
mod frequency_shifter;
mod granular_delay;
mod harmonizer;
mod limiter;
mod multi_filter;
mod multiband_compressor;
mod noise_gate;
mod overdrive;
mod phaser;
mod pitch_correction;
mod reverb;
mod ring_modulator;
mod room_simulator;
mod rotary_speaker;
mod shimmer_reverb;
mod stereo_delay;
mod stereo_imager;
mod transient_shaper;
mod tremolo;
mod vibrato;
mod vocal_doubler;
mod wah;

pub use chain::EffectsChain;
pub use types::*;

// Re-export individual effects for direct use
pub use amp::Amp;
pub use auto_pan::AutoPan;
pub use bitcrusher::Bitcrusher;
pub use cabinet::Cabinet;
pub use chorus::Chorus;
pub use compressor::Compressor;
pub use de_esser::DeEsser;
pub use delay::Delay;
pub use distortion::Distortion;
pub use eq::Eq;
pub use exciter::Exciter;
pub use flanger::Flanger;
pub use formant_shifter::FormantShifter;
pub use frequency_shifter::FrequencyShifter;
pub use granular_delay::GranularDelay;
pub use harmonizer::Harmonizer;
pub use limiter::Limiter;
pub use multi_filter::MultiFilter;
pub use multiband_compressor::MultibandCompressor;
pub use noise_gate::NoiseGate;
pub use overdrive::Overdrive;
pub use phaser::Phaser;
pub use pitch_correction::PitchCorrection;
pub use reverb::Reverb;
pub use ring_modulator::RingModulator;
pub use room_simulator::RoomSimulator;
pub use rotary_speaker::RotarySpeaker;
pub use shimmer_reverb::ShimmerReverb;
pub use stereo_delay::StereoDelay;
pub use stereo_imager::StereoImager;
pub use transient_shaper::TransientShaper;
pub use tremolo::Tremolo;
pub use vibrato::Vibrato;
pub use vocal_doubler::VocalDoubler;
pub use wah::Wah;

/// Trait for all audio effects
pub trait AudioEffect: Send + Sync {
    /// Process a buffer of stereo samples in-place
    fn process(&mut self, samples: &mut [f32], sample_rate: u32);

    /// Reset effect state (clear delay lines, etc.)
    fn reset(&mut self);

    /// Check if effect is enabled
    fn is_enabled(&self) -> bool;

    /// Enable/disable effect
    fn set_enabled(&mut self, enabled: bool);
}
