'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import type { UserTrack, TrackAudioSettings, InputChannelConfig } from '@/types';
import {
  Mic,
  Monitor,
  X,
  ChevronDown,
  AlertCircle,
  Headphones,
  Volume2,
  Sliders,
  Share2,
} from 'lucide-react';

interface AdvancedAudioSettingsProps {
  track: UserTrack;
  onClose?: () => void;
}

// Generate channel pair options based on device channel count
function getChannelOptions(channelCount: number): { mono: number[]; stereo: [number, number][] } {
  const mono: number[] = [];
  const stereo: [number, number][] = [];

  for (let i = 0; i < channelCount; i++) {
    mono.push(i);
  }

  // Create stereo pairs (1-2, 3-4, etc.)
  for (let i = 0; i < channelCount - 1; i += 2) {
    stereo.push([i, i + 1]);
  }

  return { mono, stereo };
}

// Format channel number for display (1-indexed for users)
function formatChannel(index: number): string {
  return `Ch ${index + 1}`;
}

function formatStereoPair(left: number, right: number): string {
  return `Ch ${left + 1}/${right + 1}`;
}

// Custom select styles to fix dark mode dropdown options
const selectClassName = "w-full h-9 px-3 pr-8 bg-gray-100 dark:bg-[#1a1a24] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 [&>option]:bg-gray-100 dark:[&>option]:bg-[#1a1a24] [&>option]:text-gray-900 dark:[&>option]:text-white";
const selectSmallClassName = "w-full h-8 px-3 pr-8 bg-gray-100 dark:bg-[#1a1a24] border border-gray-200 dark:border-white/10 rounded text-xs text-gray-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 [&>option]:bg-gray-100 dark:[&>option]:bg-[#1a1a24] [&>option]:text-gray-900 dark:[&>option]:text-white";
const selectTinyClassName = "w-full h-7 px-2 bg-gray-100 dark:bg-[#1a1a24] border border-gray-200 dark:border-white/10 rounded text-[10px] text-gray-900 dark:text-white [&>option]:bg-gray-100 dark:[&>option]:bg-[#1a1a24] [&>option]:text-gray-900 dark:[&>option]:text-white";

export function AdvancedAudioSettingsPopover({ track, onClose }: AdvancedAudioSettingsProps) {
  const {
    inputDevices,
    devicesLoaded,
    loadDevicesWithChannels,
    updateTrackSettings,
    updateTrackChannelConfig,
    setTrackInputGain,
    setTrackMonitoring,
    getDeviceChannelCount,
  } = useUserTracksStore();

  const [testingInput, setTestingInput] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [appCaptureSupported, setAppCaptureSupported] = useState(false);
  const testStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const appStreamRef = useRef<MediaStream | null>(null);

  const currentDevice = inputDevices.find((d) => d.deviceId === track.audioSettings.inputDeviceId);
  const channelCount = currentDevice?.channelCount || getDeviceChannelCount(track.audioSettings.inputDeviceId) || 2;
  const channelOptions = getChannelOptions(channelCount);

  useEffect(() => {
    setAppCaptureSupported('getDisplayMedia' in navigator.mediaDevices);
    if (!devicesLoaded) {
      loadDevicesWithChannels();
    }
  }, [devicesLoaded, loadDevicesWithChannels]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      testStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
      appStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleSettingChange = useCallback(
    (updates: Partial<TrackAudioSettings>) => {
      updateTrackSettings(track.id, updates);
      setError(null);
    },
    [track.id, updateTrackSettings]
  );

  const handleChannelConfigChange = useCallback(
    (config: InputChannelConfig) => {
      updateTrackChannelConfig(track.id, config);
    },
    [track.id, updateTrackChannelConfig]
  );

  // Select application source (for app capture mode)
  const selectSource = useCallback(async () => {
    setError(null);
    try {
      // Stop any existing app stream
      appStreamRef.current?.getTracks().forEach((t) => t.stop());

      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: true,
      });

      // Stop video track immediately - we only need audio
      stream.getVideoTracks().forEach((t) => t.stop());

      // Get the audio track label
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        handleSettingChange({ applicationName: audioTrack.label || 'Screen Audio' });
        appStreamRef.current = stream;
      } else {
        setError('No audio in selected source');
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      setError('Source selection cancelled');
    }
  }, [handleSettingChange]);

  // Test input levels (works for both modes)
  const testInput = useCallback(async () => {
    setTestingInput(true);
    setError(null);

    try {
      let stream: MediaStream;

      if (track.audioSettings.inputMode === 'application') {
        // Use existing app stream if available, otherwise prompt to select
        if (!appStreamRef.current || appStreamRef.current.getAudioTracks().length === 0) {
          setError('Select a source first');
          setTestingInput(false);
          return;
        }
        stream = appStreamRef.current;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: track.audioSettings.inputDeviceId !== 'default'
              ? { exact: track.audioSettings.inputDeviceId }
              : undefined,
            sampleRate: track.audioSettings.sampleRate,
            channelCount: track.audioSettings.channelConfig.channelCount,
            echoCancellation: track.audioSettings.echoCancellation,
            noiseSuppression: track.audioSettings.noiseSuppression,
            autoGainControl: track.audioSettings.autoGainControl,
          },
        });
        testStreamRef.current = stream;
      }

      const audioContext = new AudioContext({ sampleRate: track.audioSettings.sampleRate });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!testingInput) return;
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setInputLevel(average / 255);
        requestAnimationFrame(updateLevel);
      };
      updateLevel();

      setTimeout(() => {
        stopTesting();
      }, 10000);
    } catch {
      setError(
        track.audioSettings.inputMode === 'application'
          ? 'Could not access audio source'
          : 'Could not access input device'
      );
      setTestingInput(false);
    }
  }, [track.audioSettings, testingInput]);

  const stopTesting = useCallback(() => {
    // Only stop the test stream for direct input mode (keep app stream for reuse)
    if (track.audioSettings.inputMode === 'microphone') {
      testStreamRef.current?.getTracks().forEach((t) => t.stop());
      testStreamRef.current = null;
    }
    audioContextRef.current?.close();
    audioContextRef.current = null;
    setTestingInput(false);
    setInputLevel(0);
  }, [track.audioSettings.inputMode]);

  return (
    <div className="w-80 bg-white dark:bg-[#16161f] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">Advanced Audio Settings</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-5 max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {error && (
          <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Source Type Selection */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Source Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleSettingChange({ inputMode: 'microphone' })}
              className={cn(
                'flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left',
                track.audioSettings.inputMode === 'microphone'
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
              )}
            >
              <Mic className={cn(
                'w-4 h-4',
                track.audioSettings.inputMode === 'microphone' ? 'text-indigo-400' : 'text-gray-500 dark:text-zinc-500'
              )} />
              <div>
                <div className="text-xs font-medium text-gray-900 dark:text-white">Direct Input</div>
                <div className="text-[10px] text-gray-500 dark:text-zinc-500">Mic / Interface</div>
              </div>
            </button>

            <button
              onClick={() => appCaptureSupported && handleSettingChange({ inputMode: 'application' })}
              disabled={!appCaptureSupported}
              className={cn(
                'flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left',
                track.audioSettings.inputMode === 'application'
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20',
                !appCaptureSupported && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Monitor className={cn(
                'w-4 h-4',
                track.audioSettings.inputMode === 'application' ? 'text-indigo-400' : 'text-gray-500 dark:text-zinc-500'
              )} />
              <div>
                <div className="text-xs font-medium text-gray-900 dark:text-white">Application</div>
                <div className="text-[10px] text-gray-500 dark:text-zinc-500">
                  {appCaptureSupported ? 'Capture audio' : 'Not supported'}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Application Source Selection */}
        {track.audioSettings.inputMode === 'application' && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Audio Source</label>
            <button
              onClick={selectSource}
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
            >
              <Share2 className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-medium text-gray-900 dark:text-white">Select Source</span>
            </button>
            {track.audioSettings.applicationName && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded">
                <Headphones className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-medium truncate">
                  {track.audioSettings.applicationName}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Device Selection (only for direct input) */}
        {track.audioSettings.inputMode === 'microphone' && (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Input Device</label>
              <div className="relative">
                <select
                  value={track.audioSettings.inputDeviceId}
                  onChange={(e) => handleSettingChange({ inputDeviceId: e.target.value })}
                  className={selectClassName}
                >
                  <option value="default">System Default</option>
                  {inputDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Input ${device.deviceId.slice(0, 8)}`}
                      {device.channelCount && device.channelCount > 2 ? ` (${device.channelCount}ch)` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-zinc-500 pointer-events-none" />
              </div>
              {channelCount > 2 && (
                <p className="text-[10px] text-indigo-400">
                  Multi-channel interface detected: {channelCount} channels available
                </p>
              )}
            </div>

            {/* Channel Selection */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Input Channels</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleChannelConfigChange({
                    channelCount: 1,
                    leftChannel: track.audioSettings.channelConfig.leftChannel,
                  })}
                  className={cn(
                    'p-2 rounded-lg border text-xs font-medium transition-all',
                    track.audioSettings.channelConfig.channelCount === 1
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                      : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:border-gray-300 dark:hover:border-white/20'
                  )}
                >
                  Mono
                </button>
                <button
                  onClick={() => handleChannelConfigChange({
                    channelCount: 2,
                    leftChannel: track.audioSettings.channelConfig.leftChannel,
                    rightChannel: (track.audioSettings.channelConfig.leftChannel + 1) % channelCount,
                  })}
                  className={cn(
                    'p-2 rounded-lg border text-xs font-medium transition-all',
                    track.audioSettings.channelConfig.channelCount === 2
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                      : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:border-gray-300 dark:hover:border-white/20'
                  )}
                >
                  Stereo
                </button>
              </div>

              {/* Mono Channel Select */}
              {track.audioSettings.channelConfig.channelCount === 1 && (
                <div className="relative">
                  <select
                    value={track.audioSettings.channelConfig.leftChannel}
                    onChange={(e) => handleChannelConfigChange({
                      channelCount: 1,
                      leftChannel: parseInt(e.target.value),
                    })}
                    className={selectSmallClassName}
                  >
                    {channelOptions.mono.map((ch) => (
                      <option key={ch} value={ch}>
                        {formatChannel(ch)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 dark:text-zinc-500 pointer-events-none" />
                </div>
              )}

              {/* Stereo Pair Select */}
              {track.audioSettings.channelConfig.channelCount === 2 && (
                <div className="relative">
                  <select
                    value={`${track.audioSettings.channelConfig.leftChannel}-${track.audioSettings.channelConfig.rightChannel ?? track.audioSettings.channelConfig.leftChannel + 1}`}
                    onChange={(e) => {
                      const [left, right] = e.target.value.split('-').map(Number);
                      handleChannelConfigChange({
                        channelCount: 2,
                        leftChannel: left,
                        rightChannel: right,
                      });
                    }}
                    className={selectSmallClassName}
                  >
                    {channelOptions.stereo.map(([left, right]) => (
                      <option key={`${left}-${right}`} value={`${left}-${right}`}>
                        {formatStereoPair(left, right)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 dark:text-zinc-500 pointer-events-none" />
                </div>
              )}
            </div>
          </>
        )}

        {/* Input Gain */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Input Gain</label>
            <span className="text-[10px] text-gray-500 dark:text-zinc-500">
              {track.audioSettings.inputGain > 0 ? '+' : ''}{track.audioSettings.inputGain.toFixed(1)} dB
            </span>
          </div>
          <input
            type="range"
            min="-24"
            max="24"
            step="0.5"
            value={track.audioSettings.inputGain}
            onChange={(e) => setTrackInputGain(track.id, parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-[10px] text-gray-500 dark:text-zinc-600">
            <span>-24 dB</span>
            <span>0 dB</span>
            <span>+24 dB</span>
          </div>
        </div>

        {/* Input Level Test */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Input Level</label>
            <button
              onClick={testingInput ? stopTesting : testInput}
              className={cn(
                'px-2 py-1 text-[10px] font-medium rounded transition-colors',
                testingInput
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
              )}
            >
              {testingInput ? 'Stop' : 'Test Input'}
            </button>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-75 rounded-full',
                inputLevel > 0.8 ? 'bg-red-500' : inputLevel > 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
              )}
              style={{ width: `${inputLevel * 100}%` }}
            />
          </div>
        </div>

        {/* Direct Monitoring */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Direct Monitoring</label>
            <button
              onClick={() => setTrackMonitoring(track.id, !track.audioSettings.directMonitoring)}
              className={cn(
                'px-3 py-1 text-[10px] font-medium rounded transition-colors',
                track.audioSettings.directMonitoring
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-gray-200 dark:bg-white/5 text-gray-600 dark:text-zinc-500'
              )}
            >
              {track.audioSettings.directMonitoring ? 'On' : 'Off'}
            </button>
          </div>
          {track.audioSettings.directMonitoring && (
            <div className="flex items-center gap-2">
              <Volume2 className="w-3 h-3 text-gray-500 dark:text-zinc-500" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={track.audioSettings.monitoringVolume}
                onChange={(e) => setTrackMonitoring(track.id, true, parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500"
              />
              <span className="text-[10px] text-gray-500 dark:text-zinc-500 w-8 text-right">
                {Math.round(track.audioSettings.monitoringVolume * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Processing Options (only for direct input) */}
        {track.audioSettings.inputMode === 'microphone' && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Browser Processing</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => handleSettingChange({ echoCancellation: !track.audioSettings.echoCancellation })}
                className={cn(
                  'px-2 py-1 rounded text-[10px] font-medium transition-colors',
                  track.audioSettings.echoCancellation
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'bg-gray-200 dark:bg-white/5 text-gray-600 dark:text-zinc-500 hover:bg-gray-300 dark:hover:bg-white/10'
                )}
              >
                Echo Cancel
              </button>
              <button
                onClick={() => handleSettingChange({ noiseSuppression: !track.audioSettings.noiseSuppression })}
                className={cn(
                  'px-2 py-1 rounded text-[10px] font-medium transition-colors',
                  track.audioSettings.noiseSuppression
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'bg-gray-200 dark:bg-white/5 text-gray-600 dark:text-zinc-500 hover:bg-gray-300 dark:hover:bg-white/10'
                )}
              >
                Noise Suppress
              </button>
              <button
                onClick={() => handleSettingChange({ autoGainControl: !track.audioSettings.autoGainControl })}
                className={cn(
                  'px-2 py-1 rounded text-[10px] font-medium transition-colors',
                  track.audioSettings.autoGainControl
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'bg-gray-200 dark:bg-white/5 text-gray-600 dark:text-zinc-500 hover:bg-gray-300 dark:hover:bg-white/10'
                )}
              >
                Auto Gain
              </button>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-zinc-600">Disable all for audio interfaces & instruments</p>
          </div>
        )}

        {/* Advanced Settings */}
        <details className="group">
          <summary className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-zinc-500 cursor-pointer hover:text-gray-700 dark:hover:text-zinc-300">
            <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
            Advanced
          </summary>
          <div className="mt-3 space-y-3 pl-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 dark:text-zinc-500">Sample Rate</label>
                <select
                  value={track.audioSettings.sampleRate}
                  onChange={(e) => handleSettingChange({ sampleRate: parseInt(e.target.value) as 48000 | 44100 })}
                  className={selectTinyClassName}
                >
                  <option value={48000}>48 kHz</option>
                  <option value={44100}>44.1 kHz</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 dark:text-zinc-500">Buffer Size</label>
                <select
                  value={track.audioSettings.bufferSize}
                  onChange={(e) => handleSettingChange({ bufferSize: parseInt(e.target.value) as 128 | 256 | 512 | 1024 })}
                  className={selectTinyClassName}
                >
                  <option value={128}>128 (lowest latency)</option>
                  <option value={256}>256</option>
                  <option value={512}>512</option>
                  <option value={1024}>1024 (most stable)</option>
                </select>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-zinc-600">
              Lower buffer = lower latency but may cause audio glitches
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
