'use client';

import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAnalysisStore } from '@/stores/analysis-store';
import { useRoomStore } from '@/stores/room-store';
import {
  Music,
  Activity,
  Radio,
  Mic2,
  Volume2,
  Target,
  Waves,
  Gauge,
  AlertCircle,
  Info,
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
  const [showSpectrum, setShowSpectrum] = useState(true);

  const {
    localAnalysis,
    syncedAnalysis,
    analysisSource,
    isAnalyzing,
    isWorkerReady,
    spectrumData,
    tunerEnabled,
    setAnalysisSource,
    setTunerEnabled,
  } = useAnalysisStore();

  const { currentTrack } = useRoomStore();

  // Check if current track is YouTube (can't analyze YouTube audio - it's in an iframe)
  const isYouTubeTrack = !!currentTrack?.youtubeId;

  // Use synced values when available
  const displayKey = syncedAnalysis?.key || localAnalysis?.key;
  const displayScale = syncedAnalysis?.keyScale || localAnalysis?.keyScale;
  const displayBPM = syncedAnalysis?.bpm || localAnalysis?.bpm;
  const displayChord = localAnalysis?.currentChord;

  const keyColor = displayKey ? KEY_COLORS[displayKey] || '#71717a' : '#3f3f46';

  // Draw spectrum
  useEffect(() => {
    if (!showSpectrum || !canvasRef.current || !spectrumData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Draw spectrum bars
    const barCount = 64;
    const barWidth = width / barCount;
    const step = Math.floor(spectrumData.length / barCount);

    for (let i = 0; i < barCount; i++) {
      const value = spectrumData[i * step] || -100;
      const normalized = Math.max(0, (value + 100) / 100);
      const barHeight = normalized * height;

      // Gradient based on frequency
      const hue = (i / barCount) * 240;
      ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.8)`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = `hsla(${hue}, 80%, 60%, 0.5)`;
      ctx.fillRect(i * barWidth + 1, height - barHeight, barWidth - 2, barHeight);
    }
    ctx.shadowBlur = 0;
  }, [spectrumData, showSpectrum]);

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-white">Analysis</span>
          {isAnalyzing && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 rounded text-[10px] text-emerald-400">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
      </div>

      {/* Show message when analysis is not available */}
      {!isWorkerReady && (
        <div className="px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs text-amber-400">
              Audio analysis unavailable - feature loading failed
            </span>
          </div>
        </div>
      )}

      {/* Key & BPM Display */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {/* Key */}
        <div className="glass-panel rounded-xl p-4 text-center">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Key</span>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: keyColor, boxShadow: `0 0 12px ${keyColor}` }}
            />
            <span className="text-2xl font-bold text-white">
              {displayKey || '--'}
              <span className="text-lg text-zinc-400">
                {displayScale === 'minor' ? 'm' : ''}
              </span>
            </span>
          </div>
          {localAnalysis?.keyConfidence !== undefined && localAnalysis.keyConfidence > 0 && (
            <div className="mt-2 flex items-center justify-center gap-1">
              <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${localAnalysis.keyConfidence * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-500">{Math.round(localAnalysis.keyConfidence * 100)}%</span>
            </div>
          )}
        </div>

        {/* BPM */}
        <div className="glass-panel rounded-xl p-4 text-center">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Tempo</span>
          <div className="flex items-baseline justify-center gap-1 mt-2">
            <span className="text-2xl font-bold text-white">
              {displayBPM ? Math.round(displayBPM) : '--'}
            </span>
            <span className="text-sm text-zinc-400">BPM</span>
          </div>
          {localAnalysis?.bpmConfidence !== undefined && localAnalysis.bpmConfidence > 0 && (
            <div className="mt-2 flex items-center justify-center gap-1">
              <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${localAnalysis.bpmConfidence * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-500">{Math.round(localAnalysis.bpmConfidence * 100)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Current Chord */}
      {displayChord && (
        <div className="px-4 pb-3">
          <div className="glass-panel rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <Music className="w-4 h-4 text-indigo-400" />
              <span className="text-lg font-semibold text-white">{displayChord}</span>
              {localAnalysis?.chordConfidence !== undefined && (
                <span className="text-xs text-zinc-500">
                  {Math.round(localAnalysis.chordConfidence * 100)}%
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spectrum Analyzer */}
      <div className="px-4 pb-3">
        <button
          onClick={() => setShowSpectrum(!showSpectrum)}
          className={cn(
            'w-full flex items-center justify-center gap-2 p-2 rounded-lg transition-all text-sm',
            showSpectrum
              ? 'bg-indigo-500/20 text-indigo-400'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10'
          )}
        >
          <Waves className="w-4 h-4" />
          Spectrum
        </button>

        {showSpectrum && (
          <div className="mt-2 rounded-xl overflow-hidden bg-[#0a0a0f] border border-white/5">
            <canvas ref={canvasRef} className="w-full h-20" />
            <div className="flex justify-between px-2 py-1 text-[9px] text-zinc-600">
              <span>20Hz</span>
              <span>1kHz</span>
              <span>20kHz</span>
            </div>
          </div>
        )}
      </div>

      {/* Loudness Meter */}
      {localAnalysis && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
            <span className="flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5" />
              Level
            </span>
            <span>{Math.round(localAnalysis.loudness)}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
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

      {/* Tuner */}
      <div className="px-4 pb-3">
        <button
          onClick={() => setTunerEnabled(!tunerEnabled)}
          className={cn(
            'w-full flex items-center justify-center gap-2 p-2.5 rounded-lg transition-all text-sm',
            tunerEnabled
              ? 'bg-white text-black'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10'
          )}
        >
          <Target className="w-4 h-4" />
          Tuner Mode
        </button>

        {tunerEnabled && localAnalysis?.tunerNote && (
          <div className="mt-2 glass-panel rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-3xl font-bold text-white">{localAnalysis.tunerNote}</span>
              {localAnalysis.tunerFrequency && (
                <span className="text-sm text-zinc-500">
                  {localAnalysis.tunerFrequency.toFixed(1)} Hz
                </span>
              )}
            </div>
            {localAnalysis.tunerCents != null && (
              <>
                <div className="relative h-4 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="absolute left-1/2 top-0 w-0.5 h-full bg-emerald-500 -translate-x-1/2" />
                  <div
                    className={cn(
                      'absolute top-0.5 w-2 h-3 rounded-full transition-all',
                      Math.abs(localAnalysis.tunerCents) < 5
                        ? 'bg-emerald-400'
                        : Math.abs(localAnalysis.tunerCents) < 15
                        ? 'bg-yellow-400'
                        : 'bg-red-400'
                    )}
                    style={{
                      left: `${50 + localAnalysis.tunerCents / 2}%`,
                      transform: 'translateX(-50%)',
                    }}
                  />
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {localAnalysis.tunerCents > 0 ? '+' : ''}{localAnalysis.tunerCents} cents
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Source Selection */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
          <span>Source:</span>
        </div>
        <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
          {[
            { id: 'backing' as const, icon: Radio, label: 'Track', disabled: isYouTubeTrack },
            { id: 'local' as const, icon: Mic2, label: 'Mic', disabled: false },
            { id: 'mixed' as const, icon: Music, label: 'Mix', disabled: false },
          ].map(({ id, icon: Icon, label, disabled }) => (
            <button
              key={id}
              onClick={() => !disabled && setAnalysisSource(id)}
              disabled={disabled}
              title={disabled ? 'YouTube audio cannot be analyzed' : undefined}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-all',
                analysisSource === id
                  ? 'bg-white text-black'
                  : 'text-zinc-500 hover:text-zinc-300',
                disabled && 'opacity-40 cursor-not-allowed hover:text-zinc-500'
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Info message for YouTube tracks */}
        {isYouTubeTrack && analysisSource === 'backing' && (
          <div className="mt-2 flex items-start gap-2 px-2 py-1.5 rounded bg-blue-500/10 border border-blue-500/20">
            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <span className="text-[11px] text-blue-300">
              YouTube audio can&apos;t be analyzed. Select &quot;Mic&quot; to analyze your microphone input instead.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
