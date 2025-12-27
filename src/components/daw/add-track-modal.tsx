'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { DEFAULT_EFFECTS_CHAIN } from '@/lib/audio/effects/presets';
import type { TrackAudioSettings } from '@/types';
import {
  Mic,
  Monitor,
  ChevronDown,
  AlertCircle,
  Volume2,
  Headphones,
} from 'lucide-react';

interface AddTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName?: string;
  roomId?: string;
}

const DEFAULT_SETTINGS: TrackAudioSettings = {
  inputMode: 'microphone',
  inputDeviceId: 'default',
  sampleRate: 48000,
  bufferSize: 256,
  noiseSuppression: false,
  echoCancellation: false,
  autoGainControl: false,
  channelConfig: {
    channelCount: 2,
    leftChannel: 0,
    rightChannel: 1,
  },
  inputGain: 0,
  effects: DEFAULT_EFFECTS_CHAIN,
  directMonitoring: true,
  monitoringVolume: 1,
};

export function AddTrackModal({ isOpen, onClose, userId, userName, roomId }: AddTrackModalProps) {
  const { inputDevices, devicesLoaded, loadDevices, addTrack, getTracksByUser } = useUserTracksStore();

  const [trackName, setTrackName] = useState('');
  const [settings, setSettings] = useState<TrackAudioSettings>(DEFAULT_SETTINGS);
  const [testingInput, setTestingInput] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [appCaptureSupported, setAppCaptureSupported] = useState(false);

  const testStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setAppCaptureSupported('getDisplayMedia' in navigator.mediaDevices);
  }, []);

  useEffect(() => {
    if (isOpen && !devicesLoaded) {
      loadDevices();
    }
  }, [isOpen, devicesLoaded, loadDevices]);

  // Generate default track name
  useEffect(() => {
    if (isOpen && userId) {
      const existingTracks = getTracksByUser(userId);
      setTrackName(`Track ${existingTracks.length + 1}`);
    }
  }, [isOpen, userId, getTracksByUser]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      stopTesting();
      setSettings(DEFAULT_SETTINGS);
      setError(null);
    }
  }, [isOpen]);

  const stopTesting = useCallback(() => {
    testStreamRef.current?.getTracks().forEach((t) => t.stop());
    testStreamRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    setTestingInput(false);
    setInputLevel(0);
  }, []);

  const testInput = useCallback(async () => {
    setTestingInput(true);
    setError(null);

    try {
      let stream: MediaStream;

      if (settings.inputMode === 'application') {
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

        // Get application name from the track label
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          setSettings((prev) => ({
            ...prev,
            applicationName: audioTrack.label || 'Application Audio',
          }));
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: settings.inputDeviceId !== 'default'
              ? { exact: settings.inputDeviceId }
              : undefined,
            sampleRate: settings.sampleRate,
            echoCancellation: settings.echoCancellation,
            noiseSuppression: settings.noiseSuppression,
            autoGainControl: settings.autoGainControl,
          },
        });
      }

      testStreamRef.current = stream;
      const audioContext = new AudioContext({ sampleRate: settings.sampleRate });
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
    } catch {
      setError(
        settings.inputMode === 'application'
          ? 'Select a tab or window with audio playing'
          : 'Could not access microphone'
      );
      setTestingInput(false);
    }
  }, [settings]);

  const handleCreate = useCallback(async () => {
    if (!userId) return;

    stopTesting();
    const newTrack = addTrack(userId, trackName, settings, userName);

    // Persist the new track to the database
    if (roomId) {
      try {
        await fetch(`/api/rooms/${roomId}/user-tracks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTrack),
        });
      } catch (err) {
        console.error('Failed to persist track:', err);
      }
    }

    onClose();
  }, [userId, userName, roomId, trackName, settings, addTrack, onClose, stopTesting]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        stopTesting();
        onClose();
      }}
      title="Add New Track"
      description="Configure the audio source for your new track"
      className="max-w-md"
    >
      <div className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Track Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Track Name</label>
          <input
            type="text"
            value={trackName}
            onChange={(e) => setTrackName(e.target.value)}
            placeholder="e.g., Guitar, Vocals, Synth"
            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Input Mode Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-700">Audio Source</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSettings({ ...settings, inputMode: 'microphone' })}
              className={cn(
                'flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                settings.inputMode === 'microphone'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  settings.inputMode === 'microphone'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-100 text-slate-500'
                )}
              >
                <Mic className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="font-medium text-slate-900">Microphone</div>
                <div className="text-xs text-slate-500">Direct audio input</div>
              </div>
            </button>

            <button
              onClick={() =>
                appCaptureSupported && setSettings({ ...settings, inputMode: 'application' })
              }
              disabled={!appCaptureSupported}
              className={cn(
                'flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                settings.inputMode === 'application'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 hover:border-slate-300',
                !appCaptureSupported && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  settings.inputMode === 'application'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-100 text-slate-500'
                )}
              >
                <Monitor className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="font-medium text-slate-900">Application</div>
                <div className="text-xs text-slate-500">
                  {appCaptureSupported ? 'Capture app audio' : 'Not supported'}
                </div>
              </div>
            </button>
          </div>

          {settings.inputMode === 'application' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800">
                Click &quot;Test Input&quot; to select an application or browser tab with audio.
                Perfect for amp simulators, DAWs, or any other audio source.
              </p>
              {settings.applicationName && (
                <div className="mt-2 flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-medium text-amber-700">
                    {settings.applicationName}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Device (only for microphone mode) */}
        {settings.inputMode === 'microphone' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Input Device</label>
            <div className="relative">
              <select
                value={settings.inputDeviceId}
                onChange={(e) => setSettings({ ...settings, inputDeviceId: e.target.value })}
                className="w-full h-10 px-3 pr-10 bg-white border border-slate-200 rounded-xl text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="default">System Default</option>
                {inputDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Input Level Test */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Input Level</label>
            <Button
              variant="outline"
              size="sm"
              onClick={testingInput ? stopTesting : testInput}
              className="h-7"
            >
              {testingInput ? 'Stop' : settings.inputMode === 'application' ? 'Select App' : 'Test Input'}
            </Button>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-75',
                inputLevel > 0.8
                  ? 'bg-red-500'
                  : inputLevel > 0.5
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
              )}
              style={{ width: `${inputLevel * 100}%` }}
            />
          </div>
          {testingInput && (
            <p className="text-xs text-slate-500">
              {inputLevel > 0 ? 'Audio detected!' : 'Play or make sound to test...'}
            </p>
          )}
        </div>

        {/* Audio Processing (only for microphone) */}
        {settings.inputMode === 'microphone' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Audio Processing</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  setSettings({ ...settings, echoCancellation: !settings.echoCancellation })
                }
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  settings.echoCancellation
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                Echo Cancellation
              </button>
              <button
                onClick={() =>
                  setSettings({ ...settings, noiseSuppression: !settings.noiseSuppression })
                }
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  settings.noiseSuppression
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                Noise Suppression
              </button>
              <button
                onClick={() =>
                  setSettings({ ...settings, autoGainControl: !settings.autoGainControl })
                }
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  settings.autoGainControl
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                Auto Gain
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Disable all for best quality with a dedicated audio interface
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => {
              stopTesting();
              onClose();
            }}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} className="flex-1">
            Add Track
          </Button>
        </div>
      </div>
    </Modal>
  );
}
