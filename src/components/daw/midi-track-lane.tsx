'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { UserTrack } from '@/types';
import { Piano, Music } from 'lucide-react';

interface MidiTrackLaneProps {
  track: UserTrack;
  zoom: number;
  historySeconds: number;
}

// MIDI note history for visualization
interface MidiNoteEvent {
  note: number;
  velocity: number;
  startTime: number;
  endTime?: number;
}

// Piano roll colors based on octave
const OCTAVE_COLORS = [
  'from-rose-500 to-pink-500',
  'from-orange-500 to-amber-500',
  'from-yellow-500 to-lime-500',
  'from-emerald-500 to-teal-500',
  'from-cyan-500 to-sky-500',
  'from-blue-500 to-indigo-500',
  'from-violet-500 to-purple-500',
  'from-fuchsia-500 to-pink-500',
];

// Get note name from MIDI number
function getNoteName(midiNote: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNote / 12) - 1;
  const note = noteNames[midiNote % 12];
  return `${note}${octave}`;
}

export function MidiTrackLane({
  track,
  zoom,
  historySeconds,
}: MidiTrackLaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const noteHistoryRef = useRef<MidiNoteEvent[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const activeMidiNotes = track.activeMidiNotes || [];
  const isActive = activeMidiNotes.length > 0;
  const isMuted = track.isMuted;

  // Update note history when active notes change
  useEffect(() => {
    const now = Date.now();
    const activeSet = new Set(activeMidiNotes);

    // End notes that are no longer active
    noteHistoryRef.current.forEach(event => {
      if (!event.endTime && !activeSet.has(event.note)) {
        event.endTime = now;
      }
    });

    // Add new notes
    activeMidiNotes.forEach(note => {
      const existing = noteHistoryRef.current.find(
        e => e.note === note && !e.endTime
      );
      if (!existing) {
        noteHistoryRef.current.push({
          note,
          velocity: 100, // Default velocity
          startTime: now,
        });
      }
    });

    // Clean up old notes (older than history window)
    const cutoff = now - historySeconds * 1000;
    noteHistoryRef.current = noteHistoryRef.current.filter(
      e => (e.endTime || now) > cutoff
    );
  }, [activeMidiNotes, historySeconds]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Animation loop for the MIDI visualization
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { width, height } = dimensions;
    if (width === 0 || height === 0) return;

    // Set canvas size
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const now = Date.now();
    const pixelsPerMs = (width * zoom) / (historySeconds * 1000);
    const noteHeight = height / 12; // Show one octave worth of note height variation

    // Draw subtle grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 12; i++) {
      const y = (height / 12) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw MIDI notes from history
    noteHistoryRef.current.forEach((event) => {
      const noteEnd = event.endTime || now;
      const duration = noteEnd - event.startTime;
      const age = now - event.startTime;

      // Calculate position (flowing from right to left)
      const endX = width - 40 - (now - noteEnd) * pixelsPerMs;
      const startX = endX - duration * pixelsPerMs;

      if (endX < 0) return; // Off screen

      // Calculate vertical position based on note (within octave)
      const noteInOctave = event.note % 12;
      const y = height - ((noteInOctave + 0.5) / 12) * height;

      // Color based on octave
      const octave = Math.floor(event.note / 12);
      const hue = (octave * 35) % 360;
      const isActive = !event.endTime;

      // Draw note bar with gradient
      const noteWidth = Math.max(endX - startX, 4);
      const barHeight = noteHeight * 0.7;

      // Create gradient
      const gradient = ctx.createLinearGradient(startX, y, endX, y);
      if (isActive) {
        // Active notes glow
        gradient.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.3)`);
        gradient.addColorStop(0.5, `hsla(${hue}, 90%, 65%, 0.9)`);
        gradient.addColorStop(1, `hsla(${hue}, 100%, 70%, 1)`);
      } else {
        // Fading notes
        const fade = Math.max(0, 1 - age / (historySeconds * 1000));
        gradient.addColorStop(0, `hsla(${hue}, 70%, 50%, ${fade * 0.1})`);
        gradient.addColorStop(1, `hsla(${hue}, 80%, 60%, ${fade * 0.6})`);
      }

      // Draw rounded rectangle
      ctx.fillStyle = gradient;
      ctx.beginPath();
      const radius = Math.min(barHeight / 2, 6);
      ctx.roundRect(startX, y - barHeight / 2, noteWidth, barHeight, radius);
      ctx.fill();

      // Glow effect for active notes
      if (isActive) {
        ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.8)`;
        ctx.shadowBlur = 15;
        ctx.fillStyle = `hsla(${hue}, 100%, 80%, 0.5)`;
        ctx.beginPath();
        ctx.roundRect(endX - 10, y - barHeight / 2, 10, barHeight, radius);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Draw flowing particles for active notes
    activeMidiNotes.forEach((note, index) => {
      const noteInOctave = note % 12;
      const y = height - ((noteInOctave + 0.5) / 12) * height;
      const octave = Math.floor(note / 12);
      const hue = (octave * 35) % 360;

      // Draw particles
      const particleCount = 5;
      for (let i = 0; i < particleCount; i++) {
        const phase = (now / 200 + i * (Math.PI * 2 / particleCount)) % (Math.PI * 2);
        const particleX = width - 40 + Math.sin(phase) * 8;
        const particleY = y + Math.cos(phase * 2) * 6;
        const size = 2 + Math.sin(phase) * 1;
        const opacity = 0.5 + Math.sin(phase) * 0.3;

        ctx.beginPath();
        ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${opacity})`;
        ctx.arc(particleX, particleY, size, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw "NOW" line with pulse effect
    const pulseIntensity = 0.5 + 0.5 * Math.sin(now / 200);
    ctx.strokeStyle = `rgba(139, 92, 246, ${0.6 + pulseIntensity * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width - 40, 0);
    ctx.lineTo(width - 40, height);
    ctx.stroke();

    animationRef.current = requestAnimationFrame(animate);
  }, [dimensions, zoom, historySeconds, activeMidiNotes]);

  // Start/stop animation
  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  // Get current note display
  const noteDisplay = activeMidiNotes.length > 0
    ? activeMidiNotes.map(n => getNoteName(n)).join(' ')
    : '';

  return (
    <div
      ref={containerRef}
      className={cn(
        'h-[80px] border-b border-white/5 relative transition-colors flex-shrink-0 overflow-hidden',
        isActive && 'bg-gradient-to-r from-purple-500/5 via-transparent to-transparent'
      )}
      style={{ '--track-color': track.color } as React.CSSProperties}
    >
      {/* Track color indicator with MIDI pulse */}
      <div className="absolute left-0 top-0 bottom-0 flex items-center z-10">
        <div
          className={cn(
            'w-1 h-full transition-all relative',
            isActive && !isMuted && 'shadow-[0_0_16px_var(--track-color)]'
          )}
          style={{ backgroundColor: track.color }}
        >
          {/* Pulse effect for active MIDI */}
          {isActive && !isMuted && (
            <div
              className="absolute inset-0 animate-pulse"
              style={{
                backgroundColor: track.color,
                boxShadow: `0 0 20px ${track.color}`,
              }}
            />
          )}
        </div>
        {/* MIDI icon indicator */}
        <div className="absolute left-1.5 top-2">
          <Piano
            className={cn(
              'w-3 h-3',
              isActive ? 'text-purple-400' : 'text-purple-400/40'
            )}
          />
        </div>
      </div>

      {/* MIDI Visualization Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: isMuted ? 0.3 : 1 }}
      />

      {/* Track info overlay */}
      <div className="absolute left-4 bottom-2 flex items-center gap-1.5 z-10">
        <Music className="w-3 h-3 text-purple-400/60" />
        <span className="text-[10px] text-zinc-500 truncate max-w-[80px]">
          {track.name}
        </span>
        {noteDisplay && (
          <span className="text-[10px] font-mono text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded">
            {noteDisplay}
          </span>
        )}
      </div>

      {/* Sound preset indicator */}
      <div className="absolute left-4 top-2 z-10">
        <span className="text-[9px] text-purple-400/50 bg-purple-500/10 px-1.5 py-0.5 rounded">
          {track.midiSettings?.soundPreset?.split('/')[1] || 'synth'}
        </span>
      </div>

      {/* MIDI Active badge with notes visualization */}
      {isActive && !isMuted && (
        <div className="absolute right-3 top-2 z-20">
          <div
            className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider shadow-lg flex items-center gap-1.5"
            style={{
              backgroundColor: track.color,
              color: 'white',
              boxShadow: `0 0 16px ${track.color}80`,
              animation: 'pulse 1s ease-in-out infinite',
            }}
          >
            <div className="flex gap-0.5">
              {activeMidiNotes.slice(0, 4).map((note, i) => (
                <div
                  key={i}
                  className="w-1 bg-white/80 rounded-full animate-bounce"
                  style={{
                    height: `${8 + (note % 12)}px`,
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              ))}
            </div>
            MIDI
          </div>
        </div>
      )}

      {/* Idle state indicator */}
      {!isActive && !isMuted && (
        <div className="absolute right-3 top-2 z-20">
          <div className="px-2 py-0.5 rounded text-[9px] font-medium tracking-wider text-purple-400/60 bg-purple-500/10 border border-purple-400/20">
            MIDI READY
          </div>
        </div>
      )}

      {/* Muted indicator */}
      {isMuted && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/40 backdrop-blur-[2px]">
          <span className="text-xs text-zinc-400 bg-black/60 px-3 py-1.5 rounded-lg">
            MUTED
          </span>
        </div>
      )}
    </div>
  );
}
