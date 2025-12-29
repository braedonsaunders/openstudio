'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { useNativeBridge } from '@/hooks/useNativeBridge';
import type { UserTrack, TrackAudioSettings as TAS } from '@/types';
import {
  Mic,
  Monitor,
  Settings2,
  X,
  ChevronDown,
  AlertCircle,
  Headphones,
  Zap,
} from 'lucide-react';

interface TrackAudioSettingsProps {
  track: UserTrack;
  onClose?: () => void;
  compact?: boolean;
}

export function TrackAudioSettingsPopover({ track, onClose, compact = false }: TrackAudioSettingsProps) {
  const { inputDevices, devicesLoaded, loadDevices, updateTrackSettings } = useUserTracksStore();
  const {
    isConnected: bridgeConnected,
    preferNativeBridge,
    inputChannelConfig,
    setChannelConfig,
    getSelectedInputDevice,
  } = useNativeBridge();

  const [testingInput, setTestingInput] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [appCaptureSupported, setAppCaptureSupported] = useState(false);
  const testStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Determine if using native bridge for input
  const usingNativeBridge = bridgeConnected && preferNativeBridge;
  const selectedBridgeInput = getSelectedInputDevice();
  const bridgeInputChannels = selectedBridgeInput?.channels || [];

  useEffect(() => {
    setAppCaptureSupported('getDisplayMedia' in navigator.mediaDevices);
    if (!devicesLoaded) {
      loadDevices();
    }
  }, [devicesLoaded, loadDevices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      testStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
    };
  }, []);

  const handleSettingChange = useCallback(
    (updates: Partial<TAS>) => {
      updateTrackSettings(track.id, updates);
      setError(null);
    },
    [track.id, updateTrackSettings]
  );

  const testInput = useCallback(async () => {
    setTestingInput(true);
    setError(null);

    try {
      let stream: MediaStream;

      if (track.audioSettings.inputMode === 'application') {
        // Application capture via getDisplayMedia
        stream = await navigator.mediaDevices.getDisplayMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: true,
        });
        // Stop video track immediately
        stream.getVideoTracks().forEach((t) => t.stop());

        // Update the track with application name from the video track label
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          handleSettingChange({ applicationName: videoTrack.label || 'Screen Audio' });
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: track.audioSettings.inputDeviceId !== 'default'
              ? { exact: track.audioSettings.inputDeviceId }
              : undefined,
            sampleRate: track.audioSettings.sampleRate,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      }

      testStreamRef.current = stream;
      const audioContext = new AudioContext({ sampleRate: track.audioSettings.sampleRate });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!testStreamRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setInputLevel(average / 255);
        requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // Stop after 10 seconds
      setTimeout(() => {
        stopTesting();
      }, 10000);
    } catch {
      setError(
        track.audioSettings.inputMode === 'application'
          ? 'Select a tab or window with audio playing'
          : 'Could not access microphone'
      );
      setTestingInput(false);
    }
  }, [track.audioSettings, handleSettingChange]);

  const stopTesting = useCallback(() => {
    testStreamRef.current?.getTracks().forEach((t) => t.stop());
    testStreamRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    setTestingInput(false);
    setInputLevel(0);
  }, []);

  if (compact) {
    return (
      <CompactAudioSettings
        track={track}
        inputDevices={inputDevices}
        appCaptureSupported={appCaptureSupported}
        onSettingChange={handleSettingChange}
        onTestInput={testInput}
        testingInput={testingInput}
        inputLevel={inputLevel}
        onStopTesting={stopTesting}
      />
    );
  }

  return (
    <div className="w-72 bg-white dark:bg-[#16161f] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">Audio Input</span>
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

      <div className="p-4 space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Native Bridge Input (when using native bridge) */}
        {usingNativeBridge ? (
          <div className="space-y-4">
            {/* Native Bridge Status */}
            <div className="flex items-center gap-2 p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
              <Zap className="w-4 h-4 text-indigo-400" />
              <div>
                <span className="text-xs text-indigo-300">Using Native Audio Bridge</span>
                {selectedBridgeInput && (
                  <div className="text-[10px] text-indigo-400/70 mt-0.5">
                    {selectedBridgeInput.name}
                  </div>
                )}
              </div>
            </div>

            {/* Channel Selection */}
            {bridgeInputChannels.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Input Channels</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setChannelConfig({
                      channelCount: 1,
                      leftChannel: inputChannelConfig.leftChannel,
                    })}
                    className={cn(
                      'p-2 rounded-lg border text-xs font-medium transition-all',
                      inputChannelConfig.channelCount === 1
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                        : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-zinc-500'
                    )}
                  >
                    Mono
                  </button>
                  <button
                    onClick={() => setChannelConfig({
                      channelCount: 2,
                      leftChannel: inputChannelConfig.leftChannel,
                      rightChannel: (inputChannelConfig.leftChannel + 1) % bridgeInputChannels.length,
                    })}
                    className={cn(
                      'p-2 rounded-lg border text-xs font-medium transition-all',
                      inputChannelConfig.channelCount === 2
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                        : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-zinc-500'
                    )}
                  >
                    Stereo
                  </button>
                </div>

                {/* Channel select */}
                <div className="relative">
                  {inputChannelConfig.channelCount === 1 ? (
                    <select
                      value={inputChannelConfig.leftChannel}
                      onChange={(e) => setChannelConfig({
                        channelCount: 1,
                        leftChannel: parseInt(e.target.value),
                      })}
                      className="w-full h-8 px-3 pr-8 bg-gray-100 dark:bg-[#1a1a24] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white appearance-none"
                    >
                      {bridgeInputChannels.map((ch) => (
                        <option key={ch.index} value={ch.index}>
                          {ch.name || `Channel ${ch.index + 1}`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={`${inputChannelConfig.leftChannel}-${inputChannelConfig.rightChannel ?? inputChannelConfig.leftChannel + 1}`}
                      onChange={(e) => {
                        const [left, right] = e.target.value.split('-').map(Number);
                        setChannelConfig({
                          channelCount: 2,
                          leftChannel: left,
                          rightChannel: right,
                        });
                      }}
                      className="w-full h-8 px-3 pr-8 bg-gray-100 dark:bg-[#1a1a24] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white appearance-none"
                    >
                      {bridgeInputChannels.filter((_, i) => i < bridgeInputChannels.length - 1).map((ch, i) => (
                        <option key={`${i}-${i+1}`} value={`${i}-${i+1}`}>
                          {ch.name || `Ch ${i+1}`} / {bridgeInputChannels[i+1]?.name || `Ch ${i+2}`}
                        </option>
                      ))}
                    </select>
                  )}
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Input Mode Selection (Web Audio) */}
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
                    <div className="text-xs font-medium text-gray-900 dark:text-white">Microphone</div>
                    <div className="text-[10px] text-gray-500 dark:text-zinc-500">Direct input</div>
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

            {/* Application Capture Info */}
            {track.audioSettings.inputMode === 'application' && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-[10px] text-amber-300/90 leading-relaxed">
                  Click &quot;Test Input&quot; to select an app or browser tab. Great for amp sims, DAWs, or any audio source.
                </p>
                {track.audioSettings.applicationName && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <Headphones className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] text-amber-400 font-medium truncate">
                      {track.audioSettings.applicationName}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Device Selection (only for microphone) */}
            {track.audioSettings.inputMode === 'microphone' && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Input Device</label>
                <div className="relative">
                  <select
                    value={track.audioSettings.inputDeviceId}
                    onChange={(e) => handleSettingChange({ inputDeviceId: e.target.value })}
                    className="w-full h-9 px-3 pr-8 bg-gray-100 dark:bg-[#1a1a24] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 [&>option]:bg-gray-100 dark:[&>option]:bg-[#1a1a24] [&>option]:text-gray-900 dark:[&>option]:text-white"
                  >
                    <option value="default">System Default</option>
                    {inputDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-zinc-500 pointer-events-none" />
                </div>
              </div>
            )}
          </>
        )}

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
          <div className="h-2 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-75',
                inputLevel > 0.8 ? 'bg-red-500' : inputLevel > 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
              )}
              style={{ width: `${inputLevel * 100}%` }}
            />
          </div>
        </div>


        {/* Advanced Settings - only show for web audio (native bridge has settings in output modal) */}
        {!usingNativeBridge && (
          <details className="group">
            <summary className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-zinc-500 cursor-pointer hover:text-gray-700 dark:hover:text-zinc-300">
              <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
              Advanced
            </summary>
            <div className="mt-3 space-y-3 pl-5">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 dark:text-zinc-500">Sample Rate</label>
                <select
                  value={track.audioSettings.sampleRate}
                  onChange={(e) => handleSettingChange({ sampleRate: parseInt(e.target.value) as 48000 | 44100 })}
                  className="w-full h-7 px-2 bg-gray-100 dark:bg-[#1a1a24] border border-gray-200 dark:border-white/10 rounded text-[10px] text-gray-900 dark:text-white [&>option]:bg-gray-100 dark:[&>option]:bg-[#1a1a24] [&>option]:text-gray-900 dark:[&>option]:text-white"
                >
                  <option value={48000}>48 kHz</option>
                  <option value={44100}>44.1 kHz</option>
                </select>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-zinc-500">
                Web Audio uses a fixed 128-sample buffer. Use native bridge for lower latency.
              </p>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

// Compact inline version for track headers
function CompactAudioSettings({
  track,
  inputDevices,
  appCaptureSupported,
  onSettingChange,
  onTestInput,
  testingInput,
  inputLevel,
  onStopTesting,
}: {
  track: UserTrack;
  inputDevices: MediaDeviceInfo[];
  appCaptureSupported: boolean;
  onSettingChange: (updates: Partial<TAS>) => void;
  onTestInput: () => void;
  testingInput: boolean;
  inputLevel: number;
  onStopTesting: () => void;
}) {
  const {
    isConnected: bridgeConnected,
    preferNativeBridge,
    inputChannelConfig,
  } = useNativeBridge();

  const usingNativeBridge = bridgeConnected && preferNativeBridge;

  if (usingNativeBridge) {
    // Compact native bridge version - only shows channel config, device is set globally
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 bg-indigo-500/10 rounded-lg">
        <Zap className="w-3 h-3 text-indigo-400" />
        <span className="text-[10px] text-indigo-400">
          {inputChannelConfig.channelCount === 1 ? 'Mono' : 'Stereo'} Ch {inputChannelConfig.leftChannel + 1}
          {inputChannelConfig.channelCount === 2 && `/${(inputChannelConfig.rightChannel ?? inputChannelConfig.leftChannel + 1) + 1}`}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded-lg">
      {/* Input Mode Toggle */}
      <div className="flex items-center bg-white/5 rounded p-0.5">
        <button
          onClick={() => onSettingChange({ inputMode: 'microphone' })}
          className={cn(
            'p-1.5 rounded transition-colors',
            track.audioSettings.inputMode === 'microphone'
              ? 'bg-indigo-500 text-white'
              : 'text-zinc-500 hover:text-white'
          )}
          title="Microphone"
        >
          <Mic className="w-3 h-3" />
        </button>
        <button
          onClick={() => appCaptureSupported && onSettingChange({ inputMode: 'application' })}
          disabled={!appCaptureSupported}
          className={cn(
            'p-1.5 rounded transition-colors',
            track.audioSettings.inputMode === 'application'
              ? 'bg-indigo-500 text-white'
              : 'text-zinc-500 hover:text-white',
            !appCaptureSupported && 'opacity-50 cursor-not-allowed'
          )}
          title="Application Audio"
        >
          <Monitor className="w-3 h-3" />
        </button>
      </div>

      {/* Device Select (only for mic) */}
      {track.audioSettings.inputMode === 'microphone' && (
        <select
          value={track.audioSettings.inputDeviceId}
          onChange={(e) => onSettingChange({ inputDeviceId: e.target.value })}
          className="h-6 px-1.5 bg-transparent border border-white/10 rounded text-[10px] text-zinc-300 max-w-[100px] truncate"
        >
          <option value="default">Default</option>
          {inputDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Mic ${device.deviceId.slice(0, 4)}`}
            </option>
          ))}
        </select>
      )}

      {/* App name for application mode */}
      {track.audioSettings.inputMode === 'application' && track.audioSettings.applicationName && (
        <span className="text-[10px] text-amber-400 truncate max-w-[80px]">
          {track.audioSettings.applicationName}
        </span>
      )}

      {/* Level indicator / Test button */}
      {testingInput ? (
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-75',
                inputLevel > 0.8 ? 'bg-red-500' : inputLevel > 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
              )}
              style={{ width: `${inputLevel * 100}%` }}
            />
          </div>
          <button
            onClick={onStopTesting}
            className="text-[10px] text-red-400 hover:text-red-300"
          >
            Stop
          </button>
        </div>
      ) : (
        <button
          onClick={onTestInput}
          className="text-[10px] text-indigo-400 hover:text-indigo-300"
        >
          {track.audioSettings.inputMode === 'application' ? 'Select App' : 'Test'}
        </button>
      )}
    </div>
  );
}
