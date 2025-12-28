'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Modal } from '../ui/modal';
import {
  Mic,
  Speaker,
  Monitor,
  Volume2,
  AlertCircle,
  Check,
  RefreshCw,
  Headphones,
  Radio,
} from 'lucide-react';

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: AudioSettings) => void;
  currentSettings?: AudioSettings;
}

export interface AudioSettings {
  inputDeviceId: string;
  outputDeviceId: string;
  inputMode: 'microphone' | 'application';
  sampleRate: 48000 | 44100;
  bufferSize: 32 | 64 | 128 | 256 | 512 | 1024;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
}

const DEFAULT_SETTINGS: AudioSettings = {
  inputDeviceId: 'default',
  outputDeviceId: 'default',
  inputMode: 'microphone',
  sampleRate: 48000,
  bufferSize: 256,
  noiseSuppression: false,
  echoCancellation: false,
  autoGainControl: false,
};

export function AudioSettingsModal({
  isOpen,
  onClose,
  onSettingsChange,
  currentSettings = DEFAULT_SETTINGS,
}: AudioSettingsModalProps) {
  const [settings, setSettings] = useState<AudioSettings>(currentSettings);
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingInput, setTestingInput] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [appCaptureSupported, setAppCaptureSupported] = useState(false);

  // Check for app capture support
  useEffect(() => {
    // getDisplayMedia with audio is supported in most modern browsers
    setAppCaptureSupported('getDisplayMedia' in navigator.mediaDevices);
  }, []);

  // Load available devices
  const loadDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Request permission first to get device labels
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const devices = await navigator.mediaDevices.enumerateDevices();

      const inputs = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
          kind: 'audioinput' as const,
        }));

      const outputs = devices
        .filter((d) => d.kind === 'audiooutput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${d.deviceId.slice(0, 8)}`,
          kind: 'audiooutput' as const,
        }));

      setInputDevices(inputs);
      setOutputDevices(outputs);
    } catch (err) {
      setError('Could not access audio devices. Please grant microphone permission.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
  }, [isOpen, loadDevices]);

  // Test input level
  const testInput = useCallback(async () => {
    setTestingInput(true);
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;

    try {
      if (settings.inputMode === 'application') {
        // Request screen/app audio capture
        stream = await navigator.mediaDevices.getDisplayMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: true, // Required but we'll ignore it
        });
        // Stop video track immediately
        stream.getVideoTracks().forEach((t) => t.stop());
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: settings.inputDeviceId !== 'default' ? { exact: settings.inputDeviceId } : undefined,
            sampleRate: settings.sampleRate,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      }

      audioContext = new AudioContext({ sampleRate: settings.sampleRate });
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

      // Stop after 5 seconds
      setTimeout(() => {
        setTestingInput(false);
        stream?.getTracks().forEach((t) => t.stop());
        audioContext?.close();
        setInputLevel(0);
      }, 5000);
    } catch (err) {
      setError(settings.inputMode === 'application'
        ? 'Could not capture application audio. Make sure to select an app with audio.'
        : 'Could not access microphone.');
      setTestingInput(false);
    }
  }, [settings]);

  const handleSave = useCallback(() => {
    onSettingsChange(settings);
    onClose();
  }, [settings, onSettingsChange, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Audio Settings"
      description="Configure your audio input and output devices"
      className="max-w-lg"
    >
      <div className="space-y-6">
        {error && (
          <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Input Mode Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Audio Source</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSettings({ ...settings, inputMode: 'microphone' })}
              className={cn(
                'flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                settings.inputMode === 'microphone'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                settings.inputMode === 'microphone' ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              )}>
                <Mic className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900 dark:text-white">Microphone</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Direct audio input</div>
              </div>
            </button>

            <button
              onClick={() => setSettings({ ...settings, inputMode: 'application' })}
              disabled={!appCaptureSupported}
              className={cn(
                'flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                settings.inputMode === 'application'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                !appCaptureSupported && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                settings.inputMode === 'application' ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              )}>
                <Monitor className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900 dark:text-white">Application</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {appCaptureSupported ? 'Capture app audio' : 'Not supported'}
                </div>
              </div>
            </button>
          </div>
          {settings.inputMode === 'application' && (
            <p className="text-xs text-gray-600 dark:text-gray-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 rounded-lg">
              Tip: Select a window or tab with audio (e.g., Guitar Rig, Amp sims, DAW output).
              The browser will ask you to choose which app to capture.
            </p>
          )}
        </div>

        {/* Input Device (only for microphone mode) */}
        {settings.inputMode === 'microphone' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Input Device</label>
              <Button variant="ghost" size="sm" onClick={loadDevices} className="h-7 px-2">
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
            <select
              value={settings.inputDeviceId}
              onChange={(e) => setSettings({ ...settings, inputDeviceId: e.target.value })}
              className="w-full h-10 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 [&>option]:bg-white dark:[&>option]:bg-gray-800 [&>option]:text-gray-900 dark:[&>option]:text-white"
            >
              <option value="default">System Default</option>
              {inputDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Output Device */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Output Device</label>
          <select
            value={settings.outputDeviceId}
            onChange={(e) => setSettings({ ...settings, outputDeviceId: e.target.value })}
            className="w-full h-10 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 [&>option]:bg-white dark:[&>option]:bg-gray-800 [&>option]:text-gray-900 dark:[&>option]:text-white"
          >
            <option value="default">System Default</option>
            {outputDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>

        {/* Input Level Test */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Input Level</label>
            <Button
              variant="outline"
              size="sm"
              onClick={testInput}
              disabled={testingInput}
              className="h-7"
            >
              {testingInput ? 'Testing...' : 'Test Input'}
            </Button>
          </div>
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-75',
                inputLevel > 0.8 ? 'bg-red-500' : inputLevel > 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
              )}
              style={{ width: `${inputLevel * 100}%` }}
            />
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Advanced</h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">Sample Rate</label>
              <select
                value={settings.sampleRate}
                onChange={(e) => setSettings({ ...settings, sampleRate: parseInt(e.target.value) as 48000 | 44100 })}
                className="w-full h-9 px-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-800 [&>option]:text-gray-900 dark:[&>option]:text-white"
              >
                <option value={48000}>48 kHz</option>
                <option value={44100}>44.1 kHz</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">Buffer Size</label>
              <select
                value={settings.bufferSize}
                onChange={(e) => setSettings({ ...settings, bufferSize: parseInt(e.target.value) as 32 | 64 | 128 | 256 | 512 | 1024 })}
                className="w-full h-9 px-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-800 [&>option]:text-gray-900 dark:[&>option]:text-white"
              >
                <option value={32}>32 (ultra low)</option>
                <option value={64}>64 (very low)</option>
                <option value={128}>128 (low latency)</option>
                <option value={256}>256</option>
                <option value={512}>512</option>
                <option value={1024}>1024 (most stable)</option>
              </select>
            </div>
          </div>

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
