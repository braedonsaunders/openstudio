'use client';

import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Progress } from '../ui/progress';
import { Modal } from '../ui/modal';
import {
  Sparkles,
  Music,
  Mic,
  MicOff,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wand2,
  RefreshCw,
  X,
  FileText,
  Zap,
  Timer,
  Music2,
} from 'lucide-react';
import type {
  MurekaGenerationConfig,
  MurekaGenerationProgress,
  MurekaStyle,
  MurekaMood,
} from '@/lib/ai/mureka';
import { MurekaGenerator } from '@/lib/ai/mureka';

interface MurekaGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: MurekaGenerationConfig) => Promise<void>;
  isGenerating: boolean;
  progress: MurekaGenerationProgress | null;
  onCancel?: () => void;
  className?: string;
}

const styles = MurekaGenerator.getStyles();
const moods = MurekaGenerator.getMoods();

const tempoOptions = [
  { id: 'slow', label: 'Slow', bpm: '60-80 BPM', icon: '🐢' },
  { id: 'medium', label: 'Medium', bpm: '90-120 BPM', icon: '🚶' },
  { id: 'fast', label: 'Fast', bpm: '130-150 BPM', icon: '🏃' },
  { id: 'very_fast', label: 'Very Fast', bpm: '160+ BPM', icon: '🚀' },
] as const;

const durationPresets = [
  { value: 30, label: '30s' },
  { value: 60, label: '1 min' },
  { value: 90, label: '1.5 min' },
  { value: 120, label: '2 min' },
  { value: 180, label: '3 min' },
];

const modelOptions = [
  { id: 'standard', label: 'Standard', description: 'Fast generation, good quality', icon: Zap },
  { id: 'pro', label: 'Pro', description: 'Better quality, more detail', icon: Music2 },
  { id: 'ultra', label: 'Ultra', description: 'Best quality, longer wait', icon: Sparkles },
] as const;

export function MurekaGeneratorModal({
  isOpen,
  onClose,
  onGenerate,
  isGenerating,
  progress,
  onCancel,
  className,
}: MurekaGeneratorModalProps) {
  const [prompt, setPrompt] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<MurekaStyle>('pop');
  const [selectedMood, setSelectedMood] = useState<MurekaMood>('energetic');
  const [tempo, setTempo] = useState<'slow' | 'medium' | 'fast' | 'very_fast'>('medium');
  const [duration, setDuration] = useState(60);
  const [instrumental, setInstrumental] = useState(false);
  const [model, setModel] = useState<'standard' | 'pro' | 'ultra'>('standard');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    await onGenerate({
      prompt: prompt.trim(),
      lyrics: !instrumental && lyrics.trim() ? lyrics.trim() : undefined,
      style: selectedStyle,
      mood: selectedMood,
      tempo,
      duration,
      instrumental,
      model,
    });
  }, [prompt, lyrics, selectedStyle, selectedMood, tempo, duration, instrumental, model, onGenerate]);

  const handleGenerateLyrics = useCallback(async () => {
    setIsGeneratingLyrics(true);
    try {
      const response = await fetch('/api/mureka/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: prompt || 'love and life',
          style: 'verse-chorus',
          mood: selectedMood,
        }),
      });

      if (response.ok) {
        const { lyrics: generatedLyrics } = await response.json();
        setLyrics(generatedLyrics);
        setShowLyrics(true);
      }
    } catch (error) {
      console.error('Failed to generate lyrics:', error);
    } finally {
      setIsGeneratingLyrics(false);
    }
  }, [prompt, selectedMood]);

  const progressColor = useMemo(() => {
    if (!progress) return 'bg-purple-500';
    switch (progress.stage) {
      case 'composing':
        return 'bg-purple-500';
      case 'arranging':
        return 'bg-blue-500';
      case 'vocals':
        return 'bg-pink-500';
      case 'mixing':
        return 'bg-indigo-500';
      case 'mastering':
        return 'bg-green-500';
      case 'complete':
        return 'bg-emerald-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-purple-500';
    }
  }, [progress?.stage]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mureka AI Music Generator"
      description="Create full songs with AI-generated music and vocals"
      className="max-w-2xl"
    >
      <div className={cn('space-y-5', className)}>
        {/* Generation in progress */}
        {isGenerating && progress ? (
          <div className="space-y-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center',
                  progress.stage === 'complete' ? 'bg-emerald-500/20' : 'bg-purple-500/20'
                )}>
                  {progress.stage === 'complete' ? (
                    <Music className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-white">
                    {progress.stage === 'complete' ? 'Your Song is Ready!' : 'Creating Your Song...'}
                  </h4>
                  <p className="text-sm text-gray-400">{progress.message}</p>
                  {progress.currentStep && (
                    <p className="text-xs text-gray-500 mt-0.5">{progress.currentStep}</p>
                  )}
                </div>
              </div>
              {progress.stage !== 'complete' && onCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Progress value={progress.progress} showLabel className={progressColor} />
              {progress.estimatedTimeRemaining !== undefined && progress.estimatedTimeRemaining > 0 && (
                <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500">
                  <Timer className="w-3.5 h-3.5" />
                  <span>~{progress.estimatedTimeRemaining}s remaining</span>
                </div>
              )}
            </div>

            {/* Stage indicators */}
            <div className="flex justify-between px-2 pt-2">
              {['composing', 'arranging', 'vocals', 'mixing', 'mastering'].map((stage, index) => {
                const stageIndex = ['composing', 'arranging', 'vocals', 'mixing', 'mastering'].indexOf(progress.stage);
                const isComplete = index < stageIndex || progress.stage === 'complete';
                const isCurrent = stage === progress.stage;

                return (
                  <div
                    key={stage}
                    className={cn(
                      'flex flex-col items-center gap-1',
                      isComplete ? 'text-emerald-400' : isCurrent ? 'text-purple-400' : 'text-gray-600'
                    )}
                  >
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        isComplete ? 'bg-emerald-400' : isCurrent ? 'bg-purple-400 animate-pulse' : 'bg-gray-600'
                      )}
                    />
                    <span className="text-[10px] capitalize">{stage}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {/* Prompt input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Describe your song
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., An upbeat summer pop song about chasing dreams, with catchy hooks and a memorable chorus..."
                className="w-full h-24 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Vocal toggle */}
            <div
              className={cn(
                'flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all',
                instrumental
                  ? 'bg-gray-800/50 border border-gray-700'
                  : 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30'
              )}
              onClick={() => setInstrumental(!instrumental)}
            >
              <div className="flex items-center gap-3">
                {instrumental ? (
                  <MicOff className="w-5 h-5 text-gray-400" />
                ) : (
                  <Mic className="w-5 h-5 text-pink-400" />
                )}
                <div>
                  <h5 className="font-medium text-white">
                    {instrumental ? 'Instrumental Only' : 'With Vocals'}
                  </h5>
                  <p className="text-xs text-gray-400">
                    {instrumental
                      ? 'Perfect for jamming and practice'
                      : 'AI-generated vocals included'}
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  'w-12 h-7 rounded-full transition-colors relative',
                  instrumental ? 'bg-gray-600' : 'bg-pink-500'
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md',
                    instrumental ? 'left-1' : 'left-6'
                  )}
                />
              </div>
            </div>

            {/* Lyrics section (if vocals enabled) */}
            {!instrumental && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowLyrics(!showLyrics)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Custom Lyrics
                    {showLyrics ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={handleGenerateLyrics}
                    disabled={isGeneratingLyrics}
                    className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                  >
                    {isGeneratingLyrics ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    Generate Lyrics
                  </button>
                </div>
                {showLyrics && (
                  <textarea
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    placeholder="[Verse 1]
Write your lyrics here...

[Chorus]
Your chorus lyrics..."
                    className="w-full h-40 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none font-mono text-sm"
                  />
                )}
              </div>
            )}

            {/* Style selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Style</label>
              <div className="grid grid-cols-6 gap-2 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                {styles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2.5 rounded-lg transition-all',
                      selectedStyle === style.id
                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                    )}
                  >
                    <span className="text-lg">{style.icon}</span>
                    <span className="text-[10px] font-medium">{style.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mood selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Mood</label>
              <div className="flex flex-wrap gap-2">
                {moods.slice(0, 8).map((mood) => (
                  <button
                    key={mood.id}
                    onClick={() => setSelectedMood(mood.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                      selectedMood === mood.id
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                    )}
                  >
                    <span>{mood.icon}</span>
                    <span>{mood.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tempo selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Tempo</label>
              <div className="grid grid-cols-4 gap-2">
                {tempoOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setTempo(option.id)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 p-3 rounded-lg transition-all',
                      tempo === option.id
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                    )}
                  >
                    <span className="text-lg">{option.icon}</span>
                    <span className="text-xs font-medium">{option.label}</span>
                    <span className="text-[10px] opacity-70">{option.bpm}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">Duration</label>
                <span className="text-sm text-purple-400 font-medium">
                  {duration >= 60 ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : `${duration}s`}
                </span>
              </div>
              <Slider
                min={30}
                max={180}
                step={15}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
              />
              <div className="flex justify-between">
                {durationPresets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setDuration(preset.value)}
                    className={cn(
                      'text-xs px-2 py-1 rounded transition-colors',
                      duration === preset.value
                        ? 'text-purple-400 bg-purple-500/10'
                        : 'text-gray-500 hover:text-gray-300'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced options */}
            <div className="space-y-3">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Advanced Options
              </button>

              {showAdvanced && (
                <div className="space-y-4 pt-2">
                  {/* Model selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Quality Model</label>
                    <div className="grid grid-cols-3 gap-2">
                      {modelOptions.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setModel(option.id)}
                          className={cn(
                            'flex flex-col items-center gap-1 p-3 rounded-lg transition-all',
                            model === option.id
                              ? 'bg-purple-500/20 border border-purple-500 text-white'
                              : 'bg-gray-800/50 border border-gray-700 text-gray-400 hover:border-gray-600'
                          )}
                        >
                          <option.icon className="w-5 h-5" />
                          <span className="text-xs font-medium">{option.label}</span>
                          <span className="text-[10px] opacity-70 text-center">{option.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              size="lg"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Generate Song
            </Button>

            <p className="text-xs text-gray-500 text-center">
              Powered by Mureka AI. Generation typically takes 1-3 minutes.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

// Quick Jam Track Generator Component
interface QuickJamGeneratorProps {
  onGenerate: (config: MurekaGenerationConfig) => Promise<void>;
  isGenerating: boolean;
}

export function QuickJamGenerator({ onGenerate, isGenerating }: QuickJamGeneratorProps) {
  const [selectedStyle, setSelectedStyle] = useState<MurekaStyle>('rock');
  const [selectedMood, setSelectedMood] = useState<MurekaMood>('energetic');

  const quickStyles = styles.slice(0, 8);
  const quickMoods = moods.slice(0, 6);

  const handleQuickGenerate = useCallback(async () => {
    await onGenerate({
      prompt: `Create a ${selectedMood} ${selectedStyle} jam track for musicians to practice and improvise over`,
      style: selectedStyle,
      mood: selectedMood,
      tempo: 'medium',
      duration: 60,
      instrumental: true,
      model: 'standard',
    });
  }, [selectedStyle, selectedMood, onGenerate]);

  return (
    <div className="space-y-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
      <div className="flex items-center gap-2">
        <Music className="w-5 h-5 text-purple-400" />
        <h4 className="font-medium text-white">Quick Jam Track</h4>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {quickStyles.map((style) => (
            <button
              key={style.id}
              onClick={() => setSelectedStyle(style.id)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                selectedStyle === style.id
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              )}
            >
              {style.icon} {style.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {quickMoods.map((mood) => (
            <button
              key={mood.id}
              onClick={() => setSelectedMood(mood.id)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                selectedMood === mood.id
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              )}
            >
              {mood.icon} {mood.label}
            </button>
          ))}
        </div>
      </div>

      <Button
        onClick={handleQuickGenerate}
        disabled={isGenerating}
        className="w-full"
        size="sm"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4 mr-2" />
            Generate Jam Track
          </>
        )}
      </Button>
    </div>
  );
}
