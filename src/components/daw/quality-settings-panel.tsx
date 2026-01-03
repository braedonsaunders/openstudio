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

export type NetworkMode = 'auto' | 'sfu';

interface QualitySettingsPanelProps {
  activePreset: QualityPresetName;
  onPresetChange: (preset: QualityPresetName) => void;
  customSettings?: Partial<OpusEncodingSettings>;
  onCustomSettingsChange?: (settings: Partial<OpusEncodingSettings>) => void;
  jitterMode: 'live-jamming' | 'balanced' | 'stable';
  onJitterModeChange: (mode: 'live-jamming' | 'balanced' | 'stable') => void;
  lowLatencyMode: boolean;
  onLowLatencyModeChange: (enabled: boolean) => void;
  networkMode?: NetworkMode;
  onNetworkModeChange?: (mode: NetworkMode) => void;
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
  networkMode = 'auto',
  onNetworkModeChange,
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
      <div className="px-3 py-2 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5 text-indigo-500" />
            <h4 className="text-xs font-medium text-gray-900 dark:text-white">
              Audio Quality
            </h4>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-zinc-500 font-mono">
            <span>{bandwidth}kbps</span>
            <span className="text-gray-300 dark:text-zinc-600">·</span>
            <span>+{encodingLatency.toFixed(1)}ms</span>
          </div>
        </div>
      </div>

      {/* Presets */}
      <div className="p-3">
        <div className="grid grid-cols-2 gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onPresetChange(preset.id)}
              className={cn(
                'relative flex items-center gap-2 w-full px-2.5 py-2 rounded-lg border transition-all text-left',
                activePreset === preset.id
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
              )}
            >
              {activePreset === preset.id && (
                <div className="absolute top-1.5 right-1.5">
                  <Check className="w-3 h-3 text-indigo-500" />
                </div>
              )}

              <span className="text-sm">{preset.icon}</span>
              <div className="flex-1 min-w-0 pr-4">
                <div className={cn(
                  'font-medium text-xs truncate',
                  activePreset === preset.id
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-900 dark:text-white'
                )}>
                  {preset.name}
                </div>
                <div className="text-[10px] text-gray-400 dark:text-zinc-500">
                  {preset.encoding.bitrate}k · {preset.encoding.frameSize}ms
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick settings */}
      <div className="px-3 pb-3 space-y-2">
        {/* Jitter Buffer Mode */}
        <div>
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-[10px] font-medium text-gray-500 dark:text-zinc-500">Buffer</span>
            <Tooltip content="Controls how much audio is buffered to handle network variability.">
              <Info className="w-2.5 h-2.5 text-gray-400" />
            </Tooltip>
          </div>

          <div className="flex gap-1">
            {(['live-jamming', 'balanced', 'stable'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onJitterModeChange(mode)}
                className={cn(
                  'flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all',
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
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-medium text-gray-500 dark:text-zinc-500">Low Latency</span>
            <Tooltip content="Bypasses effects chain for minimum latency.">
              <Info className="w-2.5 h-2.5 text-gray-400" />
            </Tooltip>
          </div>

          <button
            onClick={() => onLowLatencyModeChange(!lowLatencyMode)}
            className={cn(
              'relative w-9 h-5 rounded-full transition-colors',
              lowLatencyMode ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-white/20'
            )}
          >
            <motion.div
              className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
              animate={{ x: lowLatencyMode ? 16 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>

        {/* Network Mode */}
        {onNetworkModeChange && (
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-[10px] font-medium text-gray-500 dark:text-zinc-500">Network</span>
              <Tooltip content="Auto: P2P mesh for lowest latency. SFU: Force cloud relay for reliability.">
                <Info className="w-2.5 h-2.5 text-gray-400" />
              </Tooltip>
            </div>

            <div className="flex gap-1">
              {(['auto', 'sfu'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onNetworkModeChange(mode)}
                  className={cn(
                    'flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all',
                    networkMode === mode
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/20'
                  )}
                >
                  {mode === 'auto' && (
                    <>
                      <Wifi className="w-3 h-3 inline mr-1" />
                      Auto (P2P)
                    </>
                  )}
                  {mode === 'sfu' && (
                    <>
                      <WifiOff className="w-3 h-3 inline mr-1" />
                      Cloud (SFU)
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Advanced settings toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full px-3 py-2 flex items-center justify-between border-t border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
      >
        <span className="text-[10px] font-medium text-gray-500 dark:text-zinc-400">
          Advanced
        </span>
        {showAdvanced ? (
          <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
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
            <div className="p-3 space-y-3">
              {/* Bitrate */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500">
                    Bitrate
                  </label>
                  <span className="text-[10px] text-gray-700 dark:text-zinc-300 font-mono">
                    {effectiveSettings.bitrate}k
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
                  className="w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500"
                />
              </div>

              {/* Frame Size */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500">
                    Frame
                  </label>
                </div>
                <div className="flex gap-1">
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
                        'flex-1 px-2 py-1 text-[10px] font-medium rounded-md transition-all',
                        effectiveSettings.frameSize === size
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-zinc-400'
                      )}
                    >
                      {size}ms
                    </button>
                  ))}
                </div>
              </div>

              {/* FEC and DTX */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex items-center justify-between p-1.5 rounded-md bg-gray-50 dark:bg-white/5">
                  <span className="text-[10px] font-medium text-gray-600 dark:text-zinc-400">FEC</span>
                  <button
                    onClick={() => {
                      if (activePreset !== 'custom') {
                        onPresetChange('custom');
                      }
                      onCustomSettingsChange?.({ ...customSettings, fec: !effectiveSettings.fec });
                    }}
                    className={cn(
                      'relative w-7 h-4 rounded-full transition-colors',
                      effectiveSettings.fec ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-white/20'
                    )}
                  >
                    <motion.div
                      className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm"
                      animate={{ x: effectiveSettings.fec ? 12 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-1.5 rounded-md bg-gray-50 dark:bg-white/5">
                  <span className="text-[10px] font-medium text-gray-600 dark:text-zinc-400">DTX</span>
                  <button
                    onClick={() => {
                      if (activePreset !== 'custom') {
                        onPresetChange('custom');
                      }
                      onCustomSettingsChange?.({ ...customSettings, dtx: !effectiveSettings.dtx });
                    }}
                    className={cn(
                      'relative w-7 h-4 rounded-full transition-colors',
                      effectiveSettings.dtx ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-white/20'
                    )}
                  >
                    <motion.div
                      className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm"
                      animate={{ x: effectiveSettings.dtx ? 12 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-1.5 rounded-md bg-gray-50 dark:bg-white/5">
                  <span className="text-[10px] font-medium text-gray-600 dark:text-zinc-400">CBR</span>
                  <button
                    onClick={() => {
                      if (activePreset !== 'custom') {
                        onPresetChange('custom');
                      }
                      onCustomSettingsChange?.({ ...customSettings, cbr: !effectiveSettings.cbr });
                    }}
                    className={cn(
                      'relative w-7 h-4 rounded-full transition-colors',
                      effectiveSettings.cbr ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-white/20'
                    )}
                  >
                    <motion.div
                      className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm"
                      animate={{ x: effectiveSettings.cbr ? 12 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-1.5 rounded-md bg-gray-50 dark:bg-white/5">
                  <span className="text-[10px] font-medium text-gray-600 dark:text-zinc-400">IFEC</span>
                  <button
                    onClick={() => {
                      if (activePreset !== 'custom') {
                        onPresetChange('custom');
                      }
                      onCustomSettingsChange?.({ ...customSettings, inbandFec: !effectiveSettings.inbandFec });
                    }}
                    className={cn(
                      'relative w-7 h-4 rounded-full transition-colors',
                      effectiveSettings.inbandFec ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-white/20'
                    )}
                  >
                    <motion.div
                      className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm"
                      animate={{ x: effectiveSettings.inbandFec ? 12 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </div>

              {/* Complexity */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500">
                    Complexity
                  </label>
                  <span className="text-[10px] text-gray-700 dark:text-zinc-300 font-mono">
                    {effectiveSettings.complexity}
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
                  className="w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
