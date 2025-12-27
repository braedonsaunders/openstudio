'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAnalysisStore } from '@/stores/analysis-store';
import { Button } from '../ui/button';
import {
  Music,
  Activity,
  Radio,
  Mic2,
  Volume2,
  ChevronDown,
  ChevronUp,
  Gauge,
  Target,
  Waves,
} from 'lucide-react';

interface AnalysisHUDProps {
  className?: string;
  compact?: boolean;
}

// Key colors for visualization
const KEY_COLORS: Record<string, string> = {
  'C': 'bg-red-500',
  'C#': 'bg-red-600',
  'Db': 'bg-red-600',
  'D': 'bg-orange-500',
  'D#': 'bg-orange-600',
  'Eb': 'bg-orange-600',
  'E': 'bg-yellow-500',
  'F': 'bg-lime-500',
  'F#': 'bg-green-500',
  'Gb': 'bg-green-500',
  'G': 'bg-emerald-500',
  'G#': 'bg-teal-500',
  'Ab': 'bg-teal-500',
  'A': 'bg-cyan-500',
  'A#': 'bg-blue-500',
  'Bb': 'bg-blue-500',
  'B': 'bg-purple-500',
};

export function AnalysisHUD({ className, compact = false }: AnalysisHUDProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [showSpectrum, setShowSpectrum] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const {
    localAnalysis,
    syncedAnalysis,
    analysisSource,
    isAnalyzing,
    spectrumData,
    tunerEnabled,
    setAnalysisSource,
    setTunerEnabled,
  } = useAnalysisStore();

  // Use synced values when available, fall back to local
  const displayKey = syncedAnalysis?.key || localAnalysis?.key;
  const displayScale = syncedAnalysis?.keyScale || localAnalysis?.keyScale;
  const displayBPM = syncedAnalysis?.bpm || localAnalysis?.bpm;
  const displayChord = localAnalysis?.currentChord;

  // Draw spectrum visualization
  useEffect(() => {
    if (!showSpectrum || !canvasRef.current || !spectrumData || !canvasContainerRef.current) return;

    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to match container width
    const containerWidth = container.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = 80 * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = '80px';
    ctx.scale(dpr, dpr);

    const width = containerWidth;
    const height = 80;

    // Clear canvas
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, width, height);

    // Draw spectrum bars
    const barCount = Math.min(128, Math.floor(width / 4));
    const barWidth = width / barCount;
    const step = Math.floor(spectrumData.length / barCount);

    for (let i = 0; i < barCount; i++) {
      const value = spectrumData[i * step] || -100;
      // Normalize from dB (-100 to 0) to 0-1
      const normalized = Math.max(0, (value + 100) / 100);
      const barHeight = normalized * height;

      // Color gradient based on frequency (purple to cyan)
      const hue = 280 - (i / barCount) * 100;
      ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
      ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
    }
  }, [spectrumData, showSpectrum]);

  const keyColor = displayKey ? KEY_COLORS[displayKey] || 'bg-slate-500' : 'bg-slate-300';

  const formatBPM = (bpm: number | null | undefined) => {
    if (!bpm) return '--';
    return Math.round(bpm).toString();
  };

  if (compact && !isExpanded) {
    // Compact pill view
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={cn(
          'flex items-center gap-3 px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm hover:shadow-md transition-all',
          className
        )}
      >
        {/* Key badge */}
        <div className="flex items-center gap-2">
          <div className={cn('w-3 h-3 rounded-full', keyColor)} />
          <span className="font-semibold text-slate-900">
            {displayKey || '--'} {displayScale ? (displayScale === 'minor' ? 'm' : '') : ''}
          </span>
        </div>

        <div className="h-4 w-px bg-slate-200" />

        {/* BPM */}
        <div className="flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium text-slate-700">{formatBPM(displayBPM)} BPM</span>
        </div>

        {/* Chord (if available) */}
        {displayChord && (
          <>
            <div className="h-4 w-px bg-slate-200" />
            <span className="font-medium text-indigo-600">{displayChord}</span>
          </>
        )}

        <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-900">Audio Analysis</h3>
          {isAnalyzing && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-emerald-700">Live</span>
            </span>
          )}
          {syncedAnalysis && (
            <span className="px-2 py-0.5 bg-blue-50 rounded-full text-xs font-medium text-blue-700">
              Synced
            </span>
          )}
        </div>

        {compact && (
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronUp className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      {/* Main content */}
      <div className="p-5 space-y-5">
        {/* Key and BPM - Main display */}
        <div className="grid grid-cols-2 gap-4">
          {/* Key */}
          <div className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Key</span>
            <div className="flex items-center gap-2">
              <div className={cn('w-4 h-4 rounded-full', keyColor)} />
              <span className="text-3xl font-bold text-slate-900">
                {displayKey || '--'}
                <span className="text-xl font-semibold text-slate-500">
                  {displayScale === 'minor' ? 'm' : displayScale === 'major' ? '' : ''}
                </span>
              </span>
            </div>
            {localAnalysis?.keyConfidence !== undefined && localAnalysis.keyConfidence > 0 && (
              <div className="mt-2 flex items-center gap-1.5">
                <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${localAnalysis.keyConfidence * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400">
                  {Math.round(localAnalysis.keyConfidence * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* BPM */}
          <div className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Tempo</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-slate-900">{formatBPM(displayBPM)}</span>
              <span className="text-sm font-medium text-slate-500">BPM</span>
            </div>
            {localAnalysis?.bpmConfidence !== undefined && localAnalysis.bpmConfidence > 0 && (
              <div className="mt-2 flex items-center gap-1.5">
                <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${localAnalysis.bpmConfidence * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400">
                  {Math.round(localAnalysis.bpmConfidence * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Current chord */}
        {displayChord && (
          <div className="flex items-center justify-center p-3 bg-indigo-50 rounded-xl">
            <Music className="w-4 h-4 text-indigo-500 mr-2" />
            <span className="text-lg font-semibold text-indigo-700">{displayChord}</span>
            {localAnalysis?.chordConfidence !== undefined && (
              <span className="ml-2 text-xs text-indigo-400">
                {Math.round(localAnalysis.chordConfidence * 100)}%
              </span>
            )}
          </div>
        )}

        {/* Tuner mode */}
        {tunerEnabled && localAnalysis?.tunerNote && (
          <div className="p-4 bg-slate-900 rounded-xl text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-4xl font-bold text-white">{localAnalysis.tunerNote}</span>
              {localAnalysis.tunerFrequency && (
                <span className="text-sm text-slate-400">
                  {localAnalysis.tunerFrequency.toFixed(1)} Hz
                </span>
              )}
            </div>
            {localAnalysis.tunerCents != null && (
              <div className="relative h-6 bg-slate-800 rounded-full overflow-hidden">
                {/* Center marker */}
                <div className="absolute left-1/2 top-0 w-0.5 h-full bg-emerald-500 -translate-x-1/2" />
                {/* Cents indicator */}
                <div
                  className={cn(
                    'absolute top-1 w-3 h-4 rounded-full transition-all',
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
            )}
            <div className="mt-2 text-xs text-slate-400">
              {localAnalysis.tunerCents != null &&
                (localAnalysis.tunerCents > 0 ? `+${localAnalysis.tunerCents}` : localAnalysis.tunerCents)}{' '}
              cents
            </div>
          </div>
        )}

        {/* Spectrum analyzer toggle */}
        <button
          onClick={() => setShowSpectrum(!showSpectrum)}
          className={cn(
            'w-full flex items-center justify-center gap-2 p-2 rounded-lg transition-colors',
            showSpectrum ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          <Waves className="w-4 h-4" />
          <span className="text-sm font-medium">Spectrum</span>
        </button>

        {showSpectrum && (
          <div ref={canvasContainerRef} className="rounded-lg overflow-hidden bg-slate-900">
            <canvas ref={canvasRef} className="block" />
          </div>
        )}

        {/* Loudness meter */}
        {localAnalysis && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5" />
                Level
              </span>
              <span>{Math.round(localAnalysis.loudness)}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-75',
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

        {/* Source selection */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Source:</span>
          <div className="flex-1 flex gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setAnalysisSource('backing')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                analysisSource === 'backing'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Radio className="w-3 h-3" />
              Track
            </button>
            <button
              onClick={() => setAnalysisSource('local')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                analysisSource === 'local'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Mic2 className="w-3 h-3" />
              Mic
            </button>
            <button
              onClick={() => setAnalysisSource('mixed')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                analysisSource === 'mixed'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Music className="w-3 h-3" />
              Mix
            </button>
          </div>
        </div>

        {/* Tuner toggle */}
        <button
          onClick={() => setTunerEnabled(!tunerEnabled)}
          className={cn(
            'w-full flex items-center justify-center gap-2 p-2.5 rounded-lg transition-colors',
            tunerEnabled
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          <Target className="w-4 h-4" />
          <span className="text-sm font-medium">Tuner Mode</span>
        </button>
      </div>
    </div>
  );
}

// Compact key badge for inline use
export function KeyBadge({ className }: { className?: string }) {
  const { syncedAnalysis, localAnalysis } = useAnalysisStore();

  const displayKey = syncedAnalysis?.key || localAnalysis?.key;
  const displayScale = syncedAnalysis?.keyScale || localAnalysis?.keyScale;

  if (!displayKey) return null;

  const keyColor = KEY_COLORS[displayKey] || 'bg-slate-500';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-full border border-slate-200 shadow-sm',
        className
      )}
    >
      <div className={cn('w-2.5 h-2.5 rounded-full', keyColor)} />
      <span className="text-sm font-semibold text-slate-900">
        {displayKey}
        {displayScale === 'minor' ? 'm' : ''}
      </span>
    </div>
  );
}

// Compact BPM badge for inline use
export function BPMBadge({ className }: { className?: string }) {
  const { syncedAnalysis, localAnalysis } = useAnalysisStore();

  const displayBPM = syncedAnalysis?.bpm || localAnalysis?.bpm;

  if (!displayBPM) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-full border border-slate-200 shadow-sm',
        className
      )}
    >
      <Gauge className="w-3.5 h-3.5 text-slate-400" />
      <span className="text-sm font-medium text-slate-700">{Math.round(displayBPM)} BPM</span>
    </div>
  );
}
