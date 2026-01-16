'use client';

import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAnalysisStore } from '@/stores/analysis-store';
import { useRoomStore } from '@/stores/room-store';
import { useTheme } from '@/components/theme/ThemeProvider';
import {
  Music,
  Radio,
  Mic2,
  Volume2,
  Target,
  Waves,
  Gauge,
  AlertCircle,
  Info,
  Zap,
  PartyPopper,
} from 'lucide-react';

// Key colors for visualization
const KEY_COLORS: Record<string, string> = {
  'C': '#ef4444',
  'C#': '#dc2626', 'Db': '#dc2626',
  'D': '#f97316',
  'D#': '#ea580c', 'Eb': '#ea580c',
  'E': '#eab308',
  'F': '#84cc16',
  'F#': '#22c55e', 'Gb': '#22c55e',
  'G': '#10b981',
  'G#': '#14b8a6', 'Ab': '#14b8a6',
  'A': '#06b6d4',
  'A#': '#3b82f6', 'Bb': '#3b82f6',
  'B': '#8b5cf6',
};

export function AnalysisPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const { resolvedTheme } = useTheme();

  const {
    localAnalysis,
    syncedAnalysis,
    analysisSource,
    isAnalyzing,
    isWorkerReady,
    spectrumData,
    tunerEnabled,
    backingTrackAvailable,
    setAnalysisSource,
    setTunerEnabled,
  } = useAnalysisStore();

  const { currentTrack } = useRoomStore();

  // Check if current track is YouTube
  const isYouTubeTrack = !!currentTrack?.youtubeId;

  // Track source is available if we have a backing track element (includes YouTube with audio extraction)
  const canAnalyzeTrack = backingTrackAvailable || (currentTrack && !isYouTubeTrack);

  // Use synced values when available
  const displayKey = syncedAnalysis?.key || localAnalysis?.key;
  const displayScale = syncedAnalysis?.keyScale || localAnalysis?.keyScale;
  const displayBPM = syncedAnalysis?.bpm || localAnalysis?.bpm;
  const displayChord = localAnalysis?.currentChord;

  const keyColor = displayKey ? KEY_COLORS[displayKey] || '#71717a' : '#3f3f46';

  // Track container width for proper canvas sizing
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Draw spectrum with logarithmic frequency scaling
  useEffect(() => {
    if (!canvasRef.current || !spectrumData || containerWidth === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = containerWidth;
    const height = 80;

    // Set canvas size for high DPI displays
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear with theme-aware background
    ctx.fillStyle = resolvedTheme === 'dark' ? '#0a0a0f' : '#f3f4f6';
    ctx.fillRect(0, 0, width, height);

    // Use logarithmic frequency scaling for better musical representation
    // Frequency bins: spectrumData has frequencyBinCount bins (usually 1024)
    // Each bin represents sampleRate / fftSize Hz (e.g., 44100/2048 ≈ 21.5 Hz)
    const nyquist = 22050; // Half of 44.1kHz
    const minFreq = 20;
    const maxFreq = 20000;
    const barCount = Math.min(64, Math.floor(width / 4));
    const barWidth = width / barCount;

    for (let i = 0; i < barCount; i++) {
      // Logarithmic mapping: bar position -> frequency
      const freqRatio = i / barCount;
      const freq = minFreq * Math.pow(maxFreq / minFreq, freqRatio);

      // Convert frequency to bin index
      const binIndex = Math.round((freq / nyquist) * spectrumData.length);

      // Average a few neighboring bins for smoother display
      let sum = 0;
      let count = 0;
      const binRadius = Math.max(1, Math.floor(binIndex * 0.1));
      for (let j = Math.max(0, binIndex - binRadius); j <= Math.min(spectrumData.length - 1, binIndex + binRadius); j++) {
        sum += spectrumData[j];
        count++;
      }
      const value = count > 0 ? sum / count : -100;

      // Normalize from dB (-100 to -20 typical range) to 0-1
      const normalized = Math.max(0, Math.min(1, (value + 90) / 70));
      const barHeight = normalized * height;

      // Gradient based on frequency (purple to cyan)
      const hue = 280 - freqRatio * 100;
      ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.9)`;
      ctx.shadowBlur = 4;
      ctx.shadowColor = `hsla(${hue}, 80%, 60%, 0.3)`;
      ctx.fillRect(i * barWidth + 0.5, height - barHeight, barWidth - 1, barHeight);
    }
    ctx.shadowBlur = 0;
  }, [spectrumData, containerWidth, resolvedTheme]);

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Show message when analysis is not available */}
      {!isWorkerReady && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-white/5">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Audio analysis unavailable - feature loading failed
            </span>
          </div>
        </div>
      )}

      {/* Key & BPM Display */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {/* Key & Scale */}
        <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-center">
          <span className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Key & Scale</span>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div
              className="w-4 h-4 rounded-full shrink-0"
              style={{ backgroundColor: keyColor, boxShadow: `0 0 12px ${keyColor}` }}
            />
            <span className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
              {displayKey || '--'}
              {displayScale && (
                <span className={cn(
                  'text-sm font-medium ml-1',
                  displayScale === 'minor'
                    ? 'text-indigo-500 dark:text-indigo-400'
                    : 'text-amber-500 dark:text-amber-400'
                )}>
                  {displayScale === 'minor' ? 'min' : 'maj'}
                </span>
              )}
            </span>
          </div>
          {localAnalysis?.keyConfidence !== undefined && localAnalysis.keyConfidence > 0 && (
            <div className="mt-2 flex items-center justify-center gap-1">
              <div className="w-12 h-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${localAnalysis.keyConfidence * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-500 dark:text-zinc-500">{Math.round(localAnalysis.keyConfidence * 100)}%</span>
            </div>
          )}
        </div>

        {/* BPM */}
        <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-center">
          <span className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Tempo</span>
          <div className="flex items-baseline justify-center gap-1 mt-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {displayBPM ? Math.round(displayBPM) : '--'}
            </span>
            <span className="text-sm text-gray-500 dark:text-zinc-400">BPM</span>
          </div>
          {localAnalysis?.bpmConfidence !== undefined && localAnalysis.bpmConfidence > 0 && (
            <div className="mt-2 flex items-center justify-center gap-1">
              <div className="w-12 h-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${localAnalysis.bpmConfidence * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-500 dark:text-zinc-500">{Math.round(localAnalysis.bpmConfidence * 100)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Current Chord / Note - Always Visible */}
      <div className="px-4 pb-3">
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 border border-indigo-500/20 dark:border-indigo-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Music className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-wider font-medium">
              {displayChord ? 'Current Chord' : localAnalysis?.detectedNote ? 'Detected Note' : 'Chord / Note'}
            </span>
          </div>
          <div className="flex items-center justify-center">
            {displayChord ? (
              <div className="text-center">
                <span className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {displayChord}
                </span>
                {localAnalysis?.chordConfidence !== undefined && localAnalysis.chordConfidence > 0 && (
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-150"
                        style={{ width: `${Math.min(100, localAnalysis.chordConfidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-zinc-500 tabular-nums">
                      {Math.round(localAnalysis.chordConfidence * 100)}%
                    </span>
                  </div>
                )}
              </div>
            ) : localAnalysis?.detectedNote ? (
              <div className="text-center">
                <span className="text-4xl font-bold text-gray-700 dark:text-gray-300 tracking-tight">
                  {localAnalysis.detectedNote}
                </span>
                <span className="text-sm text-gray-500 dark:text-zinc-500 ml-1">note</span>
                {localAnalysis.noteConfidence > 0 && (
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all duration-150"
                        style={{ width: `${Math.min(100, localAnalysis.noteConfidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-zinc-500 tabular-nums">
                      {Math.round(localAnalysis.noteConfidence * 100)}%
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-2">
                <span className="text-3xl font-bold text-gray-400 dark:text-zinc-600">--</span>
                <p className="text-xs text-gray-500 dark:text-zinc-600 mt-1">Play audio to detect</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Spectrum Analyzer - Always Visible */}
      <div className="pb-3">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-500 mb-2 px-4">
          <Waves className="w-3.5 h-3.5" />
          <span>Spectrum</span>
        </div>
        <div ref={containerRef} className="bg-gray-100 dark:bg-[#0a0a0f]">
          <canvas ref={canvasRef} />
          <div className="flex justify-between px-3 py-1 text-[9px] text-gray-500 dark:text-zinc-600">
            <span>20Hz</span>
            <span>1kHz</span>
            <span>20kHz</span>
          </div>
        </div>
      </div>

      {/* Loudness Meter */}
      {localAnalysis && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-500 mb-1.5">
            <span className="flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5" />
              Level
            </span>
            <span>{Math.round(localAnalysis.loudness)}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-75',
                localAnalysis.rms > 0.8
                  ? 'bg-red-500'
                  : localAnalysis.rms > 0.5
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              )}
              style={{ width: `${Math.min(100, localAnalysis.loudness)}%` }}
            />
          </div>
        </div>
      )}

      {/* Energy, Danceability, Tuning */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-3 gap-2">
          {/* Energy */}
          <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-center">
            <Zap className="w-3.5 h-3.5 text-amber-500 mx-auto mb-1" />
            <span className="text-[10px] text-gray-500 dark:text-zinc-500 block">Energy</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {localAnalysis && localAnalysis.energy > 0 ? `${(localAnalysis.energy * 100).toFixed(0)}%` : '--'}
            </span>
          </div>

          {/* Danceability */}
          <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-center">
            <PartyPopper className="w-3.5 h-3.5 text-pink-500 mx-auto mb-1" />
            <span className="text-[10px] text-gray-500 dark:text-zinc-500 block">Dance</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {localAnalysis && localAnalysis.danceability > 0 ? `${(localAnalysis.danceability * 100).toFixed(0)}%` : '--'}
            </span>
          </div>

          {/* Tuning Frequency */}
          <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-center">
            <Gauge className="w-3.5 h-3.5 text-cyan-500 mx-auto mb-1" />
            <span className="text-[10px] text-gray-500 dark:text-zinc-500 block">Tuning</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {localAnalysis && localAnalysis.tuningFrequency ? `${localAnalysis.tuningFrequency.toFixed(0)}Hz` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Tuner */}
      <div className="px-4 pb-3">
        <button
          onClick={() => setTunerEnabled(!tunerEnabled)}
          className={cn(
            'w-full flex items-center justify-center gap-2 p-2.5 rounded-lg transition-all text-sm',
            tunerEnabled
              ? 'bg-indigo-500 text-white'
              : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/10'
          )}
        >
          <Target className="w-4 h-4" />
          Tuner Mode
        </button>

        {tunerEnabled && (
          <div className="mt-2 bg-gray-100 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl p-4 text-center">
            {localAnalysis?.tunerNote ? (
              <>
                {/* Note display with stability indicator */}
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className={cn(
                    'relative',
                    localAnalysis.tunerIsStable && Math.abs(localAnalysis.tunerCents || 0) < 5 && 'animate-pulse'
                  )}>
                    <span className={cn(
                      'text-4xl font-bold transition-colors',
                      Math.abs(localAnalysis.tunerCents || 0) < 5
                        ? 'text-emerald-400'
                        : Math.abs(localAnalysis.tunerCents || 0) < 15
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    )}>
                      {localAnalysis.tunerNote}
                    </span>
                    {localAnalysis.tunerIsStable && Math.abs(localAnalysis.tunerCents || 0) < 5 && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full" />
                    )}
                  </div>
                  <div className="text-left">
                    <div className="text-sm text-gray-400">
                      {localAnalysis.tunerFrequency?.toFixed(1)} Hz
                    </div>
                    <div className="text-xs text-gray-500">
                      {localAnalysis.tunerIsStable ? 'Stable' : 'Detecting...'}
                    </div>
                  </div>
                </div>

                {/* Cents meter */}
                {localAnalysis.tunerCents != null && (
                  <>
                    <div className="relative h-6 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mb-2">
                      {/* Scale markers */}
                      <div className="absolute inset-0 flex justify-between px-2 items-center">
                        <span className="text-[8px] text-gray-500 dark:text-gray-600">-50</span>
                        <span className="text-[8px] text-gray-500 dark:text-gray-600">0</span>
                        <span className="text-[8px] text-gray-500 dark:text-gray-600">+50</span>
                      </div>
                      {/* Center line (in tune) */}
                      <div className="absolute left-1/2 top-0 w-1 h-full bg-emerald-500/50 -translate-x-1/2" />
                      {/* Tolerance zone */}
                      <div className="absolute left-1/2 top-1 h-4 w-8 bg-emerald-500/20 -translate-x-1/2 rounded" />
                      {/* Cents indicator */}
                      <div
                        className={cn(
                          'absolute top-1 w-3 h-4 rounded-sm transition-all duration-100',
                          Math.abs(localAnalysis.tunerCents) < 5
                            ? 'bg-emerald-400 shadow-lg shadow-emerald-500/50'
                            : Math.abs(localAnalysis.tunerCents) < 15
                            ? 'bg-yellow-400 shadow-lg shadow-yellow-500/50'
                            : 'bg-red-400 shadow-lg shadow-red-500/50'
                        )}
                        style={{
                          left: `${50 + Math.max(-50, Math.min(50, localAnalysis.tunerCents))}%`,
                          transform: 'translateX(-50%)',
                        }}
                      />
                    </div>
                    <div className={cn(
                      'text-lg font-mono font-bold',
                      Math.abs(localAnalysis.tunerCents) < 5
                        ? 'text-emerald-400'
                        : Math.abs(localAnalysis.tunerCents) < 15
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    )}>
                      {localAnalysis.tunerCents > 0 ? '+' : ''}{localAnalysis.tunerCents} cents
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="py-4">
                <Target className="w-8 h-8 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-500">Play a note to tune</p>
                <p className="text-xs text-gray-500 dark:text-gray-600 mt-1">Works best with single notes</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Source Selection */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-500 mb-2">
          <span>Source:</span>
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-lg">
          {[
            { id: 'backing' as const, icon: Radio, label: 'Track', disabled: !canAnalyzeTrack, title: 'Analyze backing track only' },
            { id: 'local' as const, icon: Mic2, label: 'Mic', disabled: false, title: 'Analyze your microphone' },
            { id: 'mixed' as const, icon: Music, label: 'Mix', disabled: false, title: 'Analyze all audio (backing + all instruments)' },
          ].map(({ id, icon: Icon, label, disabled, title }) => (
            <button
              key={id}
              onClick={() => !disabled && setAnalysisSource(id)}
              disabled={disabled}
              title={disabled ? 'No track available for analysis' : title}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-all',
                analysisSource === id
                  ? 'bg-indigo-500 text-white'
                  : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300',
                disabled && 'opacity-40 cursor-not-allowed hover:text-gray-500 dark:hover:text-zinc-500'
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Info message for YouTube tracks (can't be analyzed - uses iframe) */}
        {isYouTubeTrack && (analysisSource === 'backing' || analysisSource === 'mixed') && (
          <div className="mt-2 flex items-start gap-2 px-2 py-1.5 rounded bg-amber-500/10 border border-amber-500/20">
            <Info className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
            <span className="text-[11px] text-amber-600 dark:text-amber-300">
              YouTube audio cannot be analyzed (iframe isolation). Use &quot;Mic&quot; to analyze instruments playing along, or &quot;Mix&quot; to analyze all participants.
            </span>
          </div>
        )}

        {/* Info message for Track mode */}
        {!isYouTubeTrack && backingTrackAvailable && analysisSource === 'backing' && (
          <div className="mt-2 flex items-start gap-2 px-2 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/20">
            <Info className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span className="text-[11px] text-emerald-600 dark:text-emerald-300">
              Analyzes backing track only. Results sync to all room members.
            </span>
          </div>
        )}

        {/* Info message for Mix mode */}
        {analysisSource === 'mixed' && !isYouTubeTrack && (
          <div className="mt-2 flex items-start gap-2 px-2 py-1.5 rounded bg-indigo-500/10 border border-indigo-500/20">
            <Info className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
            <span className="text-[11px] text-indigo-600 dark:text-indigo-300">
              Analyzes backing track + all participants&apos; microphones. Great for jam sessions!
            </span>
          </div>
        )}

        {/* Info message for Mic mode */}
        {analysisSource === 'local' && (
          <div className="mt-2 flex items-start gap-2 px-2 py-1.5 rounded bg-blue-500/10 border border-blue-500/20">
            <Info className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
            <span className="text-[11px] text-blue-600 dark:text-blue-300">
              Analyzes your microphone input only. Use for tuning or personal key detection.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
