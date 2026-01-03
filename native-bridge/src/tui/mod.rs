//! Terminal User Interface for OpenStudio Native Bridge
//! Provides real-time monitoring of audio, effects, and network status

mod app;
mod ui;
mod widgets;

pub use app::{App, AppEvent, LogLevel};
pub use ui::draw;

use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};
use std::io;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;

/// Run the TUI application
pub async fn run(
    mut app: App,
    mut event_rx: mpsc::Receiver<AppEvent>,
) -> io::Result<()> {
    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Clear terminal
    terminal.clear()?;

    let tick_rate = Duration::from_millis(50); // 20 FPS
    let mut last_tick = Instant::now();

    loop {
        // Draw UI
        terminal.draw(|f| draw(f, &app))?;

        // Handle events with timeout
        let timeout = tick_rate
            .checked_sub(last_tick.elapsed())
            .unwrap_or_else(|| Duration::from_secs(0));

        // Check for crossterm events (keyboard, etc.)
        if crossterm::event::poll(timeout)? {
            if let Event::Key(key) = event::read()? {
                match (key.code, key.modifiers) {
                    // Quit on Ctrl+C or Q
                    (KeyCode::Char('c'), KeyModifiers::CONTROL) | (KeyCode::Char('q'), _) => {
                        break;
                    }
                    // Toggle effects panel
                    (KeyCode::Char('e'), _) => {
                        app.toggle_effects_panel();
                    }
                    // Toggle network panel
                    (KeyCode::Char('n'), _) => {
                        app.toggle_network_panel();
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
        }

        // Process app events from audio/network threads
        while let Ok(event) = event_rx.try_recv() {
            app.handle_event(event);
        }

        // Tick
        if last_tick.elapsed() >= tick_rate {
            app.on_tick();
            last_tick = Instant::now();
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
