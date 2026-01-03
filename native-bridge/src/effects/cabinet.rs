//! Cabinet - speaker cabinet simulation using EQ-based approach
//!
//! Note: For authentic cabinet simulation, you'd use convolution with impulse responses.
//! This simplified version uses EQ curves to approximate common cabinet characteristics.

use super::dsp::{Biquad, BiquadType, DelayLine};
use super::types::{CabinetSettings, CabinetType, MicPosition};
use super::AudioEffect;

pub struct Cabinet {
    settings: CabinetSettings,
    // Cabinet resonance filter (lowpass + resonant peak)
    lp_filter_l: Biquad,
    lp_filter_r: Biquad,
    resonance_filter_l: Biquad,
    resonance_filter_r: Biquad,
    // High cut (speaker rolloff)
    high_cut_l: Biquad,
    high_cut_r: Biquad,
    // Low cut (cabinet resonance)
    low_cut_l: Biquad,
    low_cut_r: Biquad,
    // Mic position simulation (comb filter)
    room_delay_l: DelayLine,
    room_delay_r: DelayLine,
    sample_rate: f32,
}

impl Cabinet {
    pub fn new(sample_rate: u32) -> Self {
        let mut cab = Self {
            settings: CabinetSettings::default(),
            lp_filter_l: Biquad::new(),
            lp_filter_r: Biquad::new(),
            resonance_filter_l: Biquad::new(),
            resonance_filter_r: Biquad::new(),
            high_cut_l: Biquad::new(),
            high_cut_r: Biquad::new(),
            low_cut_l: Biquad::new(),
            low_cut_r: Biquad::new(),
            room_delay_l: DelayLine::new(0.02, sample_rate),
            room_delay_r: DelayLine::new(0.02, sample_rate),
            sample_rate: sample_rate as f32,
        };
        cab.update_filters();
        cab
    }

    pub fn update_settings(&mut self, settings: CabinetSettings) {
        self.settings = settings;
        self.update_filters();
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        self.room_delay_l = DelayLine::new(0.02, rate);
        self.room_delay_r = DelayLine::new(0.02, rate);
        self.update_filters();
    }

    fn update_filters(&mut self) {
        let (low_cut_freq, high_cut_freq, resonance_freq, resonance_q) =
            self.get_cabinet_params();

        // Low cut (remove subsonic)
        self.low_cut_l.configure(
            BiquadType::Highpass,
            low_cut_freq,
            0.707,
            0.0,
            self.sample_rate,
        );
        self.low_cut_r.configure(
            BiquadType::Highpass,
            low_cut_freq,
            0.707,
            0.0,
            self.sample_rate,
        );

        // Cabinet resonance
        self.resonance_filter_l.configure(
            BiquadType::Peak,
            resonance_freq,
            resonance_q,
            3.0, // 3dB boost at resonance
            self.sample_rate,
        );
        self.resonance_filter_r.configure(
            BiquadType::Peak,
            resonance_freq,
            resonance_q,
            3.0,
            self.sample_rate,
        );

        // High cut (speaker rolloff)
        let (high_cut, high_q) = self.get_mic_position_params();
        self.high_cut_l
            .configure(BiquadType::Lowpass, high_cut, high_q, 0.0, self.sample_rate);
        self.high_cut_r
            .configure(BiquadType::Lowpass, high_cut, high_q, 0.0, self.sample_rate);

        // Additional low-pass for speaker
        self.lp_filter_l.configure(
            BiquadType::Lowpass,
            high_cut_freq,
            0.5,
            0.0,
            self.sample_rate,
        );
        self.lp_filter_r.configure(
            BiquadType::Lowpass,
            high_cut_freq,
            0.5,
            0.0,
            self.sample_rate,
        );
    }

    fn get_cabinet_params(&self) -> (f32, f32, f32, f32) {
        // Returns (low_cut, high_cut, resonance_freq, resonance_q)
        match self.settings.cabinet_type {
            CabinetType::C1x12 => (80.0, 5000.0, 120.0, 1.5),
            CabinetType::C2x12 => (70.0, 5500.0, 100.0, 1.2),
            CabinetType::C4x12 => (60.0, 5000.0, 80.0, 1.0),
            CabinetType::C1x15 => (50.0, 4000.0, 60.0, 1.5),
            CabinetType::C2x10 => (100.0, 6000.0, 150.0, 1.0),
            CabinetType::Direct => (20.0, 20000.0, 1000.0, 0.5), // Minimal coloration
        }
    }

    fn get_mic_position_params(&self) -> (f32, f32) {
        // Returns (high_cut_freq, Q)
        match self.settings.mic_position {
            MicPosition::Center => (6000.0, 0.707), // Bright, focused
            MicPosition::Edge => (4000.0, 0.5),     // Darker, smoother
            MicPosition::Room => (3500.0, 0.4),    // Distant, ambient
            MicPosition::Blend => (5000.0, 0.6),   // Mix of center and edge
        }
    }
}

impl AudioEffect for Cabinet {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        // Skip processing for direct mode
        if matches!(self.settings.cabinet_type, CabinetType::Direct) {
            return;
        }

        let room_level = self.settings.room_level;
        let room_delay_samples = match self.settings.mic_position {
            MicPosition::Center => 0.5 * 0.001 * self.sample_rate,
            MicPosition::Edge => 1.0 * 0.001 * self.sample_rate,
            MicPosition::Room => 5.0 * 0.001 * self.sample_rate,
            MicPosition::Blend => 2.0 * 0.001 * self.sample_rate,
        };

        for frame in samples.chunks_mut(2) {
            let in_l = frame[0];
            let in_r = if frame.len() > 1 { frame[1] } else { frame[0] };

            // Low cut
            let lc_l = self.low_cut_l.process(in_l);
            let lc_r = self.low_cut_r.process(in_r);

            // Cabinet resonance
            let res_l = self.resonance_filter_l.process(lc_l);
            let res_r = self.resonance_filter_r.process(lc_r);

            // High cut (mic position)
            let hc_l = self.high_cut_l.process(res_l);
            let hc_r = self.high_cut_r.process(res_r);

            // Speaker rolloff
            let sp_l = self.lp_filter_l.process(hc_l);
            let sp_r = self.lp_filter_r.process(hc_r);

            // Room ambience (simple delay)
            self.room_delay_l.write(sp_l);
            self.room_delay_r.write(sp_r);
            let room_l = self.room_delay_l.read_interpolated(room_delay_samples);
            let room_r = self.room_delay_r.read_interpolated(room_delay_samples);

            // Mix direct and room
            frame[0] = sp_l * (1.0 - room_level * 0.5) + room_l * room_level * 0.5;
            if frame.len() > 1 {
                frame[1] = sp_r * (1.0 - room_level * 0.5) + room_r * room_level * 0.5;
            }
        }
    }

    fn reset(&mut self) {
        self.lp_filter_l.reset();
        self.lp_filter_r.reset();
        self.resonance_filter_l.reset();
        self.resonance_filter_r.reset();
        self.high_cut_l.reset();
        self.high_cut_r.reset();
        self.low_cut_l.reset();
        self.low_cut_r.reset();
        self.room_delay_l.reset();
        self.room_delay_r.reset();
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
