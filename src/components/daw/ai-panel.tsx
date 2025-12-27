'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room-store';
import { Progress } from '../ui/progress';
import { Slider } from '../ui/slider';
import {
  Sparkles,
  Wand2,
  Music,
  Loader2,
  ExternalLink,
  Mic,
  MicOff,
  Layers,
  ChevronDown,
  ChevronUp,
  FileText,
  Timer,
  X,
} from 'lucide-react';
import type { BackingTrack } from '@/types';
import {
  MurekaGenerator,
  type MurekaGenerationConfig,
  type MurekaGenerationProgress,
  type MurekaStyle,
  type MurekaMood,
} from '@/lib/ai/mureka';

interface AIPanelProps {
  onSeparateTrack: () => void;
  isSeparating: boolean;
  separationProgress: number;
  onTrackGenerated?: (track: BackingTrack) => void;
  roomId?: string;
}

const styles = MurekaGenerator.getStyles();
const moods = MurekaGenerator.getMoods();

export function AIPanel({
  onSeparateTrack,
  isSeparating,
  separationProgress,
  onTrackGenerated,
  roomId,
}: AIPanelProps) {
  const { currentTrack, stemsAvailable, addToQueue } = useRoomStore();

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<MurekaGenerationProgress | null>(null);
  const [generatorInstance, setGeneratorInstance] = useState<MurekaGenerator | null>(null);

  // Form state
  const [prompt, setPrompt] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [showLyrics, setShowLyrics] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<MurekaStyle>('pop');
  const [selectedMood, setSelectedMood] = useState<MurekaMood>('energetic');
  const [tempo, setTempo] = useState<'slow' | 'medium' | 'fast' | 'very_fast'>('medium');
  const [duration, setDuration] = useState(60);
  const [instrumental, setInstrumental] = useState(true); // Default to instrumental for jamming
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setProgress({ stage: 'queued', progress: 0, message: 'Preparing your music request...' });

    const generator = new MurekaGenerator();
    setGeneratorInstance(generator);

    generator.setOnProgress((p) => {
      setProgress(p);
    });

    try {
      const config: MurekaGenerationConfig = {
        prompt: prompt.trim(),
        lyrics: !instrumental && lyrics.trim() ? lyrics.trim() : undefined,
        style: selectedStyle,
        mood: selectedMood,
        tempo,
        duration,
        instrumental,
        model: 'standard',
      };

      const track = await generator.generateTrack(config);

      // Create BackingTrack and add to queue
      const backingTrack: BackingTrack = {
        id: track.id,
        name: track.title,
        duration: track.duration,
        url: track.audioUrl,
        uploadedBy: 'mureka-ai',
        uploadedAt: new Date().toISOString(),
        aiGenerated: true,
      };

      if (onTrackGenerated) {
        onTrackGenerated(backingTrack);
      } else {
        addToQueue(backingTrack);
      }

      // Reset form after successful generation
      setPrompt('');
      setLyrics('');
      setProgress(null);
    } catch (error) {
      setProgress({
        stage: 'error',
        progress: 0,
        message: (error as Error).message || 'Generation failed',
      });
    } finally {
      setIsGenerating(false);
      setGeneratorInstance(null);
    }
  }, [prompt, lyrics, selectedStyle, selectedMood, tempo, duration, instrumental, isGenerating, onTrackGenerated, addToQueue]);

  const handleCancel = useCallback(() => {
    if (generatorInstance) {
      generatorInstance.cancel();
    }
    setIsGenerating(false);
    setProgress(null);
    setGeneratorInstance(null);
  }, [generatorInstance]);

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

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">AI Music Generator</span>
          <span className="ml-auto px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-medium rounded-full">
            Mureka
          </span>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Generation in progress */}
        {isGenerating && progress ? (
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  progress.stage === 'complete' ? 'bg-emerald-500/20' : 'bg-purple-500/20'
                )}>
                  {progress.stage === 'complete' ? (
                    <Music className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                    {progress.stage === 'complete' ? 'Track Ready!' : 'Creating Your Track...'}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{progress.message}</p>
                </div>
              </div>
              {progress.stage !== 'complete' && progress.stage !== 'error' && (
                <button
                  onClick={handleCancel}
                  className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <Progress value={progress.progress} showLabel />

            {progress.estimatedTimeRemaining !== undefined && progress.estimatedTimeRemaining > 0 && (
              <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-gray-500 dark:text-zinc-500">
                <Timer className="w-3 h-3" />
                <span>~{progress.estimatedTimeRemaining}s remaining</span>
              </div>
            )}

            {progress.stage === 'error' && (
              <button
                onClick={() => setProgress(null)}
                className="mt-3 w-full py-2 rounded-lg bg-gray-800 text-white text-sm hover:bg-gray-700 transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Prompt input */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                Describe your track
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., A groovy funk jam track with slap bass and wah guitar for practicing improvisation..."
                className="w-full h-20 px-3 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Vocal toggle */}
            <div
              className={cn(
                'flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all',
                instrumental
                  ? 'bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10'
                  : 'bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20'
              )}
              onClick={() => setInstrumental(!instrumental)}
            >
              <div className="flex items-center gap-2.5">
                {instrumental ? (
                  <MicOff className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
                ) : (
                  <Mic className="w-4 h-4 text-pink-400" />
                )}
                <div>
                  <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                    {instrumental ? 'Instrumental' : 'With Vocals'}
                  </h5>
                  <p className="text-[10px] text-gray-500 dark:text-zinc-500">
                    {instrumental ? 'Perfect for jamming' : 'AI vocals included'}
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  'w-10 h-6 rounded-full transition-colors relative',
                  instrumental ? 'bg-gray-300 dark:bg-zinc-700' : 'bg-pink-500'
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow',
                    instrumental ? 'left-1' : 'left-5'
                  )}
                />
              </div>
            </div>

            {/* Lyrics (if vocals enabled) */}
            {!instrumental && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowLyrics(!showLyrics)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Custom Lyrics
                    {showLyrics ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={handleGenerateLyrics}
                    disabled={isGeneratingLyrics}
                    className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 disabled:opacity-50"
                  >
                    {isGeneratingLyrics ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Wand2 className="w-3 h-3" />
                    )}
                    Generate
                  </button>
                </div>
                {showLyrics && (
                  <textarea
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    placeholder="[Verse 1]&#10;Your lyrics here..."
                    className="w-full h-24 px-3 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono resize-none"
                  />
                )}
              </div>
            )}

            {/* Style */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Style</label>
              <div className="grid grid-cols-5 gap-1.5 max-h-[80px] overflow-y-auto pr-1">
                {styles.slice(0, 10).map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all text-center',
                      selectedStyle === style.id
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/10'
                    )}
                  >
                    <span className="text-sm">{style.icon}</span>
                    <span className="text-[8px] font-medium leading-tight">{style.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Mood</label>
              <div className="flex flex-wrap gap-1">
                {moods.slice(0, 6).map((mood) => (
                  <button
                    key={mood.id}
                    onClick={() => setSelectedMood(mood.id)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-all',
                      selectedMood === mood.id
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/10'
                    )}
                  >
                    <span>{mood.icon}</span>
                    <span>{mood.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Duration</label>
                <span className="text-xs text-purple-400">
                  {duration >= 60
                    ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`
                    : `${duration}s`}
                </span>
              </div>
              <Slider
                min={30}
                max={180}
                step={15}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
              />
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/25"
            >
              <Sparkles className="w-4 h-4" />
              Generate Track
            </button>
          </>
        )}

        {/* Stem Separation */}
        <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">Stem Separation</h4>
              <p className="text-[10px] text-gray-500 dark:text-zinc-500">Extract instruments</p>
            </div>
          </div>

          {!currentTrack ? (
            <p className="text-xs text-gray-500 dark:text-zinc-500 text-center py-2">
              Load a track first
            </p>
          ) : isSeparating ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                <span className="text-xs text-gray-900 dark:text-white">Separating...</span>
              </div>
              <Progress value={separationProgress} showLabel />
            </div>
          ) : stemsAvailable ? (
            <div className="flex items-center gap-2 py-1">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-xs text-emerald-400">Stems ready - use Mixer panel</span>
            </div>
          ) : (
            <button
              onClick={onSeparateTrack}
              className="w-full py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Separate Stems
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-white/5">
        <a
          href="https://mureka.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-[10px] text-gray-400 dark:text-zinc-500 hover:text-purple-400 dark:hover:text-purple-400 transition-colors"
        >
          Powered by Mureka AI
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
}
