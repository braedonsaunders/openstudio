//! OpenStudio Native Audio Bridge
//!
//! Provides ultra-low-latency audio I/O via ASIO (Windows) / CoreAudio (macOS)
//! with P2P/relay networking using the OpenStudio Protocol (OSP).
//!
//! Communicates with browser via WebSocket on localhost:9999

mod audio;
mod effects;
mod mixing;
mod network;
mod protocol;
mod tui;

use anyhow::Result;
use network::{NetworkConfig, NetworkManager};
use protocol::LaunchParams;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use tracing::{info, Level};

/// Application state shared across all components
pub struct AppState {
    pub audio_engine: audio::AudioEngine,
    pub mixer: mixing::Mixer,
    pub network: Option<Arc<NetworkManager>>,
    /// Audio-network bridge (started when joining a room)
    pub audio_bridge: Option<network::bridge::AudioNetworkBridge>,
    pub connected_room: Option<String>,
    pub user_id: Option<String>,
    pub user_name: Option<String>,
    /// TUI event sender (if TUI mode is enabled)
    pub tui_tx: Option<mpsc::Sender<tui::AppEvent>>,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Check for TUI mode flag
    let enable_tui = std::env::args().any(|arg| arg == "--tui" || arg == "-t");

    // Initialize logging (only to file/quiet when TUI is enabled)
    if enable_tui {
        // Minimal logging when TUI is active
        tracing_subscriber::fmt()
            .with_max_level(Level::WARN)
            .with_target(false)
            .compact()
            .init();
    } else {
        tracing_subscriber::fmt()
            .with_max_level(Level::INFO)
            .with_target(false)
            .compact()
            .init();
    }

    info!("OpenStudio Bridge v{}", env!("CARGO_PKG_VERSION"));

    // Parse launch params (from custom protocol or CLI)
    let params = LaunchParams::from_args();

    if let Some(ref room) = params.room_id {
        info!("Auto-connecting to room: {}", room);
    }

    // Create TUI event channel if TUI mode is enabled
    let (tui_tx, tui_rx) = if enable_tui {
        let (tx, rx) = mpsc::channel::<tui::AppEvent>(256);
        (Some(tx), Some(rx))
    } else {
        (None, None)
    };

    // Initialize audio engine
    let audio_engine = audio::AudioEngine::new()?;

    // Initialize mixer
    let mixer = mixing::Mixer::new();

    // Initialize network manager with proper Arc-based self-reference
    let network_config = NetworkConfig::default();
    let network = match NetworkManager::new_shared(network_config) {
        Ok(nm) => {
            info!("Network manager initialized");
            Some(nm)
        }
        Err(e) => {
            info!("Network manager failed to initialize: {} (P2P disabled)", e);
            None
        }
    };

    // Get device info for TUI
    let (input_device, output_device, sample_rate, buffer_size) = {
        let device_info = audio_engine.get_device_info();
        (
            device_info.input_device.clone(),
            device_info.output_device.clone(),
            device_info.sample_rate,
            device_info.buffer_size,
        )
    };

    // Create shared state
    let state = Arc::new(Mutex::new(AppState {
        audio_engine,
        mixer,
        network,
        audio_bridge: None,
        connected_room: params.room_id.clone(),
        user_id: params.user_id.clone(),
        user_name: params.user_name.clone(),
        tui_tx: tui_tx.clone(),
    }));

    if enable_tui {
        // Run TUI mode
        info!("Starting TUI interface...");

        let tui_rx = tui_rx.unwrap();

        // Create TUI app
        let app = tui::App::new();

        // Send initial device info
        if let Some(tx) = &tui_tx {
            let _ = tx.send(tui::AppEvent::DeviceInfo {
                input_device,
                output_device,
                sample_rate,
                buffer_size,
            }).await;

            let _ = tx.send(tui::AppEvent::Log {
                level: tui::LogLevel::Info,
                message: format!("OpenStudio Bridge v{} started", env!("CARGO_PKG_VERSION")),
            }).await;
        }

        // Run TUI and WebSocket server concurrently using select!
        // This avoids the Send requirement of tokio::spawn
        tokio::select! {
            result = tui::run(app, tui_rx) => {
                if let Err(e) = result {
                    tracing::error!("TUI error: {}", e);
                }
            }
            result = protocol::run_server("127.0.0.1:9999", state.clone()) => {
                if let Err(e) = result {
                    tracing::error!("WebSocket server error: {}", e);
                }
            }
        }
    } else {
        // Run headless mode (original behavior)
        info!("Bridge running on ws://localhost:9999");
        info!("Press Ctrl+C to quit");
        info!("Run with --tui flag for terminal interface");

        protocol::run_server("127.0.0.1:9999", state).await?;
    }

    Ok(())
}

/// Register custom protocol handler (openstudio://)
#[allow(dead_code)]
pub fn register_protocol_handler() -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let (key, _) = hkcu.create_subkey(r"Software\Classes\openstudio")?;
        key.set_value("", &"URL:OpenStudio Protocol")?;
        key.set_value("URL Protocol", &"")?;

        let (cmd_key, _) = hkcu.create_subkey(r"Software\Classes\openstudio\shell\open\command")?;
        let exe_path = std::env::current_exe()?;
        cmd_key.set_value("", &format!("\"{}\" \"%1\"", exe_path.display()))?;

        info!("Registered openstudio:// protocol handler");
    }

    #[cfg(not(target_os = "windows"))]
    {
        info!("Protocol handler registration not implemented for this platform");
    }

    Ok(())
}
