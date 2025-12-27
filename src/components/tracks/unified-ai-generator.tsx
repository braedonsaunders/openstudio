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
  X,
  FileText,
  Zap,
  Timer,
  Music2,
  Infinity,
  Guitar,
} from 'lucide-react';
import type { SunoGenerationConfig, SunoGenerationProgress } from '@/lib/ai/suno';
import type {
  MurekaGenerationConfig,
  MurekaGenerationProgress,
  MurekaStyle,
  MurekaMood,
} from '@/lib/ai/mureka';
import { MurekaGenerator } from '@/lib/ai/mureka';

type AIProvider = 'suno' | 'mureka';

interface UnifiedAIGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateSuno: (config: SunoGenerationConfig) => Promise<void>;
  onGenerateMureka: (config: MurekaGenerationConfig) => Promise<void>;
  isGenerating: boolean;
  sunoProgress: SunoGenerationProgress | null;
  murekaProgress: MurekaGenerationProgress | null;
  onCancel?: () => void;
  className?: string;
  defaultProvider?: AIProvider;
}

// Suno style presets (existing)
const sunoStylePresets = [
  { id: 'rock', label: 'Rock', icon: '🎸' },
  { id: 'jazz', label: 'Jazz', icon: '🎷' },
  { id: 'electronic', label: 'Electronic', icon: '🎹' },
  { id: 'funk', label: 'Funk', icon: '🕺' },
  { id: 'blues', label: 'Blues', icon: '🎺' },
  { id: 'ambient', label: 'Ambient', icon: '🌙' },
  { id: 'classical', label: 'Classical', icon: '🎻' },
  { id: 'hiphop', label: 'Hip Hop', icon: '🎤' },
];

const murekaStyles = MurekaGenerator.getStyles();
const murekaMoods = MurekaGenerator.getMoods();

const tempoPresets = [
  { value: 70, label: 'Slow' },
  { value: 100, label: 'Medium' },
  { value: 130, label: 'Fast' },
  { value: 160, label: 'Very Fast' },
];

export function UnifiedAIGenerator({
  isOpen,
  onClose,
  onGenerateSuno,
  onGenerateMureka,
  isGenerating,
  sunoProgress,
  murekaProgress,
  onCancel,
  className,
  defaultProvider = 'mureka',
}: UnifiedAIGeneratorProps) {
  const [provider, setProvider] = useState<AIProvider>(defaultProvider);
  const [prompt, setPrompt] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [showLyrics, setShowLyrics] = useState(false);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);

  // Suno-specific state
  const [sunoStyle, setSunoStyle] = useState('rock');
  const [sunoTempo, setSunoTempo] = useState(120);
  const [sunoDuration, setSunoDuration] = useState(30);
  const [endlessMode, setEndlessMode] = useState(false);

  // Mureka-specific state
  const [murekaStyle, setMurekaStyle] = useState<MurekaStyle>('pop');
  const [murekaMood, setMurekaMood] = useState<MurekaMood>('energetic');
  const [murekaTempo, setMurekaTempo] = useState<'slow' | 'medium' | 'fast' | 'very_fast'>('medium');
  const [murekaDuration, setMurekaDuration] = useState(60);
  const [instrumental, setInstrumental] = useState(false);
  const [model, setModel] = useState<'standard' | 'pro' | 'ultra'>('standard');

  const currentProgress = provider === 'suno' ? sunoProgress : murekaProgress;

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    if (provider === 'suno') {
      await onGenerateSuno({
        prompt: prompt.trim(),
        style: sunoStyle,
        tempo: sunoTempo,
        duration: sunoDuration,
        instrumental: true,
      });
    } else {
      await onGenerateMureka({
        prompt: prompt.trim(),
        lyrics: !instrumental && lyrics.trim() ? lyrics.trim() : undefined,
        style: murekaStyle,
        mood: murekaMood,
        tempo: murekaTempo,
        duration: murekaDuration,
        instrumental,
        model,
      });
    }
  }, [
    prompt, provider, lyrics, instrumental,
    sunoStyle, sunoTempo, sunoDuration,
    murekaStyle, murekaMood, murekaTempo, murekaDuration, model,
    onGenerateSuno, onGenerateMureka,
  ]);

  const handleGenerateLyrics = useCallback(async () => {
    setIsGeneratingLyrics(true);
    try {
      const response = await fetch('/api/mureka/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: prompt || 'love and life',
          style: 'verse-chorus',
          mood: murekaMood,
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
  }, [prompt, murekaMood]);

  const progressPercentage = currentProgress?.progress || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Music Generator"
      description="Create custom backing tracks and full songs with AI"
      className="max-w-2xl"
    >
      <div className={cn('space-y-5', className)}>
        {/* Generation in progress */}
        {isGenerating && currentProgress ? (
          <div className="space-y-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center',
                  currentProgress.stage === 'complete' ? 'bg-emerald-500/20' : 'bg-purple-500/20'
                )}>
                  {currentProgress.stage === 'complete' ? (
                    <Music className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-white">
                    {currentProgress.stage === 'complete' ? 'Your Track is Ready!' : 'Creating Your Track...'}
                  </h4>
                  <p className="text-sm text-gray-400">{currentProgress.message}</p>
                </div>
              </div>
              {currentProgress.stage !== 'complete' && onCancel && (
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

            <Progress value={progressPercentage} showLabel />
            {currentProgress.estimatedTimeRemaining !== undefined && currentProgress.estimatedTimeRemaining > 0 && (
              <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500">
                <Timer className="w-3.5 h-3.5" />
                <span>~{currentProgress.estimatedTimeRemaining}s remaining</span>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Provider Tabs */}
            <div className="flex gap-2 p-1 bg-gray-800/50 rounded-xl">
              <button
                onClick={() => setProvider('mureka')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all',
                  provider === 'mureka'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                )}
              >
                <Mic className="w-4 h-4" />
                <div className="text-left">
                  <div className="text-sm">Mureka</div>
                  <div className="text-[10px] opacity-70">Full songs with vocals</div>
                </div>
              </button>
              <button
                onClick={() => setProvider('suno')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all',
                  provider === 'suno'
                    ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                )}
              >
                <Guitar className="w-4 h-4" />
                <div className="text-left">
                  <div className="text-sm">Suno</div>
                  <div className="text-[10px] opacity-70">Instrumental backing tracks</div>
                </div>
              </button>
            </div>

            {/* Prompt input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                {provider === 'mureka' ? 'Describe your song' : 'Describe your backing track'}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  provider === 'mureka'
                    ? 'e.g., An upbeat summer pop song about chasing dreams, with catchy hooks...'
                    : 'e.g., A groovy funk backing track with slap bass and wah guitar, in A minor...'
                }
                className="w-full h-24 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Mureka-specific options */}
            {provider === 'mureka' && (
              <>
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

                {/* Lyrics section */}
                {!instrumental && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setShowLyrics(!showLyrics)}
                        className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        Custom Lyrics
                        {showLyrics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
                        className="w-full h-32 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none font-mono text-sm"
                      />
                    )}
                  </div>
                )}

                {/* Mureka Style */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Style</label>
                  <div className="grid grid-cols-6 gap-2 max-h-[100px] overflow-y-auto pr-1">
                    {murekaStyles.slice(0, 12).map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setMurekaStyle(style.id)}
                        className={cn(
                          'flex flex-col items-center gap-0.5 p-2 rounded-lg transition-all',
                          murekaStyle === style.id
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                        )}
                      >
                        <span className="text-base">{style.icon}</span>
                        <span className="text-[9px] font-medium">{style.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mureka Mood */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Mood</label>
                  <div className="flex flex-wrap gap-1.5">
                    {murekaMoods.slice(0, 8).map((mood) => (
                      <button
                        key={mood.id}
                        onClick={() => setMurekaMood(mood.id)}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                          murekaMood === mood.id
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

                {/* Mureka Duration */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-300">Duration</label>
                    <span className="text-sm text-purple-400">
                      {murekaDuration >= 60
                        ? `${Math.floor(murekaDuration / 60)}:${String(murekaDuration % 60).padStart(2, '0')}`
                        : `${murekaDuration}s`}
                    </span>
                  </div>
                  <Slider
                    min={30}
                    max={180}
                    step={15}
                    value={murekaDuration}
                    onChange={(e) => setMurekaDuration(parseInt(e.target.value))}
                  />
                </div>
              </>
            )}

            {/* Suno-specific options */}
            {provider === 'suno' && (
              <>
                {/* Style presets */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Style</label>
                  <div className="grid grid-cols-4 gap-2">
                    {sunoStylePresets.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => setSunoStyle(preset.id)}
                        className={cn(
                          'flex flex-col items-center gap-1 p-3 rounded-lg transition-all',
                          sunoStyle === preset.id
                            ? 'bg-indigo-500 text-white'
                            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
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
                    <label className="text-sm font-medium text-gray-300">Tempo</label>
                    <span className="text-sm text-indigo-400">{sunoTempo} BPM</span>
                  </div>
                  <Slider
                    min={60}
                    max={200}
                    step={1}
                    value={sunoTempo}
                    onChange={(e) => setSunoTempo(parseInt(e.target.value))}
                  />
                  <div className="flex justify-between">
                    {tempoPresets.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setSunoTempo(preset.value)}
                        className={cn(
                          'text-xs px-2 py-1 rounded transition-colors',
                          sunoTempo === preset.value
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
                    <label className="text-sm font-medium text-gray-300">Duration</label>
                    <span className="text-sm text-indigo-400">{sunoDuration}s</span>
                  </div>
                  <Slider
                    min={15}
                    max={120}
                    step={15}
                    value={sunoDuration}
                    onChange={(e) => setSunoDuration(parseInt(e.target.value))}
                  />
                </div>

                {/* Endless mode */}
                <div
                  className={cn(
                    'flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors',
                    endlessMode ? 'bg-indigo-500/20 border border-indigo-500' : 'bg-gray-800/50 border border-gray-700'
                  )}
                  onClick={() => setEndlessMode(!endlessMode)}
                >
                  <div className="flex items-center gap-3">
                    <Infinity className={cn('w-5 h-5', endlessMode ? 'text-indigo-400' : 'text-gray-400')} />
                    <div>
                      <h5 className="font-medium text-white">Endless Mode</h5>
                      <p className="text-xs text-gray-400">
                        AI will continuously extend the track
                      </p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'w-12 h-7 rounded-full transition-colors relative',
                      endlessMode ? 'bg-indigo-500' : 'bg-gray-600'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-1 w-5 h-5 bg-white rounded-full transition-all',
                        endlessMode ? 'left-6' : 'left-1'
                      )}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className={cn(
                'w-full',
                provider === 'mureka'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                  : 'bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600'
              )}
              size="lg"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {provider === 'mureka' ? 'Generate Song' : 'Generate Track'}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              Powered by {provider === 'mureka' ? 'Mureka AI' : 'Suno AI'}.
              {provider === 'mureka' ? ' Generation takes 1-3 minutes.' : ' Generation takes 30-60 seconds.'}
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
