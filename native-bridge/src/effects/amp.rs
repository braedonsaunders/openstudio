//! Amp - guitar/bass amplifier simulation with preamp, tonestack, and power amp

use super::dsp::{soft_clip, Biquad, BiquadType};
use super::types::{AmpSettings, AmpType};
use super::AudioEffect;

pub struct Amp {
    settings: AmpSettings,
    // Input stage
    input_hp: Biquad,
    // Tonestack (3-band EQ)
    bass_filter: Biquad,
    mid_filter: Biquad,
    treble_filter: Biquad,
    // Presence (high shelf)
    presence_filter: Biquad,
    // Power amp filter
    power_lp: Biquad,
    sample_rate: f32,
}

impl Amp {
    pub fn new(sample_rate: u32) -> Self {
        let mut amp = Self {
            settings: AmpSettings::default(),
            input_hp: Biquad::new(),
            bass_filter: Biquad::new(),
            mid_filter: Biquad::new(),
            treble_filter: Biquad::new(),
            presence_filter: Biquad::new(),
            power_lp: Biquad::new(),
            sample_rate: sample_rate as f32,
        };
        amp.update_filters();
        amp
    }

    pub fn update_settings(&mut self, settings: AmpSettings) {
        self.settings = settings;
        self.update_filters();
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        self.update_filters();
    }

    fn update_filters(&mut self) {
        // Get amp character frequencies based on type
        let (bass_freq, mid_freq, treble_freq) = self.get_tonestack_freqs();

        // Input highpass (remove subsonic)
        self.input_hp
            .configure(BiquadType::Highpass, 40.0, 0.707, 0.0, self.sample_rate);

        // Bass control (low shelf)
        let bass_gain = (self.settings.bass - 0.5) * 24.0; // -12 to +12 dB
        self.bass_filter.configure(
            BiquadType::LowShelf,
            bass_freq,
            0.707,
            bass_gain,
            self.sample_rate,
        );

        // Mid control (peak)
        let mid_gain = (self.settings.mid - 0.5) * 24.0;
        self.mid_filter
            .configure(BiquadType::Peak, mid_freq, 1.0, mid_gain, self.sample_rate);

        // Treble control (high shelf)
        let treble_gain = (self.settings.treble - 0.5) * 24.0;
        self.treble_filter.configure(
            BiquadType::HighShelf,
            treble_freq,
            0.707,
            treble_gain,
            self.sample_rate,
        );

        // Presence control
        let presence_gain = (self.settings.presence - 0.5) * 12.0;
        self.presence_filter.configure(
            BiquadType::HighShelf,
            4000.0,
            0.707,
            presence_gain,
            self.sample_rate,
        );

        // Power amp lowpass (speaker simulation)
        self.power_lp
            .configure(BiquadType::Lowpass, 6000.0, 0.707, 0.0, self.sample_rate);
    }

    fn get_tonestack_freqs(&self) -> (f32, f32, f32) {
        match self.settings.amp_type {
            AmpType::Clean => (100.0, 800.0, 3000.0),
            AmpType::Crunch => (120.0, 750.0, 2800.0),
            AmpType::Highgain => (80.0, 600.0, 3500.0),
            AmpType::British => (100.0, 650.0, 3200.0),
            AmpType::American => (90.0, 800.0, 2500.0),
            AmpType::Modern => (70.0, 500.0, 4000.0),
        }
    }

    /// Get preamp character based on amp type
    fn get_preamp_drive(&self) -> f32 {
        let base_drive = 1.0 + self.settings.gain * 10.0;
        match self.settings.amp_type {
            AmpType::Clean => base_drive * 0.5,
            AmpType::Crunch => base_drive * 1.0,
            AmpType::Highgain => base_drive * 2.0,
            AmpType::British => base_drive * 1.2,
            AmpType::American => base_drive * 0.8,
            AmpType::Modern => base_drive * 2.5,
        }
    }

    /// Preamp stage clipping
    #[inline]
    fn preamp_clip(&self, x: f32, drive: f32) -> f32 {
        let driven = x * drive;
        match self.settings.amp_type {
            AmpType::Clean => {
                // Very soft clipping
                if driven.abs() > 0.8 {
                    driven.signum() * (0.8 + (driven.abs() - 0.8).tanh() * 0.2)
                } else {
                    driven
                }
            }
            AmpType::Crunch | AmpType::British => {
                // Tube-like asymmetric
                if driven >= 0.0 {
                    soft_clip(driven * 0.9) / 0.9
                } else {
                    soft_clip(driven * 1.1) / 1.1
                }
            }
            AmpType::Highgain | AmpType::Modern => {
                // Hard clipping with tube saturation
                soft_clip(driven)
            }
            AmpType::American => {
                // Scooped clean to mild breakup
                soft_clip(driven * 0.8) / 0.8
            }
        }
    }

    /// Power amp stage
    #[inline]
    fn poweramp_clip(&self, x: f32) -> f32 {
        // Power amp adds subtle compression
        let master = self.settings.master;
        let driven = x * (1.0 + master * 3.0);

        // Soft compression at power amp stage
        if driven.abs() > 0.5 {
            driven.signum() * (0.5 + (driven.abs() - 0.5).tanh() * 0.5)
        } else {
            driven
        }
    }
}

impl AudioEffect for Amp {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let drive = self.get_preamp_drive();
        let master = self.settings.master;

        for frame in samples.chunks_mut(2) {
            // Input stage
            let in_l = self.input_hp.process(frame[0]);
            let in_r = if frame.len() > 1 {
                self.input_hp.process(frame[1])
            } else {
                in_l
            };

            // Preamp clipping
            let preamp_l = self.preamp_clip(in_l, drive);
            let preamp_r = self.preamp_clip(in_r, drive);

            // Tonestack
            let bass_l = self.bass_filter.process(preamp_l);
            let mid_l = self.mid_filter.process(bass_l);
            let treble_l = self.treble_filter.process(mid_l);

            let bass_r = self.bass_filter.process(preamp_r);
            let mid_r = self.mid_filter.process(bass_r);
            let treble_r = self.treble_filter.process(mid_r);

            // Power amp
            let power_l = self.poweramp_clip(treble_l);
            let power_r = self.poweramp_clip(treble_r);

            // Presence and output filter
            let presence_l = self.presence_filter.process(power_l);
            let presence_r = self.presence_filter.process(power_r);

            let out_l = self.power_lp.process(presence_l);
            let out_r = self.power_lp.process(presence_r);

            frame[0] = out_l * master;
            if frame.len() > 1 {
                frame[1] = out_r * master;
            }
        }
    }

    fn reset(&mut self) {
        self.input_hp.reset();
        self.bass_filter.reset();
        self.mid_filter.reset();
        self.treble_filter.reset();
        self.presence_filter.reset();
        self.power_lp.reset();
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
