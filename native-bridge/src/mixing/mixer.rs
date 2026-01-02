//! Audio mixer - mixes local tracks, remote users, and backing tracks

use super::{MasterEffectsSettings, RemoteUser, Track, TrackState};
use crate::effects::EffectsChain;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Backing track stem state
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StemState {
    pub enabled: bool,
    pub volume: f32,
}

/// Backing track state
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackingTrackState {
    pub is_loaded: bool,
    pub is_playing: bool,
    pub current_time: f32,
    pub duration: f32,
    pub volume: f32,
    pub stems: HashMap<String, StemState>,
}

/// The main audio mixer
pub struct Mixer {
    // Local tracks
    local_tracks: HashMap<String, Track>,

    // Remote users
    remote_users: HashMap<String, RemoteUser>,

    // Backing track
    backing_track: BackingTrackState,

    // Master settings
    master_volume: f32,
    master_effects_enabled: bool,
    master_effects: MasterEffectsSettings,

    // Effects chains
    local_effects_chain: EffectsChain,
    master_effects_chain: EffectsChain,

    // Solo state
    any_solo: bool,
}

impl Mixer {
    pub fn new() -> Self {
        Self {
            local_tracks: HashMap::new(),
            remote_users: HashMap::new(),
            backing_track: BackingTrackState::default(),
            master_volume: 1.0,
            master_effects_enabled: true,
            master_effects: MasterEffectsSettings::default(),
            local_effects_chain: EffectsChain::new(),
            master_effects_chain: EffectsChain::new(),
            any_solo: false,
        }
    }

    // === Local Track Management ===

    pub fn add_local_track(&mut self, track: Track) {
        self.local_tracks.insert(track.id.clone(), track);
        self.update_solo_state();
    }

    pub fn remove_local_track(&mut self, track_id: &str) {
        self.local_tracks.remove(track_id);
        self.update_solo_state();
    }

    pub fn update_local_track(&mut self, track_id: &str, state: TrackState) {
        if let Some(track) = self.local_tracks.get_mut(track_id) {
            track.state = state;
        }
        self.update_solo_state();
    }

    pub fn get_local_track(&self, track_id: &str) -> Option<&Track> {
        self.local_tracks.get(track_id)
    }

    pub fn get_all_local_tracks(&self) -> Vec<&Track> {
        self.local_tracks.values().collect()
    }

    // === Remote User Management ===

    pub fn add_remote_user(&mut self, user: RemoteUser) {
        self.remote_users.insert(user.user_id.clone(), user);
    }

    pub fn remove_remote_user(&mut self, user_id: &str) {
        self.remote_users.remove(user_id);
    }

    pub fn update_remote_user(&mut self, user_id: &str, volume: f32, muted: bool, delay_ms: f32) {
        if let Some(user) = self.remote_users.get_mut(user_id) {
            user.volume = volume;
            user.is_muted = muted;
            user.compensation_delay_ms = delay_ms;
        }
    }

    pub fn set_remote_user_level(&mut self, user_id: &str, level: f32) {
        if let Some(user) = self.remote_users.get_mut(user_id) {
            user.level = level;
        }
    }

    pub fn get_remote_user(&self, user_id: &str) -> Option<&RemoteUser> {
        self.remote_users.get(user_id)
    }

    pub fn get_all_remote_users(&self) -> Vec<&RemoteUser> {
        self.remote_users.values().collect()
    }

    // === Backing Track ===

    pub fn set_backing_track_state(&mut self, state: BackingTrackState) {
        self.backing_track = state;
    }

    pub fn set_backing_track_volume(&mut self, volume: f32) {
        self.backing_track.volume = volume;
    }

    pub fn set_stem_state(&mut self, stem_name: &str, enabled: bool, volume: f32) {
        self.backing_track
            .stems
            .insert(stem_name.to_string(), StemState { enabled, volume });
    }

    pub fn get_backing_track_state(&self) -> &BackingTrackState {
        &self.backing_track
    }

    // === Master Controls ===

    pub fn set_master_volume(&mut self, volume: f32) {
        self.master_volume = volume;
    }

    pub fn get_master_volume(&self) -> f32 {
        self.master_volume
    }

    pub fn set_master_effects_enabled(&mut self, enabled: bool) {
        self.master_effects_enabled = enabled;
    }

    pub fn update_master_effects(&mut self, settings: MasterEffectsSettings) {
        self.master_effects = settings;
    }

    pub fn get_master_effects(&self) -> &MasterEffectsSettings {
        &self.master_effects
    }

    // === Audio Processing ===

    /// Process local audio through effects chain
    pub fn process_local_audio(&mut self, track_id: &str, samples: &mut [f32]) {
        if let Some(track) = self.local_tracks.get(track_id) {
            // Apply input gain
            let gain = track.state.input_gain_linear();
            for sample in samples.iter_mut() {
                *sample *= gain;
            }

            // Check if audio should pass
            if !track.state.should_pass_audio(self.any_solo) {
                for sample in samples.iter_mut() {
                    *sample = 0.0;
                }
                return;
            }

            // Apply track effects
            // TODO: Use per-track effects chain
            self.local_effects_chain.process(samples);

            // Apply track volume
            for sample in samples.iter_mut() {
                *sample *= track.state.volume;
            }
        }
    }

    /// Mix all audio sources into output buffer
    pub fn mix_to_output(
        &mut self,
        output: &mut [f32],
        local_audio: &[f32],
        remote_audio: &HashMap<String, Vec<f32>>,
        backing_audio: Option<&[f32]>,
    ) {
        // Clear output
        for sample in output.iter_mut() {
            *sample = 0.0;
        }

        // Add local audio
        for (i, sample) in local_audio.iter().enumerate() {
            if i < output.len() {
                output[i] += sample;
            }
        }

        // Add remote audio (with per-user volume and mute)
        for (user_id, audio) in remote_audio {
            if let Some(user) = self.remote_users.get(user_id) {
                if !user.is_muted {
                    for (i, sample) in audio.iter().enumerate() {
                        if i < output.len() {
                            output[i] += sample * user.volume;
                        }
                    }
                }
            }
        }

        // Add backing track
        if let Some(backing) = backing_audio {
            if self.backing_track.is_playing {
                for (i, sample) in backing.iter().enumerate() {
                    if i < output.len() {
                        output[i] += sample * self.backing_track.volume;
                    }
                }
            }
        }

        // Apply master effects
        if self.master_effects_enabled {
            self.master_effects_chain.process(output);
        }

        // Apply master volume
        for sample in output.iter_mut() {
            *sample *= self.master_volume;
        }
    }

    /// Create broadcast mix (for sending to WebRTC)
    /// Only includes local audio (after effects), NOT remote users or backing track
    pub fn create_broadcast_mix(&mut self, local_audio: &[f32]) -> Vec<f32> {
        // Broadcast is just the processed local audio
        // Remote users and backing track stay local only
        local_audio.to_vec()
    }

    // === Internal Helpers ===

    fn update_solo_state(&mut self) {
        self.any_solo = self.local_tracks.values().any(|t| t.state.is_solo);
    }
}
