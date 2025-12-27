'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAnalysisStore } from '@/stores/analysis-store';
import {
  Music,
  Radio,
  Mic2,
  Volume2,
  ChevronDown,
  Gauge,
  Target,
  Waves,
  Zap,
  Music2,
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

  // Track container width for canvas sizing
  const [containerWidth, setContainerWidth] = useState(0);

  // Use ResizeObserver to track container size changes
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const container = canvasContainerRef.current;

    const updateWidth = () => {
      const width = container.clientWidth;
      if (width > 0) {
        setContainerWidth(width);
      }
    };

    // Initial measurement after a frame
    requestAnimationFrame(updateWidth);

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Draw spectrum visualization with logarithmic frequency scaling
  useEffect(() => {
    if (!canvasRef.current || !spectrumData || containerWidth === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to match container width
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

    // Use logarithmic frequency scaling for better musical representation
    const nyquist = 22050;
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

      // Average neighboring bins for smoother display
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

      // Color gradient based on frequency (purple to cyan)
      const hue = 280 - freqRatio * 100;
      ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
      ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
    }
  }, [spectrumData, containerWidth]);

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
      {/* Main content */}
      <div className="p-5 space-y-5">
        {/* Key and BPM - Main display */}
        <div className="grid grid-cols-2 gap-4">
          {/* Key & Scale */}
          <div className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Key & Scale</span>
            <div className="flex items-center gap-2">
              <div className={cn('w-4 h-4 rounded-full shrink-0', keyColor)} />
              <span className="text-3xl font-bold text-slate-900 leading-tight">
                {displayKey || '--'}
                {displayScale && (
                  <span className={cn(
                    'text-sm font-medium ml-1',
                    displayScale === 'minor'
                      ? 'text-indigo-500'
                      : 'text-amber-500'
                  )}>
                    {displayScale === 'minor' ? 'min' : 'maj'}
                  </span>
                )}
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
        {tunerEnabled && (
          <div className="p-4 bg-slate-900 rounded-xl text-center">
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
                    <div className="text-sm text-slate-400">
                      {localAnalysis.tunerFrequency?.toFixed(1)} Hz
                    </div>
                    <div className="text-xs text-slate-500">
                      {localAnalysis.tunerIsStable ? 'Stable' : 'Detecting...'}
                    </div>
                  </div>
                </div>

                {/* Cents meter */}
                {localAnalysis.tunerCents != null && (
                  <>
                    <div className="relative h-6 bg-slate-800 rounded-full overflow-hidden mb-2">
                      {/* Scale markers */}
                      <div className="absolute inset-0 flex justify-between px-2 items-center">
                        <span className="text-[8px] text-slate-600">-50</span>
                        <span className="text-[8px] text-slate-600">0</span>
                        <span className="text-[8px] text-slate-600">+50</span>
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
                <Target className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Play a note to tune</p>
                <p className="text-xs text-slate-500 mt-1">Works best with single notes</p>
              </div>
            )}
          </div>
        )}

        {/* Spectrum Analyzer - Always Visible */}
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <Waves className="w-3.5 h-3.5" />
            <span>Spectrum</span>
          </div>
          <div ref={canvasContainerRef} className="rounded-lg overflow-hidden bg-slate-900">
            <canvas ref={canvasRef} className="block w-full" />
            <div className="flex justify-between px-2 py-1 text-[9px] text-slate-400">
              <span>20Hz</span>
              <span>1kHz</span>
              <span>20kHz</span>
            </div>
          </div>
        </div>

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

        {/* Additional analysis info */}
        <div className="grid grid-cols-3 gap-2">
          {/* Energy */}
          <div className="flex flex-col items-center p-2 bg-slate-50 rounded-lg">
            <Zap className="w-3.5 h-3.5 text-amber-500 mb-1" />
            <span className="text-xs text-slate-500">Energy</span>
            <span className="text-sm font-semibold text-slate-700">
              {localAnalysis && localAnalysis.energy > 0 ? (localAnalysis.energy * 100).toFixed(0) + '%' : '--'}
            </span>
          </div>

          {/* Danceability */}
          <div className="flex flex-col items-center p-2 bg-slate-50 rounded-lg">
            <Music2 className="w-3.5 h-3.5 text-pink-500 mb-1" />
            <span className="text-xs text-slate-500">Dance</span>
            <span className="text-sm font-semibold text-slate-700">
              {localAnalysis && localAnalysis.danceability > 0 ? (localAnalysis.danceability * 100).toFixed(0) + '%' : '--'}
            </span>
          </div>

          {/* Tuning */}
          <div className="flex flex-col items-center p-2 bg-slate-50 rounded-lg">
            <Target className="w-3.5 h-3.5 text-cyan-500 mb-1" />
            <span className="text-xs text-slate-500">Tuning</span>
            <span className={cn(
              'text-sm font-semibold',
              localAnalysis?.tuningFrequency && Math.abs(localAnalysis.tuningFrequency - 440) > 2
                ? 'text-amber-600'
                : 'text-slate-700'
            )}>
              {localAnalysis?.tuningFrequency ? `${localAnalysis.tuningFrequency.toFixed(1)}Hz` : '440Hz'}
            </span>
          </div>
        </div>

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
          onClick={() => {
            setTunerEnabled(!tunerEnabled);
            // Auto-switch to mic source when enabling tuner
            if (!tunerEnabled) {
              setAnalysisSource('local');
            }
          }}
          className={cn(
            'w-full flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg transition-colors',
            tunerEnabled
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            <span className="text-sm font-medium">Tuner Mode</span>
          </div>
          {!tunerEnabled && (
            <span className="text-xs text-slate-400">Uses microphone to tune your instrument</span>
          )}
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
