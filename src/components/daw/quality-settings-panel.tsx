'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Settings2,
  Zap,
  Music2,
  Headphones,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Check,
  Info,
} from 'lucide-react';
import type { QualityPresetName, OpusEncodingSettings } from '@/types';
import {
  QUALITY_PRESETS,
  getAllPresets,
  calculateBandwidthUsage,
  estimateEncodingLatency,
} from '@/lib/audio/quality-presets';
import { Tooltip } from '../ui/tooltip';

interface QualitySettingsPanelProps {
  activePreset: QualityPresetName;
  onPresetChange: (preset: QualityPresetName) => void;
  customSettings?: Partial<OpusEncodingSettings>;
  onCustomSettingsChange?: (settings: Partial<OpusEncodingSettings>) => void;
  jitterMode: 'live-jamming' | 'balanced' | 'stable';
  onJitterModeChange: (mode: 'live-jamming' | 'balanced' | 'stable') => void;
  lowLatencyMode: boolean;
  onLowLatencyModeChange: (enabled: boolean) => void;
  className?: string;
}

const presetIcons: Record<QualityPresetName, React.ReactNode> = {
  'ultra-low-latency': <Zap className="w-4 h-4" />,
  'low-latency': <Zap className="w-4 h-4" />,
  'balanced': <Settings2 className="w-4 h-4" />,
  'high-quality': <Music2 className="w-4 h-4" />,
  'studio-quality': <Headphones className="w-4 h-4" />,
  'poor-connection': <WifiOff className="w-4 h-4" />,
  'custom': <Settings2 className="w-4 h-4" />,
};

const BITRATE_OPTIONS = [24, 32, 48, 64, 96, 128, 160, 192, 256, 320, 384, 448, 510];

export function QualitySettingsPanel({
  activePreset,
  onPresetChange,
  customSettings,
  onCustomSettingsChange,
  jitterMode,
  onJitterModeChange,
  lowLatencyMode,
  onLowLatencyModeChange,
  className,
}: QualitySettingsPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const presets = getAllPresets();
  const currentPreset = QUALITY_PRESETS[activePreset];

  // Get effective settings (preset or custom)
  const effectiveSettings = activePreset === 'custom' && customSettings
    ? { ...QUALITY_PRESETS['balanced'].encoding, ...customSettings }
    : currentPreset.encoding;

  const bandwidth = calculateBandwidthUsage(effectiveSettings);
  const encodingLatency = estimateEncodingLatency(effectiveSettings);

  return (
    <div className={cn('rounded-xl border bg-white dark:bg-zinc-900 overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-indigo-500" />
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Audio Quality Settings
            </h4>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-500">
            <span>~{bandwidth} kbps</span>
            <span>•</span>
            <span>+{encodingLatency.toFixed(1)}ms</span>
          </div>
        </div>
      </div>

      {/* Presets */}
      <div className="p-4 space-y-3">
        <div className="text-xs font-medium text-gray-500 dark:text-zinc-500">
          Quality Preset
        </div>

        <div className="space-y-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onPresetChange(preset.id)}
              className={cn(
                'relative flex items-center gap-3 w-full p-3 rounded-lg border transition-all text-left',
                activePreset === preset.id
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
              )}
            >
              {activePreset === preset.id && (
                <div className="absolute top-3 right-3">
                  <Check className="w-4 h-4 text-indigo-500" />
                </div>
              )}

              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                activePreset === preset.id
                  ? 'bg-indigo-500/20 text-indigo-500'
                  : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-zinc-400'
              )}>
                {presetIcons[preset.id]}
              </div>

              <div className="flex-1 pr-6">
                <div className="flex items-center gap-2">
                  <span className="text-base">{preset.icon}</span>
                  <span className={cn(
                    'font-medium text-sm',
                    activePreset === preset.id
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-900 dark:text-white'
                  )}>
                    {preset.name}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-zinc-500 ml-auto">
                    {preset.encoding.bitrate}kbps • {preset.encoding.frameSize}ms
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                  {preset.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick settings */}
      <div className="px-4 pb-4 space-y-3">
        {/* Jitter Buffer Mode */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-zinc-500">
              <span>Jitter Buffer Mode</span>
              <Tooltip content="Controls how much audio is buffered to handle network variability. Lower = less latency, Higher = more stable.">
                <Info className="w-3 h-3" />
              </Tooltip>
            </div>
          </div>

          <div className="flex gap-2">
            {(['live-jamming', 'balanced', 'stable'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onJitterModeChange(mode)}
                className={cn(
                  'flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all',
                  jitterMode === mode
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/20'
                )}
              >
                {mode === 'live-jamming' && '⚡ Live'}
                {mode === 'balanced' && '⚖️ Balanced'}
                {mode === 'stable' && '🛡️ Stable'}
              </button>
            ))}
          </div>
        </div>

        {/* Low Latency Mode */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-zinc-500">
            <span>Low Latency Mode</span>
            <Tooltip content="Bypasses effects chain when no effects are enabled for minimum latency.">
              <Info className="w-3 h-3" />
            </Tooltip>
          </div>

          <button
            onClick={() => onLowLatencyModeChange(!lowLatencyMode)}
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors',
              lowLatencyMode ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-white/20'
            )}
          >
            <motion.div
              className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm"
              animate={{ x: lowLatencyMode ? 20 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </div>

      {/* Advanced settings toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
          Advanced Settings
        </span>
        {showAdvanced ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Advanced settings */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-200 dark:border-white/10"
          >
            <div className="p-4 space-y-4">
              {/* Bitrate */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-zinc-500">
                    Bitrate
                  </label>
                  <span className="text-xs text-gray-700 dark:text-zinc-300 font-mono">
                    {effectiveSettings.bitrate} kbps
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={BITRATE_OPTIONS.length - 1}
                  value={BITRATE_OPTIONS.indexOf(effectiveSettings.bitrate)}
                  onChange={(e) => {
                    const bitrate = BITRATE_OPTIONS[parseInt(e.target.value)];
                    if (activePreset !== 'custom') {
                      onPresetChange('custom');
                    }
                    onCustomSettingsChange?.({ ...customSettings, bitrate });
                  }}
                  className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>24k</span>
                  <span>128k</span>
                  <span>256k</span>
                  <span>510k</span>
                </div>
              </div>

              {/* Frame Size */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-zinc-500">
                    Frame Size
                  </label>
                </div>
                <div className="flex gap-2">
                  {([10, 20] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        if (activePreset !== 'custom') {
                          onPresetChange('custom');
                        }
                        onCustomSettingsChange?.({ ...customSettings, frameSize: size });
                      }}
                      className={cn(
                        'flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all',
                        effectiveSettings.frameSize === size
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-zinc-400'
                      )}
                    >
                      {size}ms {size === 10 ? '(Low Latency)' : '(Better Quality)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* FEC and DTX */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-white/5">
                  <div>
                    <div className="text-xs font-medium text-gray-700 dark:text-zinc-300">FEC</div>
                    <div className="text-[10px] text-gray-500 dark:text-zinc-500">Error correction</div>
                  </div>
                  <button
                    onClick={() => {
                      if (activePreset !== 'custom') {
                        onPresetChange('custom');
                      }
                      onCustomSettingsChange?.({ ...customSettings, fec: !effectiveSettings.fec });
                    }}
                    className={cn(
                      'relative w-9 h-5 rounded-full transition-colors',
                      effectiveSettings.fec ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-white/20'
                    )}
                  >
                    <motion.div
                      className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
                      animate={{ x: effectiveSettings.fec ? 16 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-white/5">
                  <div>
                    <div className="text-xs font-medium text-gray-700 dark:text-zinc-300">DTX</div>
                    <div className="text-[10px] text-gray-500 dark:text-zinc-500">Save bandwidth</div>
                  </div>
                  <button
                    onClick={() => {
                      if (activePreset !== 'custom') {
                        onPresetChange('custom');
                      }
                      onCustomSettingsChange?.({ ...customSettings, dtx: !effectiveSettings.dtx });
                    }}
                    className={cn(
                      'relative w-9 h-5 rounded-full transition-colors',
                      effectiveSettings.dtx ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-white/20'
                    )}
                  >
                    <motion.div
                      className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
                      animate={{ x: effectiveSettings.dtx ? 16 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-white/5">
                  <div>
                    <div className="text-xs font-medium text-gray-700 dark:text-zinc-300">CBR</div>
                    <div className="text-[10px] text-gray-500 dark:text-zinc-500">Constant bitrate</div>
                  </div>
                  <button
                    onClick={() => {
                      if (activePreset !== 'custom') {
                        onPresetChange('custom');
                      }
                      onCustomSettingsChange?.({ ...customSettings, cbr: !effectiveSettings.cbr });
                    }}
                    className={cn(
                      'relative w-9 h-5 rounded-full transition-colors',
                      effectiveSettings.cbr ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-white/20'
                    )}
                  >
                    <motion.div
                      className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
                      animate={{ x: effectiveSettings.cbr ? 16 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-white/5">
                  <div>
                    <div className="text-xs font-medium text-gray-700 dark:text-zinc-300">In-band FEC</div>
                    <div className="text-[10px] text-gray-500 dark:text-zinc-500">Voice redundancy</div>
                  </div>
                  <button
                    onClick={() => {
                      if (activePreset !== 'custom') {
                        onPresetChange('custom');
                      }
                      onCustomSettingsChange?.({ ...customSettings, inbandFec: !effectiveSettings.inbandFec });
                    }}
                    className={cn(
                      'relative w-9 h-5 rounded-full transition-colors',
                      effectiveSettings.inbandFec ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-white/20'
                    )}
                  >
                    <motion.div
                      className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
                      animate={{ x: effectiveSettings.inbandFec ? 16 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </div>

              {/* Complexity */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-zinc-500">
                    Encoder Complexity
                  </label>
                  <span className="text-xs text-gray-700 dark:text-zinc-300 font-mono">
                    {effectiveSettings.complexity}/10
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={effectiveSettings.complexity}
                  onChange={(e) => {
                    if (activePreset !== 'custom') {
                      onPresetChange('custom');
                    }
                    onCustomSettingsChange?.({ ...customSettings, complexity: parseInt(e.target.value) });
                  }}
                  className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>Fast (low CPU)</span>
                  <span>Best Quality (high CPU)</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
