'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Modal } from '../ui/modal';
import { useAudioStore } from '@/stores/audio-store';
import {
  Speaker,
  Volume2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';

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
  const { outputDeviceId, setOutputDevice, masterVolume, setMasterVolume, backingTrackVolume, setBackingTrackVolume } = useAudioStore();

  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
  const [selectedOutput, setSelectedOutput] = useState(outputDeviceId || 'default');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load available devices
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

  const handleSave = useCallback(() => {
    setOutputDevice(selectedOutput);
    onClose();
  }, [selectedOutput, setOutputDevice, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Audio Output Settings"
      description="Configure your audio output and volume levels"
      className="max-w-md"
    >
      <div className="space-y-6">
        {error && (
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Output Device */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Speaker className="w-4 h-4 text-slate-500" />
              Output Device
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
              className="w-full h-10 px-3 pr-10 bg-white border border-slate-200 rounded-xl text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="default">System Default</option>
              {outputDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Master Volume */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-slate-500" />
              Master Volume
            </label>
            <span className="text-sm text-slate-500">{Math.round(masterVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Backing Track Volume */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Backing Track Volume</label>
            <span className="text-sm text-slate-500">{Math.round(backingTrackVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={backingTrackVolume}
            onChange={(e) => setBackingTrackVolume(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Info about per-track settings */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-xs text-slate-600">
            Audio input settings are now configured per-track. Click the settings icon on any track to adjust input device, sample rate, and processing options.
          </p>
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
