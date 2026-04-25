'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { getMidiManager, MidiInputManager, MidiMessage } from '@/lib/midi/midi-input';
import type { MidiDeviceInfo, MidiChannel, MidiInputSettings } from '@/types/loops';
import { AVAILABLE_SOUND_PRESETS } from '@/lib/audio/sound-engine';
import {
  Piano,
  Plug,
  PlugZap,
  ChevronDown,
  Activity,
  AlertCircle,
  Volume2,
  Settings,
} from 'lucide-react';

interface MidiDeviceSelectorProps {
  settings: MidiInputSettings;
  onSettingsChange: (settings: Partial<MidiInputSettings>) => void;
  onMidiMessage?: (message: MidiMessage) => void;
}

export function MidiDeviceSelector({
  settings,
  onSettingsChange,
  onMidiMessage,
}: MidiDeviceSelectorProps) {
  const [midiSupported, setMidiSupported] = useState(true);
  const [midiInitialized, setMidiInitialized] = useState(false);
  const [devices, setDevices] = useState<MidiDeviceInfo[]>([]);
  const [lastNote, setLastNote] = useState<number | null>(null);
  const [midiActivity, setMidiActivity] = useState(false);

  const midiManagerRef = useRef<MidiInputManager | null>(null);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize MIDI
  useEffect(() => {
    const initMidi = async () => {
      const manager = getMidiManager();
      midiManagerRef.current = manager;

      const supported = manager.isSupported();
      setMidiSupported(supported);

      if (supported) {
        const initialized = await manager.initialize();
        setMidiInitialized(initialized);

        if (initialized) {
          setDevices(manager.getDevices());

          // Listen for device changes
          manager.onDeviceChange((newDevices) => {
            setDevices(newDevices);
          });
        }
      }
    };

    initMidi();

    return () => {
      midiManagerRef.current?.disconnectAll();
    };
  }, []);

  // Handle device connection
  useEffect(() => {
    const manager = midiManagerRef.current;
    if (!manager || !settings.deviceId) return;

    manager.connect(settings.deviceId);
    manager.setChannelFilter(settings.channel);
    manager.setVelocityCurve(settings.velocityCurve);

    const unsubscribe = manager.onMessage((message) => {
      // Show activity indicator
      setMidiActivity(true);
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      activityTimeoutRef.current = setTimeout(() => {
        setMidiActivity(false);
      }, 100);

      // Track last note for display
      if (message.type === 'noteon') {
        setLastNote(message.note);
      }

      // Forward to callback
      onMidiMessage?.(message);
    });

    return () => {
      unsubscribe();
    };
  }, [settings.deviceId, settings.channel, settings.velocityCurve, onMidiMessage]);

  // Get note name from MIDI number
  const getNoteName = (noteNumber: number): string => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(noteNumber / 12) - 1;
    const note = notes[noteNumber % 12];
    return `${note}${octave}`;
  };

  if (!midiSupported) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-center gap-2 text-amber-800">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Web MIDI not supported</span>
        </div>
        <p className="text-sm text-amber-700 mt-1">
          Your browser doesn&apos;t support MIDI input. Try Chrome or Edge.
        </p>
      </div>
    );
  }

  if (!midiInitialized) {
    return (
      <div className="p-4 bg-slate-100 rounded-xl">
        <div className="flex items-center gap-2 text-slate-600">
          <Plug className="w-5 h-5 animate-pulse" />
          <span>Initializing MIDI...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Device Selection */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          MIDI Device
        </label>
        <div className="relative">
          <select
            value={settings.deviceId || ''}
            onChange={(e) => onSettingsChange({ deviceId: e.target.value || null })}
            className="w-full h-10 pl-10 pr-10 bg-white border border-slate-200 rounded-xl text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="">Select a MIDI device...</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name} ({device.manufacturer})
              </option>
            ))}
          </select>
          <Piano className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        {devices.length === 0 && (
          <p className="text-xs text-slate-500 mt-1">
            No MIDI devices found. Connect a MIDI controller and refresh.
          </p>
        )}
      </div>

      {/* Connection Status */}
      {settings.deviceId && (
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
          <div
            className={cn(
              'w-3 h-3 rounded-full',
              midiActivity ? 'bg-green-500' : 'bg-slate-300'
            )}
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-700">
              {devices.find((d) => d.id === settings.deviceId)?.name || 'Connected'}
            </div>
            <div className="text-xs text-slate-500">
              {lastNote !== null ? (
                <>
                  Last note: <span className="font-mono">{getNoteName(lastNote)}</span> ({lastNote})
                </>
              ) : (
                'Press a key to test'
              )}
            </div>
          </div>
          <Activity
            className={cn(
              'w-5 h-5 transition-colors',
              midiActivity ? 'text-green-500' : 'text-slate-300'
            )}
          />
        </div>
      )}

      {/* Channel Selection */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          MIDI Channel
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onSettingsChange({ channel: 'all' })}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              settings.channel === 'all'
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            All
          </button>
          {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as MidiChannel[]).map(
            (ch) => (
              <button
                key={ch}
                onClick={() => onSettingsChange({ channel: ch })}
                className={cn(
                  'w-8 h-8 rounded-lg text-xs font-medium transition-colors',
                  settings.channel === ch
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {ch}
              </button>
            )
          )}
        </div>
      </div>

      {/* Sound Selection */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          Sound
        </label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(AVAILABLE_SOUND_PRESETS).map(([category, presets]) => (
            <div key={category} className="space-y-1">
              <div className="text-xs text-slate-500 uppercase font-medium">
                {category}
              </div>
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => onSettingsChange({ soundPreset: preset.id })}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm text-left transition-colors',
                    settings.soundPreset === preset.id
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  )}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Velocity Curve */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          Velocity Curve
        </label>
        <div className="flex gap-2">
          {(['linear', 'soft', 'hard'] as const).map((curve) => (
            <button
              key={curve}
              onClick={() => onSettingsChange({ velocityCurve: curve })}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-colors',
                settings.velocityCurve === curve
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {curve}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {settings.velocityCurve === 'soft'
            ? 'More sensitive at low velocities'
            : settings.velocityCurve === 'hard'
              ? 'Less sensitive at low velocities'
              : 'Velocity is unchanged'}
        </p>
      </div>
    </div>
  );
}
