//! Effects chain - processes audio through all effects in order
//!
//! Unified effects chain matching the browser:
//! Wah → Overdrive → Distortion → Amp → Cabinet → NoiseGate → EQ →
//! Compressor → Chorus → Flanger → Phaser → Delay → Tremolo → Reverb → Limiter
//! Plus extended effects.

use super::types::*;
use super::AudioEffect;
use super::{
    Amp, AutoPan, Bitcrusher, Cabinet, Chorus, Compressor, DeEsser, Delay, Distortion, Eq,
    Exciter, Flanger, Limiter, MultiFilter, MultibandCompressor, NoiseGate, Overdrive, Phaser,
    Reverb, RingModulator, RoomSimulator, ShimmerReverb, StereoDelay, StereoImager,
    TransientShaper, Tremolo, Vibrato, VocalDoubler, Wah,
};

/// The complete effects chain with all 35 effects
pub struct EffectsChain {
    settings: EffectsSettings,
    metering: EffectsMetering,
    sample_rate: u32,

    // === Base effects (15) in processing order ===
    wah: Wah,
    overdrive: Overdrive,
    distortion: Distortion,
    amp: Amp,
    cabinet: Cabinet,
    noise_gate: NoiseGate,
    eq: Eq,
    compressor: Compressor,
    chorus: Chorus,
    flanger: Flanger,
    phaser: Phaser,
    delay: Delay,
    tremolo: Tremolo,
    reverb: Reverb,
    limiter: Limiter,

    // === Extended effects (20) ===
    // Note: pitch_correction, harmonizer, formant_shifter, frequency_shifter
    // are deferred to Phase 2 (require pitch detection/shifting)
    vocal_doubler: VocalDoubler,
    de_esser: DeEsser,
    bitcrusher: Bitcrusher,
    ring_modulator: RingModulator,
    // granular_delay deferred to Phase 2
    // rotary_speaker deferred to Phase 2
    auto_pan: AutoPan,
    multi_filter: MultiFilter,
    vibrato: Vibrato,
    transient_shaper: TransientShaper,
    stereo_imager: StereoImager,
    exciter: Exciter,
    multiband_compressor: MultibandCompressor,
    stereo_delay: StereoDelay,
    room_simulator: RoomSimulator,
    shimmer_reverb: ShimmerReverb,
}

impl EffectsChain {
    pub fn new() -> Self {
        let sample_rate = 48000;
        Self {
            settings: EffectsSettings::default(),
            metering: EffectsMetering::default(),
            sample_rate,

            // Base effects
            wah: Wah::new(sample_rate),
            overdrive: Overdrive::new(sample_rate),
            distortion: Distortion::new(sample_rate),
            amp: Amp::new(sample_rate),
            cabinet: Cabinet::new(sample_rate),
            noise_gate: NoiseGate::new(sample_rate),
            eq: Eq::new(sample_rate),
            compressor: Compressor::new(sample_rate),
            chorus: Chorus::new(sample_rate),
            flanger: Flanger::new(sample_rate),
            phaser: Phaser::new(sample_rate),
            delay: Delay::new(sample_rate),
            tremolo: Tremolo::new(sample_rate),
            reverb: Reverb::new(sample_rate),
            limiter: Limiter::new(sample_rate),

            // Extended effects
            vocal_doubler: VocalDoubler::new(sample_rate),
            de_esser: DeEsser::new(sample_rate),
            bitcrusher: Bitcrusher::new(sample_rate),
            ring_modulator: RingModulator::new(sample_rate),
            auto_pan: AutoPan::new(sample_rate),
            multi_filter: MultiFilter::new(sample_rate),
            vibrato: Vibrato::new(sample_rate),
            transient_shaper: TransientShaper::new(sample_rate),
            stereo_imager: StereoImager::new(sample_rate),
            exciter: Exciter::new(sample_rate),
            multiband_compressor: MultibandCompressor::new(sample_rate),
            stereo_delay: StereoDelay::new(sample_rate),
            room_simulator: RoomSimulator::new(sample_rate),
            shimmer_reverb: ShimmerReverb::new(sample_rate),
        }
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate;

        // Update all effects with new sample rate
        self.wah.set_sample_rate(rate);
        self.overdrive.set_sample_rate(rate);
        self.distortion.set_sample_rate(rate);
        self.amp.set_sample_rate(rate);
        self.cabinet.set_sample_rate(rate);
        self.noise_gate.set_sample_rate(rate);
        self.eq.set_sample_rate(rate);
        self.compressor.set_sample_rate(rate);
        self.chorus.set_sample_rate(rate);
        self.flanger.set_sample_rate(rate);
        self.phaser.set_sample_rate(rate);
        self.delay.set_sample_rate(rate);
        self.tremolo.set_sample_rate(rate);
        self.reverb.set_sample_rate(rate);
        self.limiter.set_sample_rate(rate);

        self.vocal_doubler.set_sample_rate(rate);
        self.de_esser.set_sample_rate(rate);
        self.bitcrusher.set_sample_rate(rate);
        self.ring_modulator.set_sample_rate(rate);
        self.auto_pan.set_sample_rate(rate);
        self.multi_filter.set_sample_rate(rate);
        self.vibrato.set_sample_rate(rate);
        self.transient_shaper.set_sample_rate(rate);
        self.stereo_imager.set_sample_rate(rate);
        self.exciter.set_sample_rate(rate);
        self.multiband_compressor.set_sample_rate(rate);
        self.stereo_delay.set_sample_rate(rate);
        self.room_simulator.set_sample_rate(rate);
        self.shimmer_reverb.set_sample_rate(rate);

        self.reset();
    }

    pub fn update_settings(&mut self, settings: EffectsSettings) {
        // Update each effect's settings
        self.wah.update_settings(settings.wah.clone());
        self.overdrive.update_settings(settings.overdrive.clone());
        self.distortion.update_settings(settings.distortion.clone());
        self.amp.update_settings(settings.amp.clone());
        self.cabinet.update_settings(settings.cabinet.clone());
        self.noise_gate.update_settings(settings.noise_gate.clone());
        self.eq.update_settings(settings.eq.clone());
        self.compressor.update_settings(settings.compressor.clone());
        self.chorus.update_settings(settings.chorus.clone());
        self.flanger.update_settings(settings.flanger.clone());
        self.phaser.update_settings(settings.phaser.clone());
        self.delay.update_settings(settings.delay.clone());
        self.tremolo.update_settings(settings.tremolo.clone());
        self.reverb.update_settings(settings.reverb.clone());
        self.limiter.update_settings(settings.limiter.clone());

        // Extended effects
        self.vocal_doubler
            .update_settings(settings.vocal_doubler.clone());
        self.de_esser.update_settings(settings.de_esser.clone());
        self.bitcrusher.update_settings(settings.bitcrusher.clone());
        self.ring_modulator
            .update_settings(settings.ring_modulator.clone());
        self.auto_pan.update_settings(settings.auto_pan.clone());
        self.multi_filter
            .update_settings(settings.multi_filter.clone());
        self.vibrato.update_settings(settings.vibrato.clone());
        self.transient_shaper
            .update_settings(settings.transient_shaper.clone());
        self.stereo_imager
            .update_settings(settings.stereo_imager.clone());
        self.exciter.update_settings(settings.exciter.clone());
        self.multiband_compressor
            .update_settings(settings.multiband_compressor.clone());
        self.stereo_delay
            .update_settings(settings.stereo_delay.clone());
        self.room_simulator
            .update_settings(settings.room_simulator.clone());
        self.shimmer_reverb
            .update_settings(settings.shimmer_reverb.clone());

        self.settings = settings;
    }

    pub fn get_settings(&self) -> &EffectsSettings {
        &self.settings
    }

    pub fn get_metering(&self) -> &EffectsMetering {
        &self.metering
    }

    /// Process stereo samples through the entire chain
    /// Input/output format: [L, R, L, R, L, R, ...]
    pub fn process(&mut self, samples: &mut [f32]) {
        let sr = self.sample_rate;

        // === INSTRUMENT CHAIN (pre-amp effects) ===

        // 1. Wah - before distortion for classic wah-distortion interaction
        if self.settings.wah.enabled {
            self.wah.process(samples, sr);
        }

        // 2. Overdrive - soft tube-like saturation
        if self.settings.overdrive.enabled {
            self.overdrive.process(samples, sr);
        }

        // 3. Distortion - harder clipping options
        if self.settings.distortion.enabled {
            self.distortion.process(samples, sr);
        }

        // 4. Amp - full amplifier simulation
        if self.settings.amp.enabled {
            self.amp.process(samples, sr);
        }

        // 5. Cabinet - speaker simulation
        if self.settings.cabinet.enabled {
            self.cabinet.process(samples, sr);
        }

        // === DYNAMICS (post-distortion) ===

        // 6. Noise Gate - clean up noise from high-gain effects
        if self.settings.noise_gate.enabled {
            self.noise_gate.process(samples, sr);
            self.metering.noise_gate_open = self.noise_gate.is_gate_open();
        }

        // 7. De-Esser - tame sibilance (especially for vocals)
        if self.settings.de_esser.enabled {
            self.de_esser.process(samples, sr);
        }

        // 8. Transient Shaper - attack/sustain control
        if self.settings.transient_shaper.enabled {
            self.transient_shaper.process(samples, sr);
        }

        // === TONE SHAPING ===

        // 9. EQ - parametric equalization
        if self.settings.eq.enabled {
            self.eq.process(samples, sr);
        }

        // 10. Exciter - harmonic enhancement
        if self.settings.exciter.enabled {
            self.exciter.process(samples, sr);
        }

        // 11. Multi-Filter - resonant filter with modulation
        if self.settings.multi_filter.enabled {
            self.multi_filter.process(samples, sr);
        }

        // === DYNAMICS (compression) ===

        // 12. Compressor - single-band compression
        if self.settings.compressor.enabled {
            self.compressor.process(samples, sr);
            self.metering.compressor_reduction = self.compressor.get_reduction();
        }

        // 13. Multiband Compressor - frequency-specific compression
        if self.settings.multiband_compressor.enabled {
            self.multiband_compressor.process(samples, sr);
        }

        // === MODULATION EFFECTS ===

        // 14. Bitcrusher - lo-fi digital degradation
        if self.settings.bitcrusher.enabled {
            self.bitcrusher.process(samples, sr);
        }

        // 15. Ring Modulator - metallic/robotic modulation
        if self.settings.ring_modulator.enabled {
            self.ring_modulator.process(samples, sr);
        }

        // 16. Chorus - thickening with detuned copies
        if self.settings.chorus.enabled {
            self.chorus.process(samples, sr);
        }

        // 17. Flanger - jet/swoosh effect
        if self.settings.flanger.enabled {
            self.flanger.process(samples, sr);
        }

        // 18. Phaser - sweeping notches
        if self.settings.phaser.enabled {
            self.phaser.process(samples, sr);
        }

        // 19. Vibrato - pitch modulation
        if self.settings.vibrato.enabled {
            self.vibrato.process(samples, sr);
        }

        // 20. Tremolo - amplitude modulation
        if self.settings.tremolo.enabled {
            self.tremolo.process(samples, sr);
        }

        // 21. Auto Pan - stereo panning modulation
        if self.settings.auto_pan.enabled {
            self.auto_pan.process(samples, sr);
        }

        // 22. Vocal Doubler - ADT effect
        if self.settings.vocal_doubler.enabled {
            self.vocal_doubler.process(samples, sr);
        }

        // === DELAY EFFECTS ===

        // 23. Delay - single tap delay
        if self.settings.delay.enabled {
            self.delay.process(samples, sr);
        }

        // 24. Stereo Delay - independent L/R delays
        if self.settings.stereo_delay.enabled {
            self.stereo_delay.process(samples, sr);
        }

        // === SPATIAL/REVERB ===

        // 25. Room Simulator - early reflections + reverb
        if self.settings.room_simulator.enabled {
            self.room_simulator.process(samples, sr);
        }

        // 26. Reverb - algorithmic reverb
        if self.settings.reverb.enabled {
            self.reverb.process(samples, sr);
        }

        // 27. Shimmer Reverb - pitch-shifted reverb
        if self.settings.shimmer_reverb.enabled {
            self.shimmer_reverb.process(samples, sr);
        }

        // === STEREO ===

        // 28. Stereo Imager - width control
        if self.settings.stereo_imager.enabled {
            self.stereo_imager.process(samples, sr);
        }

        // === OUTPUT ===

        // 29. Limiter - brickwall safety limiter (always active when enabled)
        if self.settings.limiter.enabled {
            self.limiter.process(samples, sr);
            self.metering.limiter_reduction = self.limiter.get_reduction();
        }
    }

    pub fn reset(&mut self) {
        self.metering = EffectsMetering::default();

        // Reset all effects
        self.wah.reset();
        self.overdrive.reset();
        self.distortion.reset();
        self.amp.reset();
        self.cabinet.reset();
        self.noise_gate.reset();
        self.eq.reset();
        self.compressor.reset();
        self.chorus.reset();
        self.flanger.reset();
        self.phaser.reset();
        self.delay.reset();
        self.tremolo.reset();
        self.reverb.reset();
        self.limiter.reset();

        self.vocal_doubler.reset();
        self.de_esser.reset();
        self.bitcrusher.reset();
        self.ring_modulator.reset();
        self.auto_pan.reset();
        self.multi_filter.reset();
        self.vibrato.reset();
        self.transient_shaper.reset();
        self.stereo_imager.reset();
        self.exciter.reset();
        self.multiband_compressor.reset();
        self.stereo_delay.reset();
        self.room_simulator.reset();
        self.shimmer_reverb.reset();
    }
}

impl Default for EffectsChain {
    fn default() -> Self {
        Self::new()
    }
}
