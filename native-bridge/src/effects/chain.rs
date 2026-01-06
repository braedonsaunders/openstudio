//! Effects chain - processes audio through all effects in order
//!
//! Unified effects chain matching the browser:
//! PitchCorrection → Wah → Overdrive → Distortion → Amp → Cabinet → NoiseGate → EQ →
//! Compressor → Chorus → Flanger → Phaser → Delay → Tremolo → Reverb → Limiter
//! Plus all extended effects for a total of 35.

use super::types::*;
use super::AudioEffect;
use super::{
    Amp, AutoPan, Bitcrusher, Cabinet, Chorus, Compressor, DeEsser, Delay, Distortion, Eq,
    Exciter, Flanger, FormantShifter, FrequencyShifter, GranularDelay, Harmonizer, Limiter,
    MultiFilter, MultibandCompressor, NoiseGate, Overdrive, Phaser, PitchCorrection, Reverb,
    RingModulator, RoomSimulator, RotarySpeaker, ShimmerReverb, StereoDelay, StereoImager,
    TransientShaper, Tremolo, Vibrato, VocalDoubler, Wah,
};

/// Room context for pitch/tempo-aware effects
#[derive(Debug, Clone, Default)]
pub struct RoomContext {
    /// Musical key (C, C#, D, etc.)
    pub key: String,
    /// Scale type (major, minor, chromatic, etc.)
    pub scale: String,
    /// Tempo in BPM
    pub bpm: f32,
    /// Time signature numerator
    pub time_sig_num: u8,
    /// Time signature denominator
    pub time_sig_denom: u8,
}

/// The complete effects chain with all 35 effects
pub struct EffectsChain {
    settings: EffectsSettings,
    metering: EffectsMetering,
    sample_rate: u32,

    /// Room context for pitch/tempo effects
    room_context: RoomContext,

    // === Pitch effects (first in chain for clean pitch detection) ===
    pitch_correction: PitchCorrection,
    harmonizer: Harmonizer,
    formant_shifter: FormantShifter,

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

    // === Extended effects ===
    vocal_doubler: VocalDoubler,
    de_esser: DeEsser,
    bitcrusher: Bitcrusher,
    ring_modulator: RingModulator,
    frequency_shifter: FrequencyShifter,
    granular_delay: GranularDelay,
    rotary_speaker: RotarySpeaker,
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
            room_context: RoomContext {
                key: "C".to_string(),
                scale: "chromatic".to_string(),
                bpm: 120.0,
                time_sig_num: 4,
                time_sig_denom: 4,
            },

            // Pitch effects
            pitch_correction: PitchCorrection::new(sample_rate),
            harmonizer: Harmonizer::new(sample_rate),
            formant_shifter: FormantShifter::new(sample_rate),

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
            frequency_shifter: FrequencyShifter::new(sample_rate),
            granular_delay: GranularDelay::new(sample_rate),
            rotary_speaker: RotarySpeaker::new(sample_rate),
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

    /// Set room context for pitch and tempo-aware effects
    pub fn set_room_context(&mut self, key: Option<String>, scale: Option<String>, bpm: Option<f32>, time_sig_num: Option<u8>, time_sig_denom: Option<u8>) {
        if let Some(k) = key {
            self.room_context.key = k;
        }
        if let Some(s) = scale {
            self.room_context.scale = s;
        }
        if let Some(b) = bpm {
            self.room_context.bpm = b;
        }
        if let Some(n) = time_sig_num {
            self.room_context.time_sig_num = n;
        }
        if let Some(d) = time_sig_denom {
            self.room_context.time_sig_denom = d;
        }

        // Update pitch-aware effects
        self.pitch_correction.set_room_context(&self.room_context.key, &self.room_context.scale);
        self.harmonizer.set_room_context(&self.room_context.key, &self.room_context.scale);

        // Update tempo-sync effects with BPM
        if self.room_context.bpm > 0.0 {
            self.delay.set_bpm(self.room_context.bpm);
            self.stereo_delay.set_bpm(self.room_context.bpm);
            self.auto_pan.set_bpm(self.room_context.bpm);
        }
    }

    pub fn get_room_context(&self) -> &RoomContext {
        &self.room_context
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate;

        // Update all effects with new sample rate
        self.pitch_correction.set_sample_rate(rate);
        self.harmonizer.set_sample_rate(rate);
        self.formant_shifter.set_sample_rate(rate);

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
        self.frequency_shifter.set_sample_rate(rate);
        self.granular_delay.set_sample_rate(rate);
        self.rotary_speaker.set_sample_rate(rate);
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
        // Pitch effects
        self.pitch_correction.update_settings(settings.pitch_correction.clone());
        self.harmonizer.update_settings(settings.harmonizer.clone());
        self.formant_shifter.update_settings(settings.formant_shifter.clone());

        // Base effects
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
        self.vocal_doubler.update_settings(settings.vocal_doubler.clone());
        self.de_esser.update_settings(settings.de_esser.clone());
        self.bitcrusher.update_settings(settings.bitcrusher.clone());
        self.ring_modulator.update_settings(settings.ring_modulator.clone());
        self.frequency_shifter.update_settings(settings.frequency_shifter.clone());
        self.granular_delay.update_settings(settings.granular_delay.clone());
        self.rotary_speaker.update_settings(settings.rotary_speaker.clone());
        self.auto_pan.update_settings(settings.auto_pan.clone());
        self.multi_filter.update_settings(settings.multi_filter.clone());
        self.vibrato.update_settings(settings.vibrato.clone());
        self.transient_shaper.update_settings(settings.transient_shaper.clone());
        self.stereo_imager.update_settings(settings.stereo_imager.clone());
        self.exciter.update_settings(settings.exciter.clone());
        self.multiband_compressor.update_settings(settings.multiband_compressor.clone());
        self.stereo_delay.update_settings(settings.stereo_delay.clone());
        self.room_simulator.update_settings(settings.room_simulator.clone());
        self.shimmer_reverb.update_settings(settings.shimmer_reverb.clone());

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

        // === PITCH CORRECTION (first for clean detection) ===

        // 1. Pitch Correction - auto-tune style correction
        if self.settings.pitch_correction.enabled {
            self.pitch_correction.process(samples, sr);
        }

        // 2. Harmonizer - add harmony voices
        if self.settings.harmonizer.enabled {
            self.harmonizer.process(samples, sr);
        }

        // 3. Formant Shifter - vocal character change
        if self.settings.formant_shifter.enabled {
            self.formant_shifter.process(samples, sr);
        }

        // === INSTRUMENT CHAIN (pre-amp effects) ===

        // 4. Wah - before distortion for classic wah-distortion interaction
        if self.settings.wah.enabled {
            self.wah.process(samples, sr);
        }

        // 5. Overdrive - soft tube-like saturation
        if self.settings.overdrive.enabled {
            self.overdrive.process(samples, sr);
        }

        // 6. Distortion - harder clipping options
        if self.settings.distortion.enabled {
            self.distortion.process(samples, sr);
        }

        // 7. Amp - full amplifier simulation
        if self.settings.amp.enabled {
            self.amp.process(samples, sr);
        }

        // 8. Cabinet - speaker simulation
        if self.settings.cabinet.enabled {
            self.cabinet.process(samples, sr);
        }

        // === DYNAMICS (post-distortion) ===

        // 9. Noise Gate - clean up noise from high-gain effects
        if self.settings.noise_gate.enabled {
            self.noise_gate.process(samples, sr);
            self.metering.noise_gate_open = self.noise_gate.is_gate_open();
        }

        // 10. De-Esser - tame sibilance (especially for vocals)
        if self.settings.de_esser.enabled {
            self.de_esser.process(samples, sr);
            self.metering.de_esser_reduction = self.de_esser.get_reduction();
        }

        // 11. Transient Shaper - attack/sustain control
        if self.settings.transient_shaper.enabled {
            self.transient_shaper.process(samples, sr);
        }

        // === TONE SHAPING ===

        // 12. EQ - parametric equalization
        if self.settings.eq.enabled {
            self.eq.process(samples, sr);
        }

        // 13. Exciter - harmonic enhancement
        if self.settings.exciter.enabled {
            self.exciter.process(samples, sr);
        }

        // 14. Multi-Filter - resonant filter with modulation
        if self.settings.multi_filter.enabled {
            self.multi_filter.process(samples, sr);
        }

        // === DYNAMICS (compression) ===

        // 15. Compressor - single-band compression
        if self.settings.compressor.enabled {
            self.compressor.process(samples, sr);
            self.metering.compressor_reduction = self.compressor.get_reduction();
        }

        // 16. Multiband Compressor - frequency-specific compression
        if self.settings.multiband_compressor.enabled {
            self.multiband_compressor.process(samples, sr);
        }

        // === MODULATION EFFECTS ===

        // 17. Bitcrusher - lo-fi digital degradation
        if self.settings.bitcrusher.enabled {
            self.bitcrusher.process(samples, sr);
        }

        // 18. Ring Modulator - metallic/robotic modulation
        if self.settings.ring_modulator.enabled {
            self.ring_modulator.process(samples, sr);
        }

        // 19. Frequency Shifter - Bode-style shift
        if self.settings.frequency_shifter.enabled {
            self.frequency_shifter.process(samples, sr);
        }

        // 20. Rotary Speaker - Leslie simulation
        if self.settings.rotary_speaker.enabled {
            self.rotary_speaker.process(samples, sr);
        }

        // 21. Chorus - thickening with detuned copies
        if self.settings.chorus.enabled {
            self.chorus.process(samples, sr);
        }

        // 22. Flanger - jet/swoosh effect
        if self.settings.flanger.enabled {
            self.flanger.process(samples, sr);
        }

        // 23. Phaser - sweeping notches
        if self.settings.phaser.enabled {
            self.phaser.process(samples, sr);
        }

        // 24. Vibrato - pitch modulation
        if self.settings.vibrato.enabled {
            self.vibrato.process(samples, sr);
        }

        // 25. Tremolo - amplitude modulation
        if self.settings.tremolo.enabled {
            self.tremolo.process(samples, sr);
        }

        // 26. Auto Pan - stereo panning modulation
        if self.settings.auto_pan.enabled {
            self.auto_pan.process(samples, sr);
        }

        // 27. Vocal Doubler - ADT effect
        if self.settings.vocal_doubler.enabled {
            self.vocal_doubler.process(samples, sr);
        }

        // === DELAY EFFECTS ===

        // 28. Delay - single tap delay
        if self.settings.delay.enabled {
            self.delay.process(samples, sr);
        }

        // 29. Stereo Delay - independent L/R delays
        if self.settings.stereo_delay.enabled {
            self.stereo_delay.process(samples, sr);
        }

        // 30. Granular Delay - texture/pitch grains
        if self.settings.granular_delay.enabled {
            self.granular_delay.process(samples, sr);
        }

        // === SPATIAL/REVERB ===

        // 31. Room Simulator - early reflections + reverb
        if self.settings.room_simulator.enabled {
            self.room_simulator.process(samples, sr);
        }

        // 32. Reverb - algorithmic reverb
        if self.settings.reverb.enabled {
            self.reverb.process(samples, sr);
        }

        // 33. Shimmer Reverb - pitch-shifted reverb
        if self.settings.shimmer_reverb.enabled {
            self.shimmer_reverb.process(samples, sr);
        }

        // === STEREO ===

        // 34. Stereo Imager - width control
        if self.settings.stereo_imager.enabled {
            self.stereo_imager.process(samples, sr);
        }

        // === OUTPUT ===

        // 35. Limiter - brickwall safety limiter (always active when enabled)
        if self.settings.limiter.enabled {
            self.limiter.process(samples, sr);
            self.metering.limiter_reduction = self.limiter.get_reduction();
        }
    }

    pub fn reset(&mut self) {
        self.metering = EffectsMetering::default();

        // Reset all effects
        self.pitch_correction.reset();
        self.harmonizer.reset();
        self.formant_shifter.reset();

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
        self.frequency_shifter.reset();
        self.granular_delay.reset();
        self.rotary_speaker.reset();
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
