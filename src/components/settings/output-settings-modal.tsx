'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Modal } from '../ui/modal';
import { useAudioStore } from '@/stores/audio-store';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useNativeBridge } from '@/hooks/useNativeBridge';
import {
  Speaker,
  Volume2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  Download,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Mic,
  Play,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

interface OutputSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Generate channel options based on device channel count
function getChannelOptions(channels: { index: number; name: string }[]): { mono: number[]; stereo: [number, number][] } {
  const mono: number[] = channels.map(ch => ch.index);
  const stereo: [number, number][] = [];

  // Create stereo pairs
  for (let i = 0; i < channels.length - 1; i += 2) {
    stereo.push([channels[i].index, channels[i + 1].index]);
  }

  return { mono, stereo };
}

function formatChannel(index: number, channels: { index: number; name: string }[]): string {
  const channel = channels.find(ch => ch.index === index);
  return channel?.name || `Ch ${index + 1}`;
}

function formatStereoPair(left: number, right: number, channels: { index: number; name: string }[]): string {
  const leftCh = channels.find(ch => ch.index === left);
  const rightCh = channels.find(ch => ch.index === right);
  return `${leftCh?.name || `Ch ${left + 1}`} / ${rightCh?.name || `Ch ${right + 1}`}`;
}

export function OutputSettingsModal({ isOpen, onClose }: OutputSettingsModalProps) {
  const { outputDeviceId, masterVolume, setMasterVolume, backingTrackVolume, setBackingTrackVolume } = useAudioStore();
  const { setOutputDevice } = useAudioEngine();
  const {
    isAvailable,
    isConnected,
    driverType,
    isRunning,
    latency,
    lastError,
    connect,
    disconnect,
    getDownloadUrl,
    startAudio,
    stopAudio,
    refreshDevices,
    // Device selection
    inputDevices: bridgeInputDevices,
    outputDevices: bridgeOutputDevices,
    selectedInputDeviceId,
    selectedOutputDeviceId,
    setInputDevice: setBridgeInputDevice,
    setOutputDevice: setBridgeOutputDevice,
    // Settings
    bufferSize,
    sampleRate,
    inputChannelConfig,
    setBufferSize,
    setSampleRate,
    setChannelConfig,
    getSelectedInputDevice,
  } = useNativeBridge();

  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
  const [selectedOutput, setSelectedOutput] = useState(outputDeviceId || 'default');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Get selected input device for channel options
  const selectedBridgeInput = getSelectedInputDevice();
  const inputChannels = selectedBridgeInput?.channels || [];
  const channelOptions = getChannelOptions(inputChannels);

  // Load available browser devices
  const loadDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Request permission first to get device labels
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const devices = await navigator.mediaDevices.enumerateDevices();

      const outputs = devices
        .filter((d) => d.kind === 'audiooutput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${d.deviceId.slice(0, 8)}`,
          kind: 'audiooutput' as const,
        }));

      setOutputDevices(outputs);
    } catch {
      setError('Could not access audio devices. Please grant microphone permission.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadDevices();
      setSelectedOutput(outputDeviceId || 'default');
    }
  }, [isOpen, loadDevices, outputDeviceId]);

  const handleSave = useCallback(async () => {
    await setOutputDevice(selectedOutput);
    onClose();
  }, [selectedOutput, setOutputDevice, onClose]);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    try {
      await connect();
    } finally {
      setIsConnecting(false);
    }
  }, [connect]);

  const handleDownload = useCallback(() => {
    const url = getDownloadUrl();
    if (url) {
      window.open(url, '_blank');
    }
  }, [getDownloadUrl]);

  const handleChannelConfigChange = useCallback((config: { channelCount: 1 | 2; leftChannel: number; rightChannel?: number }) => {
    setChannelConfig(config);
  }, [setChannelConfig]);

  // Check if we can start audio
  const canStartAudio = isConnected && selectedInputDeviceId && selectedOutputDeviceId;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Audio Output Settings"
      description="Configure your audio output and volume levels"
      className="max-w-lg"
    >
      <div className="space-y-6">
        {error && (
          <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Native Bridge Section */}
        <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Low-Latency Audio Bridge
              </span>
            </div>
            {isAvailable === null ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : isConnected ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                <XCircle className="w-3.5 h-3.5" />
                Not Connected
              </span>
            )}
          </div>

          {isConnected ? (
            // Connected state - show devices and controls
            <div className="space-y-4">
              {/* Status cards */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-white/50 dark:bg-black/20 rounded-lg">
                  <div className="text-gray-500 dark:text-gray-400">Driver</div>
                  <div className="font-medium text-gray-900 dark:text-white">{driverType || 'Unknown'}</div>
                </div>
                <div className="p-2 bg-white/50 dark:bg-black/20 rounded-lg">
                  <div className="text-gray-500 dark:text-gray-400">Latency</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {isRunning ? `${latency.total.toFixed(1)}ms` : '-'}
                  </div>
                </div>
              </div>

              {/* Error display */}
              {lastError && (
                <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">{lastError.message}</span>
                </div>
              )}

              {/* Input Device Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5" />
                    Input Device
                  </label>
                  <button
                    onClick={refreshDevices}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    title="Refresh devices"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
                <div className="relative">
                  <select
                    value={selectedInputDeviceId || ''}
                    onChange={(e) => setBridgeInputDevice(e.target.value)}
                    className="w-full h-9 px-3 pr-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="">Select input device...</option>
                    {bridgeInputDevices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name} ({device.channels.length}ch)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Channel Configuration */}
              {selectedBridgeInput && inputChannels.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Input Channels
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleChannelConfigChange({
                        channelCount: 1,
                        leftChannel: inputChannelConfig.leftChannel,
                      })}
                      className={cn(
                        'p-2 rounded-lg border text-xs font-medium transition-all',
                        inputChannelConfig.channelCount === 1
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                      )}
                    >
                      Mono
                    </button>
                    <button
                      onClick={() => handleChannelConfigChange({
                        channelCount: 2,
                        leftChannel: inputChannelConfig.leftChannel,
                        rightChannel: (inputChannelConfig.leftChannel + 1) % inputChannels.length,
                      })}
                      className={cn(
                        'p-2 rounded-lg border text-xs font-medium transition-all',
                        inputChannelConfig.channelCount === 2
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
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
                        onChange={(e) => handleChannelConfigChange({
                          channelCount: 1,
                          leftChannel: parseInt(e.target.value),
                        })}
                        className="w-full h-8 px-3 pr-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {channelOptions.mono.map((ch) => (
                          <option key={ch} value={ch}>
                            {formatChannel(ch, inputChannels)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={`${inputChannelConfig.leftChannel}-${inputChannelConfig.rightChannel ?? inputChannelConfig.leftChannel + 1}`}
                        onChange={(e) => {
                          const [left, right] = e.target.value.split('-').map(Number);
                          handleChannelConfigChange({
                            channelCount: 2,
                            leftChannel: left,
                            rightChannel: right,
                          });
                        }}
                        className="w-full h-8 px-3 pr-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {channelOptions.stereo.map(([left, right]) => (
                          <option key={`${left}-${right}`} value={`${left}-${right}`}>
                            {formatStereoPair(left, right, inputChannels)}
                          </option>
                        ))}
                      </select>
                    )}
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Output Device Selection */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                  <Speaker className="w-3.5 h-3.5" />
                  Output Device
                </label>
                <div className="relative">
                  <select
                    value={selectedOutputDeviceId || ''}
                    onChange={(e) => setBridgeOutputDevice(e.target.value)}
                    className="w-full h-9 px-3 pr-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="">Select output device...</option>
                    {bridgeOutputDevices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name} ({device.channels.length}ch)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Buffer & Sample Rate Settings */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400">Buffer Size</label>
                  <select
                    value={bufferSize}
                    onChange={(e) => setBufferSize(parseInt(e.target.value) as 32 | 64 | 128 | 256 | 512 | 1024)}
                    className="w-full h-8 px-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white appearance-none"
                  >
                    <option value={32}>32 samples</option>
                    <option value={64}>64 samples</option>
                    <option value={128}>128 samples</option>
                    <option value={256}>256 samples</option>
                    <option value={512}>512 samples</option>
                    <option value={1024}>1024 samples</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400">Sample Rate</label>
                  <select
                    value={sampleRate}
                    onChange={(e) => setSampleRate(parseInt(e.target.value) as 44100 | 48000)}
                    className="w-full h-8 px-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white appearance-none"
                  >
                    <option value={48000}>48 kHz</option>
                    <option value={44100}>44.1 kHz</option>
                  </select>
                </div>
              </div>

              {/* Control buttons */}
              <div className="flex gap-2">
                {isRunning ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={stopAudio}
                    className="flex-1 text-xs h-9"
                  >
                    <Square className="w-3.5 h-3.5 mr-1.5" />
                    Stop Audio
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={startAudio}
                    disabled={!canStartAudio}
                    className="flex-1 text-xs h-9 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5" />
                    Start Audio
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disconnect}
                  className="text-xs h-9"
                >
                  Disconnect
                </Button>
              </div>

              {!canStartAudio && !isRunning && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Select input and output devices to start audio
                </p>
              )}
            </div>
          ) : (
            // Not connected - show download/connect options
            <div className="space-y-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Get ultra-low latency audio (~5ms) with ASIO/CoreAudio support by installing our native audio bridge.
              </p>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleDownload}
                  className="flex-1 text-xs h-8 bg-indigo-600 hover:bg-indigo-700"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download Bridge
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="text-xs h-8"
                >
                  {isConnecting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'Connect'
                  )}
                </Button>
              </div>

              <a
                href="https://github.com/openstudio/native-bridge#readme"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Learn more about the native bridge
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Browser Output Device - only show when bridge not connected */}
        {!isConnected && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Speaker className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                Browser Output Device
              </label>
              <Button variant="ghost" size="sm" onClick={loadDevices} className="h-7 px-2">
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
            <div className="relative">
              <select
                value={selectedOutput}
                onChange={(e) => setSelectedOutput(e.target.value)}
                disabled={isLoading}
                className="w-full h-10 px-3 pr-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50"
              >
                <option value="default">System Default</option>
                {outputDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Master Volume */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              Master Volume
            </label>
            <span className="text-sm text-gray-500 dark:text-gray-400">{Math.round(masterVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Backing Track Volume */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Backing Track Volume</label>
            <span className="text-sm text-gray-500 dark:text-gray-400">{Math.round(backingTrackVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={backingTrackVolume}
            onChange={(e) => setBackingTrackVolume(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1" disabled={isConnected}>
            Save Settings
          </Button>
        </div>
      </div>
    </Modal>
  );
}
