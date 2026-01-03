//! TUI Application State

use std::collections::VecDeque;
use std::time::Instant;

/// Events that can update the TUI state
#[derive(Debug, Clone)]
pub enum AppEvent {
    /// Audio level update (input_l, input_r, output_l, output_r) in dB
    AudioLevels {
        input_l: f32,
        input_r: f32,
        output_l: f32,
        output_r: f32,
    },
    /// Effects metering update
    EffectsMetering {
        noise_gate_open: bool,
        compressor_reduction: f32,
        limiter_reduction: f32,
    },
    /// Network state changed
    NetworkState {
        connected: bool,
        mode: NetworkMode,
        peer_count: usize,
        latency_ms: f32,
        packet_loss: f32,
    },
    /// Room context updated
    RoomContext {
        room_id: Option<String>,
        user_count: usize,
        key: Option<String>,
        scale: Option<String>,
        bpm: Option<f32>,
    },
    /// Audio device info
    DeviceInfo {
        input_device: String,
        output_device: String,
        sample_rate: u32,
        buffer_size: u32,
    },
    /// Effect enabled/disabled
    EffectToggled {
        name: String,
        enabled: bool,
    },
    /// Log message
    Log {
        level: LogLevel,
        message: String,
    },
    /// Connection event
    ConnectionEvent {
        event_type: ConnectionEventType,
        peer_id: Option<String>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NetworkMode {
    Disconnected,
    Connecting,
    P2P,
    Relay,
    Hybrid,
}

impl std::fmt::Display for NetworkMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            NetworkMode::Disconnected => write!(f, "Disconnected"),
            NetworkMode::Connecting => write!(f, "Connecting..."),
            NetworkMode::P2P => write!(f, "P2P Direct"),
            NetworkMode::Relay => write!(f, "MoQ Relay"),
            NetworkMode::Hybrid => write!(f, "Hybrid"),
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone)]
pub enum ConnectionEventType {
    BrowserConnected,
    BrowserDisconnected,
    RoomJoined,
    RoomLeft,
    PeerJoined,
    PeerLeft,
    RelayConnected,
    RelayDisconnected,
}

/// Effect status for display
#[derive(Debug, Clone)]
pub struct EffectStatus {
    pub name: String,
    pub enabled: bool,
    pub category: EffectCategory,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EffectCategory {
    Guitar,
    Dynamics,
    Modulation,
    TimeBased,
    Pitch,
    Spatial,
}

impl std::fmt::Display for EffectCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EffectCategory::Guitar => write!(f, "Guitar"),
            EffectCategory::Dynamics => write!(f, "Dynamics"),
            EffectCategory::Modulation => write!(f, "Modulation"),
            EffectCategory::TimeBased => write!(f, "Time"),
            EffectCategory::Pitch => write!(f, "Pitch"),
            EffectCategory::Spatial => write!(f, "Spatial"),
        }
    }
}

/// Log entry
#[derive(Debug, Clone)]
pub struct LogEntry {
    pub timestamp: Instant,
    pub level: LogLevel,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActivePanel {
    Audio,
    Effects,
    Network,
    Logs,
}

/// Main TUI application state
pub struct App {
    // Quit flag
    should_quit: bool,

    // UI state
    pub active_panel: ActivePanel,
    pub show_help: bool,
    pub effects_scroll: usize,
    pub logs_scroll: usize,

    // Audio state
    pub input_level_l: f32,
    pub input_level_r: f32,
    pub output_level_l: f32,
    pub output_level_r: f32,
    pub input_peak_l: f32,
    pub input_peak_r: f32,
    pub output_peak_l: f32,
    pub output_peak_r: f32,
    peak_hold_time: Instant,

    // Effects metering
    pub noise_gate_open: bool,
    pub compressor_reduction: f32,
    pub limiter_reduction: f32,

    // Effects chain
    pub effects: Vec<EffectStatus>,

    // Network state
    pub network_connected: bool,
    pub network_mode: NetworkMode,
    pub peer_count: usize,
    pub latency_ms: f32,
    pub packet_loss: f32,
    pub latency_history: VecDeque<f32>,

    // Room context
    pub room_id: Option<String>,
    pub user_count: usize,
    pub room_key: Option<String>,
    pub room_scale: Option<String>,
    pub room_bpm: Option<f32>,

    // Device info
    pub input_device: String,
    pub output_device: String,
    pub sample_rate: u32,
    pub buffer_size: u32,

    // Logs
    pub logs: VecDeque<LogEntry>,
    max_logs: usize,

    // Stats
    pub uptime: Instant,
    pub frames_processed: u64,
}

impl App {
    pub fn new() -> Self {
        let effects = Self::init_effects();

        Self {
            should_quit: false,
            active_panel: ActivePanel::Audio,
            show_help: false,
            effects_scroll: 0,
            logs_scroll: 0,

            input_level_l: -60.0,
            input_level_r: -60.0,
            output_level_l: -60.0,
            output_level_r: -60.0,
            input_peak_l: -60.0,
            input_peak_r: -60.0,
            output_peak_l: -60.0,
            output_peak_r: -60.0,
            peak_hold_time: Instant::now(),

            noise_gate_open: false,
            compressor_reduction: 0.0,
            limiter_reduction: 0.0,

            effects,

            network_connected: false,
            network_mode: NetworkMode::Disconnected,
            peer_count: 0,
            latency_ms: 0.0,
            packet_loss: 0.0,
            latency_history: VecDeque::with_capacity(60),

            room_id: None,
            user_count: 0,
            room_key: None,
            room_scale: None,
            room_bpm: None,

            input_device: "None".to_string(),
            output_device: "None".to_string(),
            sample_rate: 48000,
            buffer_size: 256,

            logs: VecDeque::with_capacity(100),
            max_logs: 100,

            uptime: Instant::now(),
            frames_processed: 0,
        }
    }

    fn init_effects() -> Vec<EffectStatus> {
        vec![
            // Guitar effects
            EffectStatus { name: "Wah".into(), enabled: false, category: EffectCategory::Guitar },
            EffectStatus { name: "Overdrive".into(), enabled: false, category: EffectCategory::Guitar },
            EffectStatus { name: "Distortion".into(), enabled: false, category: EffectCategory::Guitar },
            EffectStatus { name: "Amp Sim".into(), enabled: false, category: EffectCategory::Guitar },
            EffectStatus { name: "Cabinet".into(), enabled: false, category: EffectCategory::Guitar },

            // Dynamics
            EffectStatus { name: "Noise Gate".into(), enabled: false, category: EffectCategory::Dynamics },
            EffectStatus { name: "Compressor".into(), enabled: false, category: EffectCategory::Dynamics },
            EffectStatus { name: "De-Esser".into(), enabled: false, category: EffectCategory::Dynamics },
            EffectStatus { name: "Transient".into(), enabled: false, category: EffectCategory::Dynamics },
            EffectStatus { name: "Multiband".into(), enabled: false, category: EffectCategory::Dynamics },
            EffectStatus { name: "Exciter".into(), enabled: false, category: EffectCategory::Dynamics },
            EffectStatus { name: "Limiter".into(), enabled: false, category: EffectCategory::Dynamics },

            // Modulation
            EffectStatus { name: "Chorus".into(), enabled: false, category: EffectCategory::Modulation },
            EffectStatus { name: "Flanger".into(), enabled: false, category: EffectCategory::Modulation },
            EffectStatus { name: "Phaser".into(), enabled: false, category: EffectCategory::Modulation },
            EffectStatus { name: "Tremolo".into(), enabled: false, category: EffectCategory::Modulation },
            EffectStatus { name: "Vibrato".into(), enabled: false, category: EffectCategory::Modulation },
            EffectStatus { name: "Auto Pan".into(), enabled: false, category: EffectCategory::Modulation },
            EffectStatus { name: "Rotary".into(), enabled: false, category: EffectCategory::Modulation },
            EffectStatus { name: "Ring Mod".into(), enabled: false, category: EffectCategory::Modulation },

            // Time-based
            EffectStatus { name: "Delay".into(), enabled: false, category: EffectCategory::TimeBased },
            EffectStatus { name: "Stereo Delay".into(), enabled: false, category: EffectCategory::TimeBased },
            EffectStatus { name: "Granular".into(), enabled: false, category: EffectCategory::TimeBased },

            // Pitch
            EffectStatus { name: "Pitch Correct".into(), enabled: false, category: EffectCategory::Pitch },
            EffectStatus { name: "Harmonizer".into(), enabled: false, category: EffectCategory::Pitch },
            EffectStatus { name: "Formant".into(), enabled: false, category: EffectCategory::Pitch },
            EffectStatus { name: "Freq Shift".into(), enabled: false, category: EffectCategory::Pitch },
            EffectStatus { name: "Vocal Double".into(), enabled: false, category: EffectCategory::Pitch },

            // Spatial
            EffectStatus { name: "EQ".into(), enabled: false, category: EffectCategory::Spatial },
            EffectStatus { name: "Reverb".into(), enabled: false, category: EffectCategory::Spatial },
            EffectStatus { name: "Room Sim".into(), enabled: false, category: EffectCategory::Spatial },
            EffectStatus { name: "Shimmer".into(), enabled: false, category: EffectCategory::Spatial },
            EffectStatus { name: "Stereo Img".into(), enabled: false, category: EffectCategory::Spatial },
            EffectStatus { name: "Multi Filter".into(), enabled: false, category: EffectCategory::Spatial },
            EffectStatus { name: "Bitcrusher".into(), enabled: false, category: EffectCategory::Spatial },
        ]
    }

    pub fn handle_event(&mut self, event: AppEvent) {
        match event {
            AppEvent::AudioLevels { input_l, input_r, output_l, output_r } => {
                self.input_level_l = input_l;
                self.input_level_r = input_r;
                self.output_level_l = output_l;
                self.output_level_r = output_r;

                // Update peaks with hold
                if input_l > self.input_peak_l || self.peak_hold_time.elapsed().as_secs() > 2 {
                    self.input_peak_l = input_l;
                }
                if input_r > self.input_peak_r || self.peak_hold_time.elapsed().as_secs() > 2 {
                    self.input_peak_r = input_r;
                }
                if output_l > self.output_peak_l || self.peak_hold_time.elapsed().as_secs() > 2 {
                    self.output_peak_l = output_l;
                    self.peak_hold_time = Instant::now();
                }
                if output_r > self.output_peak_r || self.peak_hold_time.elapsed().as_secs() > 2 {
                    self.output_peak_r = output_r;
                    self.peak_hold_time = Instant::now();
                }

                self.frames_processed += 1;
            }
            AppEvent::EffectsMetering { noise_gate_open, compressor_reduction, limiter_reduction } => {
                self.noise_gate_open = noise_gate_open;
                self.compressor_reduction = compressor_reduction;
                self.limiter_reduction = limiter_reduction;
            }
            AppEvent::NetworkState { connected, mode, peer_count, latency_ms, packet_loss } => {
                self.network_connected = connected;
                self.network_mode = mode;
                self.peer_count = peer_count;
                self.latency_ms = latency_ms;
                self.packet_loss = packet_loss;

                // Track latency history
                self.latency_history.push_back(latency_ms);
                if self.latency_history.len() > 60 {
                    self.latency_history.pop_front();
                }
            }
            AppEvent::RoomContext { room_id, user_count, key, scale, bpm } => {
                self.room_id = room_id;
                self.user_count = user_count;
                self.room_key = key;
                self.room_scale = scale;
                self.room_bpm = bpm;
            }
            AppEvent::DeviceInfo { input_device, output_device, sample_rate, buffer_size } => {
                self.input_device = input_device;
                self.output_device = output_device;
                self.sample_rate = sample_rate;
                self.buffer_size = buffer_size;
            }
            AppEvent::EffectToggled { name, enabled } => {
                if let Some(effect) = self.effects.iter_mut().find(|e| e.name == name) {
                    effect.enabled = enabled;
                }
            }
            AppEvent::Log { level, message } => {
                self.logs.push_back(LogEntry {
                    timestamp: Instant::now(),
                    level,
                    message,
                });
                if self.logs.len() > self.max_logs {
                    self.logs.pop_front();
                }
            }
            AppEvent::ConnectionEvent { event_type, peer_id } => {
                let msg = match event_type {
                    ConnectionEventType::BrowserConnected => "Browser connected".to_string(),
                    ConnectionEventType::BrowserDisconnected => "Browser disconnected".to_string(),
                    ConnectionEventType::RoomJoined => "Joined room".to_string(),
                    ConnectionEventType::RoomLeft => "Left room".to_string(),
                    ConnectionEventType::PeerJoined => format!("Peer joined: {}", peer_id.unwrap_or_default()),
                    ConnectionEventType::PeerLeft => format!("Peer left: {}", peer_id.unwrap_or_default()),
                    ConnectionEventType::RelayConnected => "Relay connected".to_string(),
                    ConnectionEventType::RelayDisconnected => "Relay disconnected".to_string(),
                };
                self.logs.push_back(LogEntry {
                    timestamp: Instant::now(),
                    level: LogLevel::Info,
                    message: msg,
                });
            }
        }
    }

    pub fn on_tick(&mut self) {
        // Decay levels slightly for visual smoothing
        self.input_level_l = (self.input_level_l - 0.5).max(-60.0);
        self.input_level_r = (self.input_level_r - 0.5).max(-60.0);
        self.output_level_l = (self.output_level_l - 0.5).max(-60.0);
        self.output_level_r = (self.output_level_r - 0.5).max(-60.0);
    }

    pub fn should_quit(&self) -> bool {
        self.should_quit
    }

    pub fn quit(&mut self) {
        self.should_quit = true;
    }

    pub fn toggle_effects_panel(&mut self) {
        self.active_panel = if self.active_panel == ActivePanel::Effects {
            ActivePanel::Audio
        } else {
            ActivePanel::Effects
        };
    }

    pub fn toggle_network_panel(&mut self) {
        self.active_panel = if self.active_panel == ActivePanel::Network {
            ActivePanel::Audio
        } else {
            ActivePanel::Network
        };
    }

    pub fn toggle_help(&mut self) {
        self.show_help = !self.show_help;
    }

    pub fn scroll_effects_up(&mut self) {
        if self.effects_scroll > 0 {
            self.effects_scroll -= 1;
        }
    }

    pub fn scroll_effects_down(&mut self) {
        if self.effects_scroll < self.effects.len().saturating_sub(10) {
            self.effects_scroll += 1;
        }
    }

    pub fn next_panel(&mut self) {
        self.active_panel = match self.active_panel {
            ActivePanel::Audio => ActivePanel::Effects,
            ActivePanel::Effects => ActivePanel::Network,
            ActivePanel::Network => ActivePanel::Logs,
            ActivePanel::Logs => ActivePanel::Audio,
        };
    }

    pub fn prev_panel(&mut self) {
        self.active_panel = match self.active_panel {
            ActivePanel::Audio => ActivePanel::Logs,
            ActivePanel::Effects => ActivePanel::Audio,
            ActivePanel::Network => ActivePanel::Effects,
            ActivePanel::Logs => ActivePanel::Network,
        };
    }

    pub fn uptime_str(&self) -> String {
        let secs = self.uptime.elapsed().as_secs();
        let hours = secs / 3600;
        let mins = (secs % 3600) / 60;
        let secs = secs % 60;
        format!("{:02}:{:02}:{:02}", hours, mins, secs)
    }

    pub fn enabled_effects_count(&self) -> usize {
        self.effects.iter().filter(|e| e.enabled).count()
    }
}

impl Default for App {
    fn default() -> Self {
        Self::new()
    }
}
