//! Terminal User Interface for OpenStudio Native Bridge
//! Provides real-time monitoring of audio, effects, and network status

mod app;
mod ui;
mod widgets;

pub use app::{ActivePanel, App, AppEvent, ConnectionEventType, LogLevel, NetworkMode};
pub use ui::draw;

use crossterm::{
    event::{
        DisableMouseCapture, EnableMouseCapture, Event, EventStream, KeyCode, KeyEventKind,
        KeyModifiers,
    },
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use futures_util::StreamExt;
use ratatui::{backend::CrosstermBackend, Terminal};
use std::io;
use std::time::Duration;
use tokio::sync::mpsc;

/// Run the TUI application
///
/// This function uses async event handling to cooperate with the tokio runtime,
/// allowing other tasks (like the WebSocket server) to run without being starved.
pub async fn run(mut app: App, mut event_rx: mpsc::Receiver<AppEvent>) -> io::Result<()> {
    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Clear terminal
    terminal.clear()?;

    // Create async event stream for terminal events
    let mut event_stream = EventStream::new();

    // Tick interval for UI updates (20 FPS)
    let mut tick_interval = tokio::time::interval(Duration::from_millis(50));

    loop {
        // Draw UI
        terminal.draw(|f| draw(f, &app))?;

        // Use tokio::select! to handle multiple async event sources
        // This allows proper async cooperation - no blocking!
        tokio::select! {
            // Terminal events (keyboard, mouse, resize)
            maybe_event = event_stream.next() => {
                match maybe_event {
                    Some(Ok(Event::Key(key))) => {
                        // Only handle key press events, not repeats or releases
                        if key.kind != KeyEventKind::Press {
                            continue;
                        }

                        match (key.code, key.modifiers) {
                            // Quit on Ctrl+C or Q
                            (KeyCode::Char('c'), KeyModifiers::CONTROL) | (KeyCode::Char('q'), _) => {
                                break;
                            }
                            // Direct panel switching (no toggling - prevents flicker)
                            (KeyCode::Char('a'), _) => {
                                app.set_panel(ActivePanel::Audio);
                            }
                            (KeyCode::Char('e'), _) => {
                                app.set_panel(ActivePanel::Effects);
                            }
                            (KeyCode::Char('n'), _) => {
                                app.set_panel(ActivePanel::Network);
                            }
                            (KeyCode::Char('l'), _) => {
                                app.set_panel(ActivePanel::Logs);
                            }
                            // Toggle help
                            (KeyCode::Char('?'), _) | (KeyCode::F(1), _) => {
                                app.toggle_help();
                            }
                            // Scroll effects list
                            (KeyCode::Up, _) | (KeyCode::Char('k'), _) => {
                                app.scroll_effects_up();
                            }
                            (KeyCode::Down, _) | (KeyCode::Char('j'), _) => {
                                app.scroll_effects_down();
                            }
                            // Tab between panels
                            (KeyCode::Tab, _) => {
                                app.next_panel();
                            }
                            (KeyCode::BackTab, _) => {
                                app.prev_panel();
                            }
                            _ => {}
                        }
                    }
                    Some(Ok(_)) => {
                        // Other events (mouse, resize) - ignore for now
                    }
                    Some(Err(e)) => {
                        // Event stream error
                        tracing::error!("Terminal event error: {}", e);
                        break;
                    }
                    None => {
                        // Stream ended
                        break;
                    }
                }
            }

            // App events from audio/network threads
            Some(event) = event_rx.recv() => {
                app.handle_event(event);
            }

            // Tick for UI updates and level decay
            _ = tick_interval.tick() => {
                app.on_tick();
            }
        }

        // Check if we should quit
        if app.should_quit() {
            break;
        }
    }

    // Restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    Ok(())
}
