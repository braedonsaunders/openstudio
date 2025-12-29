'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Modal } from '../ui/modal';
import { useAudioStore } from '@/stores/audio-store';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useNativeBridge } from '@/hooks/useNativeBridge';
import { nativeBridge } from '@/lib/audio/native-bridge';
import {
  Speaker,
  Mic,
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
  Globe,
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

export function OutputSettingsModal({ isOpen, onClose }: OutputSettingsModalProps) {
  const { outputDeviceId, masterVolume, setMasterVolume } = useAudioStore();
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
    setBufferSize,
    setSampleRate,
    // Preference
    preferNativeBridge,
    setPreferNativeBridge,
    // Audio control
    startAudio,
    stopAudio,
  } = useNativeBridge();

  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
  const [selectedOutput, setSelectedOutput] = useState(outputDeviceId || 'default');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

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
    // Save browser output device when not using native bridge
    if (!preferNativeBridge || !isConnected) {
      await setOutputDevice(selectedOutput);
    }
    onClose();
  }, [selectedOutput, setOutputDevice, onClose, preferNativeBridge, isConnected]);

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

  // Handle master volume change - send to native bridge if connected and preferred
  const handleMasterVolumeChange = useCallback((volume: number) => {
    setMasterVolume(volume);
    if (isConnected && preferNativeBridge) {
      nativeBridge.setMasterVolume(volume);
    }
  }, [setMasterVolume, isConnected, preferNativeBridge]);

  // Determine if we're using native bridge for audio
  const usingNativeBridge = isConnected && preferNativeBridge;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Audio Settings"
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

        {/* Audio Engine Toggle - only show when bridge is available */}
        {isConnected && (
          <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Audio Engine</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {preferNativeBridge ? 'Using low-latency native bridge' : 'Using browser Web Audio'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreferNativeBridge(false)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    !preferNativeBridge
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                  )}
                >
                  <Globe className="w-3.5 h-3.5" />
                  Web Audio
                </button>
                <button
                  onClick={() => setPreferNativeBridge(true)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    preferNativeBridge
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                  )}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Native Bridge
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Native Bridge Section */}
        <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Native Audio Bridge
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
                <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">{lastError.message}</div>
                    {lastError.message.includes('not supported') && (
                      <div className="text-red-500/70 dark:text-red-400/70 mt-1">
                        Try using the same ASIO device for input/output, or increase buffer size.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Audio Device Selection (same device for input/output with ASIO) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                    <Speaker className="w-3.5 h-3.5" />
                    Audio Device
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
                    value={selectedOutputDeviceId || ''}
                    onChange={(e) => {
                      // Set both input and output to same device for ASIO compatibility
                      setBridgeInputDevice(e.target.value);
                      setBridgeOutputDevice(e.target.value);
                    }}
                    className="w-full h-9 px-3 pr-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="">Select audio device...</option>
                    {bridgeOutputDevices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name} ({device.channels.length}ch)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  ASIO uses the same device for input and output
                </p>
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
                    {/* ASIO typically supports these buffer sizes - device-specific filtering can be added later */}
                    <option value={32}>32 (~0.7ms)</option>
                    <option value={64}>64 (~1.3ms)</option>
                    <option value={128}>128 (~2.7ms)</option>
                    <option value={256}>256 (~5.3ms)</option>
                    <option value={512}>512 (~10.7ms)</option>
                    <option value={1024}>1024 (~21.3ms)</option>
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
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Lower buffer = lower latency but higher CPU. 128-256 recommended for most interfaces.
              </p>

              {/* Start/Stop Audio Button */}
              <div className="pt-2">
                {isRunning ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={stopAudio}
                    className="w-full text-xs h-9 border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <Square className="w-3.5 h-3.5 mr-1.5 fill-current" />
                    Stop Audio
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={startAudio}
                    className="w-full text-xs h-9 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                    Start Audio
                  </Button>
                )}
              </div>

              {/* Disconnect button */}
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                className="w-full text-xs h-9"
              >
                Disconnect Bridge
              </Button>
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

        {/* Browser Output Device - only show when not using native bridge */}
        {!usingNativeBridge && (
          <div className="space-y-4">
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
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Web Audio uses a fixed 128-sample buffer (~2.7ms at 48kHz). For lower latency, use the native bridge.
            </p>
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
            onChange={(e) => handleMasterVolumeChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1">
            Save Settings
          </Button>
        </div>
      </div>
    </Modal>
  );
}
