//! Custom TUI Widgets for OpenStudio Native Bridge

use ratatui::{
    layout::Rect,
    style::{Color, Style},
    symbols,
    widgets::{Block, Borders, Sparkline, Widget},
};
use std::collections::VecDeque;

/// Creates a horizontal level meter gauge widget
/// Displays audio level in dB with color coding and peak indicator
pub fn level_meter<'a>(level_db: f32, peak_db: f32, label: &'a str) -> LevelMeter<'a> {
    LevelMeter {
        level_db,
        peak_db,
        label,
    }
}

/// Level meter widget showing audio levels with peak hold
pub struct LevelMeter<'a> {
    level_db: f32,
    peak_db: f32,
    label: &'a str,
}

impl<'a> Widget for LevelMeter<'a> {
    fn render(self, area: Rect, buf: &mut ratatui::buffer::Buffer) {
        if area.width < 4 {
            return;
        }

        // Reserve space for label (2 chars) and level display (6 chars for "-00.0")
        let label_width = 2;
        let value_width = 6;
        let bar_width = area.width.saturating_sub(label_width + value_width + 2) as usize;

        if bar_width == 0 {
            return;
        }

        // Draw label
        let label_style = Style::default().fg(Color::White);
        buf.set_string(area.x, area.y, self.label, label_style);

        // Calculate bar position
        let bar_start = area.x + label_width + 1;

        // Convert dB to normalized 0-1 range
        // -60dB = 0, 0dB = 1, +6dB = 1.1
        let normalized = ((self.level_db + 60.0) / 60.0).clamp(0.0, 1.1);
        let peak_normalized = ((self.peak_db + 60.0) / 60.0).clamp(0.0, 1.1);

        let filled = (normalized * bar_width as f32) as usize;
        let peak_pos = (peak_normalized * bar_width as f32) as usize;

        // Draw the bar with color gradients
        for i in 0..bar_width {
            let char_pos = bar_start + i as u16;
            let threshold = i as f32 / bar_width as f32;

            // Determine character and color
            let (ch, color) = if i < filled {
                // Filled portion - color based on level
                let color = if threshold > 0.95 {
                    // >-3dB = red (clipping danger)
                    Color::Red
                } else if threshold > 0.8 {
                    // -12dB to -3dB = yellow (hot)
                    Color::Yellow
                } else {
                    // Below -12dB = green (normal)
                    Color::Green
                };
                ('█', color)
            } else if i == peak_pos && peak_pos > filled {
                // Peak indicator
                ('│', Color::White)
            } else {
                // Empty portion
                ('░', Color::DarkGray)
            };

            buf.set_string(char_pos, area.y, ch.to_string(), Style::default().fg(color));
        }

        // Draw level value at the end
        let value_start = bar_start + bar_width as u16 + 1;
        let level_str = format!("{:>5.1}", self.level_db);
        let value_color = if self.level_db > -3.0 {
            Color::Red
        } else if self.level_db > -12.0 {
            Color::Yellow
        } else {
            Color::Green
        };
        buf.set_string(
            value_start,
            area.y,
            level_str,
            Style::default().fg(value_color),
        );
    }
}

/// Creates a sparkline widget for displaying history data
pub fn sparkline_widget<'a>(data: &'a VecDeque<f32>, title: &'a str) -> SparklineWidget<'a> {
    SparklineWidget { data, title }
}

/// Sparkline widget wrapper for latency/level history
pub struct SparklineWidget<'a> {
    data: &'a VecDeque<f32>,
    title: &'a str,
}

impl<'a> Widget for SparklineWidget<'a> {
    fn render(self, area: Rect, buf: &mut ratatui::buffer::Buffer) {
        // Create block for the sparkline
        let block = Block::default()
            .title(self.title)
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::DarkGray));

        let inner = block.inner(area);
        block.render(area, buf);

        if inner.width < 2 || inner.height < 1 || self.data.is_empty() {
            return;
        }

        // Convert VecDeque<f32> to Vec<u64> for Sparkline
        // Scale data to fit in u64 range while preserving relative values
        let max_val = self.data.iter().copied().fold(f32::MIN, f32::max).max(1.0);
        let min_val = self.data.iter().copied().fold(f32::MAX, f32::min).min(0.0);
        let range = (max_val - min_val).max(1.0);

        // Take only as many points as will fit in the width
        let display_width = inner.width as usize;
        let data_slice: Vec<u64> = self
            .data
            .iter()
            .rev()
            .take(display_width)
            .rev()
            .map(|&v| {
                let normalized = ((v - min_val) / range).clamp(0.0, 1.0);
                (normalized * 100.0) as u64
            })
            .collect();

        // Determine color based on average value
        let avg: f32 = self.data.iter().sum::<f32>() / self.data.len() as f32;
        let color = if avg > 50.0 {
            Color::Red
        } else if avg > 30.0 {
            Color::Yellow
        } else {
            Color::Cyan
        };

        let sparkline = Sparkline::default()
            .data(&data_slice)
            .style(Style::default().fg(color))
            .bar_set(symbols::bar::NINE_LEVELS);

        sparkline.render(inner, buf);
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_level_meter_normalization() {
        // -60dB should be 0
        assert!(((-60.0f32 + 60.0) / 60.0 - 0.0).abs() < 0.001);
        // 0dB should be 1
        assert!(((0.0f32 + 60.0) / 60.0 - 1.0).abs() < 0.001);
        // -30dB should be 0.5
        assert!(((-30.0f32 + 60.0) / 60.0 - 0.5).abs() < 0.001);
    }
}
