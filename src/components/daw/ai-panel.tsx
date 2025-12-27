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
} from 'lucide-react';

interface AIPanelProps {
  onOpenGenerator: () => void;
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
          <span className="text-sm font-medium text-gray-900 dark:text-white">AI Assistant</span>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* AI Music Generation */}
        <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Generate Music</h4>
              <p className="text-xs text-gray-500 dark:text-zinc-500">Powered by Suno AI</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mb-3">
            Create custom backing tracks using AI. Describe the style, mood, and tempo you want.
          </p>
          <button
            onClick={onOpenGenerator}
            className="w-full neon-button py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Open Generator
          </button>
        </div>

        {/* Stem Separation */}
        <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-white" />
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
                <Loader2 className="w-4 h-4 text-indigo-500 dark:text-indigo-400 animate-spin" />
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
                className="w-full bg-indigo-500/20 hover:bg-indigo-500/30 py-2.5 rounded-xl text-indigo-600 dark:text-indigo-400 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
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
                <h4 className="text-sm font-medium text-gray-500 dark:text-zinc-400">Chord Detection</h4>
                <p className="text-[10px] text-gray-400 dark:text-zinc-600">Real-time chord recognition</p>
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
                <h4 className="text-sm font-medium text-gray-500 dark:text-zinc-400">Auto-Accompany</h4>
                <p className="text-[10px] text-gray-400 dark:text-zinc-600">AI backing band generation</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-white/5">
        <a
          href="https://suno.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors"
        >
          Learn more about Suno AI
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
