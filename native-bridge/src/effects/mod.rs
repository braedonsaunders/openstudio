//! Effects processing module
//!
//! Implements the full unified effects chain matching the browser:
//! Wah → Overdrive → Distortion → Amp → Cabinet → NoiseGate → EQ →
//! Compressor → Chorus → Flanger → Phaser → Delay → Tremolo → Reverb → Limiter

mod chain;
mod types;

// Individual effects (stubs for now - full implementation would be ~2000 lines each)
mod wah;
mod overdrive;
mod distortion;
mod amp;
mod cabinet;
mod noise_gate;
mod eq;
mod compressor;
mod chorus;
mod flanger;
mod phaser;
mod delay;
mod tremolo;
mod reverb;
mod limiter;

pub use chain::EffectsChain;
pub use types::*;

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
