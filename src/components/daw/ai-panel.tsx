'use client';

import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room-store';
import { Progress } from '../ui/progress';
import {
  Sparkles,
  Wand2,
  Music,
  Loader2,
  ExternalLink,
  Mic,
  Guitar,
  Zap,
  Layers,
} from 'lucide-react';

export type AIGeneratorType = 'suno' | 'mureka';

interface AIPanelProps {
  onOpenGenerator: (type?: AIGeneratorType) => void;
  onSeparateTrack: () => void;
  isSeparating: boolean;
  separationProgress: number;
}

export function AIPanel({
  onOpenGenerator,
  onSeparateTrack,
  isSeparating,
  separationProgress,
}: AIPanelProps) {
  const { currentTrack, stemsAvailable } = useRoomStore();

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">AI Studio</span>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Mureka - Full Song Generation */}
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Mureka AI</h4>
              <p className="text-xs text-purple-500 dark:text-purple-400">Full songs with vocals</p>
            </div>
            <div className="ml-auto">
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-medium rounded-full">NEW</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mb-3">
            Create complete songs with AI-generated music and vocals. Perfect for songwriting and creative inspiration.
          </p>
          <button
            onClick={() => onOpenGenerator('mureka')}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/25"
          >
            <Sparkles className="w-4 h-4" />
            Create Song
          </button>
        </div>

        {/* Suno - Instrumental Backing Tracks */}
        <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center">
              <Guitar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Suno AI</h4>
              <p className="text-xs text-gray-500 dark:text-zinc-500">Instrumental backing tracks</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mb-3">
            Generate instrumental backing tracks for practice and jamming. Describe the style, mood, and tempo.
          </p>
          <button
            onClick={() => onOpenGenerator('suno')}
            className="w-full bg-indigo-500/20 hover:bg-indigo-500/30 py-2.5 rounded-xl text-indigo-600 dark:text-indigo-400 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Generate Track
          </button>
        </div>

        {/* Stem Separation */}
        <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Stem Separation</h4>
              <p className="text-xs text-gray-500 dark:text-zinc-500">Powered by Meta SAM</p>
            </div>
          </div>

          {!currentTrack ? (
            <p className="text-xs text-gray-500 dark:text-zinc-500 text-center py-4">
              Load a track to separate stems
            </p>
          ) : isSeparating ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 animate-spin" />
                <span className="text-sm text-gray-900 dark:text-white">Separating...</span>
              </div>
              <Progress value={separationProgress} showLabel />
            </div>
          ) : stemsAvailable ? (
            <div className="text-center py-2">
              <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Stems Ready</p>
              <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">Use the Mixer panel to adjust levels</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mb-3">
                Extract vocals, drums, bass, and other instruments from "{currentTrack.name}".
              </p>
              <button
                onClick={onSeparateTrack}
                className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 py-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Wand2 className="w-4 h-4" />
                Separate Stems
              </button>
            </>
          )}
        </div>

        {/* Feature Cards */}
        <div className="space-y-3">
          <h5 className="text-xs text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Coming Soon</h5>

          <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-3 opacity-60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-white/5 flex items-center justify-center">
                <Music className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-500 dark:text-zinc-400">AudioDec Integration</h4>
                <p className="text-[10px] text-gray-400 dark:text-zinc-600">Facebook SAM for advanced separation</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-3 opacity-60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-white/5 flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-500 dark:text-zinc-400">Voice Enhancement</h4>
                <p className="text-[10px] text-gray-400 dark:text-zinc-600">AI-powered vocal processing</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-3 opacity-60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-white/5 flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-500 dark:text-zinc-400">Text-to-Remix</h4>
                <p className="text-[10px] text-gray-400 dark:text-zinc-600">Describe modifications to apply</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-white/5 space-y-2">
        <div className="flex gap-2">
          <a
            href="https://mureka.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1 text-xs text-purple-500 dark:text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 transition-colors"
          >
            Mureka
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <a
            href="https://suno.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
          >
            Suno
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
