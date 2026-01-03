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
    // TUI is enabled by default, use --headless to disable
    let enable_tui = !std::env::args().any(|arg| arg == "--headless" || arg == "-h");

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
        // Run TUI mode with LocalSet to allow non-Send futures
        // AppState contains cpal::Stream which has RefCell closures (not Send)
        // LocalSet allows spawning non-Send futures on a single-threaded executor
        info!("Starting TUI interface...");

        let tui_rx = tui_rx.unwrap();

        // Create TUI app
        let app = tui::App::new();

        // Use LocalSet to run both WebSocket server and TUI on same thread
        let local = tokio::task::LocalSet::new();
        local.run_until(async move {
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

            // Spawn WebSocket server in background local task (non-Send safe)
            let server_state = state.clone();
            tokio::task::spawn_local(async move {
                if let Err(e) = protocol::run_server("127.0.0.1:9999", server_state).await {
                    tracing::error!("WebSocket server error: {}", e);
                }
            });

            // Small delay to ensure server is listening before TUI takes over terminal
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

            // Run TUI on main thread
            if let Err(e) = tui::run(app, tui_rx).await {
                tracing::error!("TUI error: {}", e);
            }
        }).await;
    } else {
        // Run headless mode
        info!("Bridge running on ws://localhost:9999 (headless mode)");
        info!("Press Ctrl+C to quit");

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
