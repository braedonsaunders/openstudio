'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';
import { Progress } from '../ui/progress';
import { Modal } from '../ui/modal';
import {
  Sparkles,
  Music,
  Zap,
  Infinity,
  Play,
  Pause,
  Loader2,
} from 'lucide-react';
import type { SunoGenerationConfig, SunoGenerationProgress } from '@/lib/ai/suno';

interface AIGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: SunoGenerationConfig) => Promise<void>;
  isGenerating: boolean;
  progress: SunoGenerationProgress | null;
  className?: string;
}

const stylePresets = [
  { id: 'rock', label: 'Rock', icon: '🎸' },
  { id: 'jazz', label: 'Jazz', icon: '🎷' },
  { id: 'electronic', label: 'Electronic', icon: '🎹' },
  { id: 'funk', label: 'Funk', icon: '🕺' },
  { id: 'blues', label: 'Blues', icon: '🎺' },
  { id: 'ambient', label: 'Ambient', icon: '🌙' },
  { id: 'classical', label: 'Classical', icon: '🎻' },
  { id: 'hiphop', label: 'Hip Hop', icon: '🎤' },
];

const tempoPresets = [
  { value: 70, label: 'Slow' },
  { value: 100, label: 'Medium' },
  { value: 130, label: 'Fast' },
  { value: 160, label: 'Very Fast' },
];

export function AIGenerator({
  isOpen,
  onClose,
  onGenerate,
  isGenerating,
  progress,
  className,
}: AIGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('rock');
  const [tempo, setTempo] = useState(120);
  const [duration, setDuration] = useState(30);
  const [endlessMode, setEndlessMode] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    await onGenerate({
      prompt: prompt.trim(),
      style,
      tempo,
      duration,
      instrumental: true,
    });
  }, [prompt, style, tempo, duration, onGenerate]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Track Generator"
      description="Describe the backing track you want and let AI create it"
      className="max-w-xl"
    >
      <div className={cn('space-y-6', className)}>
        {/* Generation in progress */}
        {isGenerating && progress ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              </div>
              <div>
                <h4 className="font-medium text-white">
                  {progress.stage === 'complete' ? 'Generation Complete!' : 'Generating...'}
                </h4>
                <p className="text-sm text-gray-400">{progress.message}</p>
              </div>
            </div>
            <Progress value={progress.progress} showLabel />
            {progress.estimatedTimeRemaining && (
              <p className="text-sm text-gray-500 text-center">
                Estimated time remaining: {progress.estimatedTimeRemaining}s
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Prompt input */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">
                Describe your backing track
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., A groovy funk backing track with slap bass and wah guitar, in A minor..."
                className="w-full h-24 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Style presets */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Style</label>
              <div className="grid grid-cols-4 gap-2">
                {stylePresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setStyle(preset.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-3 rounded-lg transition-all',
                      style === preset.id
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    )}
                  >
                    <span className="text-xl">{preset.icon}</span>
                    <span className="text-xs">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tempo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-400">Tempo</label>
                <span className="text-sm text-white">{tempo} BPM</span>
              </div>
              <Slider
                min={60}
                max={200}
                step={1}
                value={tempo}
                onChange={(e) => setTempo(parseInt(e.target.value))}
              />
              <div className="flex justify-between">
                {tempoPresets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setTempo(preset.value)}
                    className={cn(
                      'text-xs px-2 py-1 rounded transition-colors',
                      tempo === preset.value
                        ? 'text-indigo-400'
                        : 'text-gray-500 hover:text-gray-300'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-400">Duration</label>
                <span className="text-sm text-white">{duration}s</span>
              </div>
              <Slider
                min={15}
                max={120}
                step={15}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
              />
            </div>

            {/* Endless mode */}
            <div
              className={cn(
                'flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors',
                endlessMode ? 'bg-indigo-500/20 border border-indigo-500' : 'bg-gray-800'
              )}
              onClick={() => setEndlessMode(!endlessMode)}
            >
              <div className="flex items-center gap-3">
                <Infinity className={cn('w-5 h-5', endlessMode ? 'text-indigo-400' : 'text-gray-400')} />
                <div>
                  <h5 className="font-medium text-white">Endless Mode</h5>
                  <p className="text-sm text-gray-400">
                    AI will continuously extend the track
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  'w-10 h-6 rounded-full transition-colors relative',
                  endlessMode ? 'bg-indigo-500' : 'bg-gray-600'
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-all',
                    endlessMode ? 'left-5' : 'left-1'
                  )}
                />
              </div>
            </div>

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className="w-full"
              size="lg"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Generate Track
            </Button>

            <p className="text-xs text-gray-500 text-center">
              Powered by Suno AI. Generation typically takes 30-60 seconds.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
