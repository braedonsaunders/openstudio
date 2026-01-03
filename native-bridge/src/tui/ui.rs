//! TUI UI Drawing

use super::app::{ActivePanel, App, EffectCategory, LogLevel, NetworkMode};
use super::widgets::{level_meter, sparkline_widget};
use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{
        Block, Borders, Clear, List, ListItem, Paragraph, Scrollbar,
        ScrollbarOrientation, ScrollbarState, Wrap,
    },
    Frame,
};

/// Main draw function
pub fn draw(f: &mut Frame, app: &App) {
    // Main layout: header, content, footer
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),  // Header
            Constraint::Min(10),    // Content
            Constraint::Length(3),  // Footer
        ])
        .split(f.area());

    draw_header(f, app, chunks[0]);
    draw_content(f, app, chunks[1]);
    draw_footer(f, app, chunks[2]);

    // Help overlay
    if app.show_help {
        draw_help_popup(f, app);
    }
}

fn draw_header(f: &mut Frame, app: &App, area: Rect) {
    let title = format!(
        " OpenStudio Native Bridge │ {} │ {}Hz/{}smp │ {} ",
        app.uptime_str(),
        app.sample_rate,
        app.buffer_size,
        if app.network_connected { "●" } else { "○" }
    );

    let tabs = vec!["[A]udio", "[E]ffects", "[N]etwork", "[L]ogs"];
    let selected = match app.active_panel {
        ActivePanel::Audio => 0,
        ActivePanel::Effects => 1,
        ActivePanel::Network => 2,
        ActivePanel::Logs => 3,
    };

    let header = Paragraph::new(Line::from(vec![
        Span::styled("█▀▀ ", Style::default().fg(Color::Cyan)),
        Span::styled("OpenStudio", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        Span::styled(" Native Bridge ", Style::default().fg(Color::White)),
        Span::raw("│ "),
        Span::styled(app.uptime_str(), Style::default().fg(Color::Yellow)),
        Span::raw(" │ "),
        Span::styled(
            format!("{}Hz", app.sample_rate),
            Style::default().fg(Color::Green),
        ),
        Span::raw("/"),
        Span::styled(
            format!("{}smp", app.buffer_size),
            Style::default().fg(Color::Green),
        ),
        Span::raw(" │ "),
        if app.network_connected {
            Span::styled("● Connected", Style::default().fg(Color::Green))
        } else {
            Span::styled("○ Offline", Style::default().fg(Color::DarkGray))
        },
    ]))
    .block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::Cyan)),
    );

    f.render_widget(header, area);
}

fn draw_content(f: &mut Frame, app: &App, area: Rect) {
    // Split into left (main) and right (sidebar)
    let main_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(70), Constraint::Percentage(30)])
        .split(area);

    // Left side: active panel
    match app.active_panel {
        ActivePanel::Audio => draw_audio_panel(f, app, main_chunks[0]),
        ActivePanel::Effects => draw_effects_panel(f, app, main_chunks[0]),
        ActivePanel::Network => draw_network_panel(f, app, main_chunks[0]),
        ActivePanel::Logs => draw_logs_panel(f, app, main_chunks[0]),
    }

    // Right sidebar: quick status
    draw_sidebar(f, app, main_chunks[1]);
}

fn draw_audio_panel(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title(" Audio Levels ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(
            if app.active_panel == ActivePanel::Audio {
                Color::Cyan
            } else {
                Color::DarkGray
            },
        ));

    let inner = block.inner(area);
    f.render_widget(block, area);

    // Split into sections
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(4), // Input levels
            Constraint::Length(4), // Output levels
            Constraint::Length(4), // Device info
            Constraint::Min(3),    // Dynamics metering
        ])
        .split(inner);

    // Input levels
    draw_stereo_meter(f, "Input", app.input_level_l, app.input_level_r,
                      app.input_peak_l, app.input_peak_r, chunks[0]);

    // Output levels
    draw_stereo_meter(f, "Output", app.output_level_l, app.output_level_r,
                      app.output_peak_l, app.output_peak_r, chunks[1]);

    // Device info
    let device_info = Paragraph::new(vec![
        Line::from(vec![
            Span::raw("In:  "),
            Span::styled(&app.input_device, Style::default().fg(Color::Green)),
        ]),
        Line::from(vec![
            Span::raw("Out: "),
            Span::styled(&app.output_device, Style::default().fg(Color::Green)),
        ]),
    ])
    .block(Block::default().title(" Devices ").borders(Borders::ALL));
    f.render_widget(device_info, chunks[2]);

    // Dynamics metering
    let dynamics = Paragraph::new(vec![
        Line::from(vec![
            Span::raw("Gate: "),
            if app.noise_gate_open {
                Span::styled("OPEN", Style::default().fg(Color::Green))
            } else {
                Span::styled("CLOSED", Style::default().fg(Color::Red))
            },
            Span::raw("  Comp: "),
            Span::styled(
                format!("-{:.1}dB", app.compressor_reduction),
                Style::default().fg(Color::Yellow),
            ),
            Span::raw("  Limiter: "),
            Span::styled(
                format!("-{:.1}dB", app.limiter_reduction),
                Style::default().fg(if app.limiter_reduction > 3.0 { Color::Red } else { Color::Green }),
            ),
        ]),
    ])
    .block(Block::default().title(" Dynamics ").borders(Borders::ALL));
    f.render_widget(dynamics, chunks[3]);
}

fn draw_stereo_meter(f: &mut Frame, label: &str, level_l: f32, level_r: f32,
                     peak_l: f32, peak_r: f32, area: Rect) {
    let block = Block::default()
        .title(format!(" {} ", label))
        .borders(Borders::ALL);
    let inner = block.inner(area);
    f.render_widget(block, area);

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(1), Constraint::Length(1)])
        .split(inner);

    // Left channel
    let gauge_l = level_meter(level_l, peak_l, "L");
    f.render_widget(gauge_l, chunks[0]);

    // Right channel
    let gauge_r = level_meter(level_r, peak_r, "R");
    f.render_widget(gauge_r, chunks[1]);
}

fn draw_effects_panel(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title(format!(" Effects Chain ({} active) ", app.enabled_effects_count()))
        .borders(Borders::ALL)
        .border_style(Style::default().fg(
            if app.active_panel == ActivePanel::Effects {
                Color::Cyan
            } else {
                Color::DarkGray
            },
        ));

    let inner = block.inner(area);
    f.render_widget(block, area);

    // Group effects by category
    let categories = [
        EffectCategory::Guitar,
        EffectCategory::Dynamics,
        EffectCategory::Modulation,
        EffectCategory::TimeBased,
        EffectCategory::Pitch,
        EffectCategory::Spatial,
    ];

    let items: Vec<ListItem> = app
        .effects
        .iter()
        .skip(app.effects_scroll)
        .take(inner.height as usize)
        .map(|effect| {
            let style = if effect.enabled {
                Style::default().fg(Color::Green)
            } else {
                Style::default().fg(Color::DarkGray)
            };

            let indicator = if effect.enabled { "●" } else { "○" };
            let category_color = match effect.category {
                EffectCategory::Guitar => Color::Yellow,
                EffectCategory::Dynamics => Color::Cyan,
                EffectCategory::Modulation => Color::Magenta,
                EffectCategory::TimeBased => Color::Blue,
                EffectCategory::Pitch => Color::Green,
                EffectCategory::Spatial => Color::Red,
            };

            ListItem::new(Line::from(vec![
                Span::styled(indicator, style),
                Span::raw(" "),
                Span::styled(
                    format!("{:<12}", effect.name),
                    style,
                ),
                Span::styled(
                    format!("[{}]", effect.category),
                    Style::default().fg(category_color),
                ),
            ]))
        })
        .collect();

    let list = List::new(items);
    f.render_widget(list, inner);

    // Scrollbar
    if app.effects.len() > inner.height as usize {
        let scrollbar = Scrollbar::new(ScrollbarOrientation::VerticalRight)
            .begin_symbol(Some("▲"))
            .end_symbol(Some("▼"));
        let mut scrollbar_state = ScrollbarState::new(app.effects.len())
            .position(app.effects_scroll);
        f.render_stateful_widget(
            scrollbar,
            area.inner(ratatui::layout::Margin { horizontal: 0, vertical: 1 }),
            &mut scrollbar_state,
        );
    }
}

fn draw_network_panel(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title(" Network Status ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(
            if app.active_panel == ActivePanel::Network {
                Color::Cyan
            } else {
                Color::DarkGray
            },
        ));

    let inner = block.inner(area);
    f.render_widget(block, area);

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(6),  // Connection info
            Constraint::Length(4),  // Room info
            Constraint::Min(5),     // Latency graph
        ])
        .split(inner);

    // Connection info
    let mode_color = match app.network_mode {
        NetworkMode::Disconnected => Color::Red,
        NetworkMode::Connecting => Color::Yellow,
        NetworkMode::P2P => Color::Green,
        NetworkMode::Relay => Color::Blue,
        NetworkMode::Hybrid => Color::Cyan,
    };

    let conn_info = Paragraph::new(vec![
        Line::from(vec![
            Span::raw("Mode:    "),
            Span::styled(
                format!("{}", app.network_mode),
                Style::default().fg(mode_color).add_modifier(Modifier::BOLD),
            ),
        ]),
        Line::from(vec![
            Span::raw("Peers:   "),
            Span::styled(
                format!("{}", app.peer_count),
                Style::default().fg(Color::Yellow),
            ),
        ]),
        Line::from(vec![
            Span::raw("Latency: "),
            Span::styled(
                format!("{:.1}ms", app.latency_ms),
                Style::default().fg(
                    if app.latency_ms < 20.0 { Color::Green }
                    else if app.latency_ms < 50.0 { Color::Yellow }
                    else { Color::Red }
                ),
            ),
        ]),
        Line::from(vec![
            Span::raw("Loss:    "),
            Span::styled(
                format!("{:.2}%", app.packet_loss * 100.0),
                Style::default().fg(
                    if app.packet_loss < 0.01 { Color::Green }
                    else if app.packet_loss < 0.05 { Color::Yellow }
                    else { Color::Red }
                ),
            ),
        ]),
    ])
    .block(Block::default().title(" Connection ").borders(Borders::ALL));
    f.render_widget(conn_info, chunks[0]);

    // Room info
    let room_info = Paragraph::new(vec![
        Line::from(vec![
            Span::raw("Room: "),
            Span::styled(
                app.room_id.as_deref().unwrap_or("None"),
                Style::default().fg(Color::Cyan),
            ),
        ]),
        Line::from(vec![
            Span::raw("Key:  "),
            Span::styled(
                format!(
                    "{} {}",
                    app.room_key.as_deref().unwrap_or("-"),
                    app.room_scale.as_deref().unwrap_or("")
                ),
                Style::default().fg(Color::Green),
            ),
            Span::raw("  BPM: "),
            Span::styled(
                app.room_bpm.map(|b| format!("{:.0}", b)).unwrap_or("-".into()),
                Style::default().fg(Color::Yellow),
            ),
        ]),
    ])
    .block(Block::default().title(" Room Context ").borders(Borders::ALL));
    f.render_widget(room_info, chunks[1]);

    // Latency sparkline
    let sparkline = sparkline_widget(&app.latency_history, " Latency History ");
    f.render_widget(sparkline, chunks[2]);
}

fn draw_logs_panel(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title(format!(" Logs ({}) ", app.logs.len()))
        .borders(Borders::ALL)
        .border_style(Style::default().fg(
            if app.active_panel == ActivePanel::Logs {
                Color::Cyan
            } else {
                Color::DarkGray
            },
        ));

    let inner = block.inner(area);
    f.render_widget(block, area);

    let items: Vec<ListItem> = app
        .logs
        .iter()
        .rev()
        .take(inner.height as usize)
        .map(|entry| {
            let (prefix, color) = match entry.level {
                LogLevel::Debug => ("DBG", Color::DarkGray),
                LogLevel::Info => ("INF", Color::Blue),
                LogLevel::Warn => ("WRN", Color::Yellow),
                LogLevel::Error => ("ERR", Color::Red),
            };

            let elapsed = entry.timestamp.elapsed().as_secs();
            let time_str = if elapsed < 60 {
                format!("{}s", elapsed)
            } else {
                format!("{}m", elapsed / 60)
            };

            ListItem::new(Line::from(vec![
                Span::styled(format!("{:>3} ", time_str), Style::default().fg(Color::DarkGray)),
                Span::styled(format!("[{}] ", prefix), Style::default().fg(color)),
                Span::raw(&entry.message),
            ]))
        })
        .collect();

    let list = List::new(items);
    f.render_widget(list, inner);
}

fn draw_sidebar(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title(" Quick Status ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::DarkGray));

    let inner = block.inner(area);
    f.render_widget(block, area);

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(5), // Levels mini
            Constraint::Length(4), // Network mini
            Constraint::Length(4), // Room mini
            Constraint::Min(3),    // Active effects
        ])
        .split(inner);

    // Mini levels
    let levels = Paragraph::new(vec![
        Line::from(vec![
            Span::raw("In:  "),
            level_bar(app.input_level_l.max(app.input_level_r), 10),
        ]),
        Line::from(vec![
            Span::raw("Out: "),
            level_bar(app.output_level_l.max(app.output_level_r), 10),
        ]),
        Line::from(vec![
            Span::raw("CPU: "),
            Span::styled("▓▓▓░░░░░░░", Style::default().fg(Color::Green)), // Placeholder
        ]),
    ])
    .block(Block::default().title("Meters").borders(Borders::TOP));
    f.render_widget(levels, chunks[0]);

    // Mini network
    let net_status = if app.network_connected {
        format!("{} ({})", app.network_mode, app.peer_count)
    } else {
        "Offline".to_string()
    };
    let network = Paragraph::new(vec![
        Line::from(Span::styled(
            net_status,
            Style::default().fg(if app.network_connected { Color::Green } else { Color::Red }),
        )),
        Line::from(vec![
            Span::raw("RTT: "),
            Span::styled(format!("{:.0}ms", app.latency_ms), Style::default().fg(Color::Yellow)),
        ]),
    ])
    .block(Block::default().title("Network").borders(Borders::TOP));
    f.render_widget(network, chunks[1]);

    // Mini room
    let room = Paragraph::new(vec![
        Line::from(vec![
            Span::styled(
                app.room_key.as_deref().unwrap_or("-"),
                Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD),
            ),
            Span::raw(" "),
            Span::raw(app.room_scale.as_deref().unwrap_or("")),
        ]),
        Line::from(vec![
            Span::styled(
                format!("{:.0} BPM", app.room_bpm.unwrap_or(0.0)),
                Style::default().fg(Color::Yellow),
            ),
        ]),
    ])
    .block(Block::default().title("Room").borders(Borders::TOP));
    f.render_widget(room, chunks[2]);

    // Active effects count
    let active: Vec<&str> = app
        .effects
        .iter()
        .filter(|e| e.enabled)
        .take(5)
        .map(|e| e.name.as_str())
        .collect();

    let effects_text = if active.is_empty() {
        vec![Line::from(Span::styled("None", Style::default().fg(Color::DarkGray)))]
    } else {
        active
            .iter()
            .map(|name| {
                Line::from(Span::styled(*name, Style::default().fg(Color::Green)))
            })
            .collect()
    };

    let effects = Paragraph::new(effects_text)
        .block(Block::default().title(format!("Effects ({})", app.enabled_effects_count())).borders(Borders::TOP));
    f.render_widget(effects, chunks[3]);
}

fn draw_footer(f: &mut Frame, app: &App, area: Rect) {
    let help = " [Q]uit │ [E]ffects │ [N]etwork │ [?]Help │ [Tab] Switch │ [↑↓] Scroll ";

    let footer = Paragraph::new(Line::from(vec![
        Span::styled(help, Style::default().fg(Color::DarkGray)),
    ]))
    .block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::DarkGray)),
    );

    f.render_widget(footer, area);
}

fn draw_help_popup(f: &mut Frame, _app: &App) {
    let area = centered_rect(60, 70, f.area());

    // Clear the area first
    f.render_widget(Clear, area);

    let help_text = vec![
        Line::from(Span::styled(
            "OpenStudio Native Bridge - Keyboard Shortcuts",
            Style::default().add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from(vec![
            Span::styled("Q", Style::default().fg(Color::Yellow)),
            Span::raw(" / "),
            Span::styled("Ctrl+C", Style::default().fg(Color::Yellow)),
            Span::raw(" - Quit"),
        ]),
        Line::from(vec![
            Span::styled("E", Style::default().fg(Color::Yellow)),
            Span::raw(" - Toggle Effects panel"),
        ]),
        Line::from(vec![
            Span::styled("N", Style::default().fg(Color::Yellow)),
            Span::raw(" - Toggle Network panel"),
        ]),
        Line::from(vec![
            Span::styled("Tab", Style::default().fg(Color::Yellow)),
            Span::raw(" - Next panel"),
        ]),
        Line::from(vec![
            Span::styled("Shift+Tab", Style::default().fg(Color::Yellow)),
            Span::raw(" - Previous panel"),
        ]),
        Line::from(vec![
            Span::styled("↑/↓", Style::default().fg(Color::Yellow)),
            Span::raw(" or "),
            Span::styled("k/j", Style::default().fg(Color::Yellow)),
            Span::raw(" - Scroll"),
        ]),
        Line::from(vec![
            Span::styled("?", Style::default().fg(Color::Yellow)),
            Span::raw(" / "),
            Span::styled("F1", Style::default().fg(Color::Yellow)),
            Span::raw(" - Toggle this help"),
        ]),
        Line::from(""),
        Line::from(Span::styled(
            "Effect Categories:",
            Style::default().add_modifier(Modifier::BOLD),
        )),
        Line::from(vec![
            Span::styled("●", Style::default().fg(Color::Yellow)),
            Span::raw(" Guitar  "),
            Span::styled("●", Style::default().fg(Color::Cyan)),
            Span::raw(" Dynamics  "),
            Span::styled("●", Style::default().fg(Color::Magenta)),
            Span::raw(" Modulation"),
        ]),
        Line::from(vec![
            Span::styled("●", Style::default().fg(Color::Blue)),
            Span::raw(" Time  "),
            Span::styled("●", Style::default().fg(Color::Green)),
            Span::raw(" Pitch  "),
            Span::styled("●", Style::default().fg(Color::Red)),
            Span::raw(" Spatial"),
        ]),
        Line::from(""),
        Line::from(Span::styled(
            "Press any key to close",
            Style::default().fg(Color::DarkGray),
        )),
    ];

    let popup = Paragraph::new(help_text)
        .block(
            Block::default()
                .title(" Help ")
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Cyan)),
        )
        .wrap(Wrap { trim: false });

    f.render_widget(popup, area);
}

fn level_bar(db: f32, width: usize) -> Span<'static> {
    // Convert dB to 0-1 range (-60dB to 0dB)
    let normalized = ((db + 60.0) / 60.0).clamp(0.0, 1.0);
    let filled = (normalized * width as f32) as usize;

    let bar: String = (0..width)
        .map(|i| if i < filled { '▓' } else { '░' })
        .collect();

    let color = if db > -3.0 {
        Color::Red
    } else if db > -12.0 {
        Color::Yellow
    } else {
        Color::Green
    };

    Span::styled(bar, Style::default().fg(color))
}

fn centered_rect(percent_x: u16, percent_y: u16, r: Rect) -> Rect {
    let popup_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage((100 - percent_y) / 2),
            Constraint::Percentage(percent_y),
            Constraint::Percentage((100 - percent_y) / 2),
        ])
        .split(r);

    Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - percent_x) / 2),
            Constraint::Percentage(percent_x),
            Constraint::Percentage((100 - percent_x) / 2),
        ])
        .split(popup_layout[1])[1]
}
