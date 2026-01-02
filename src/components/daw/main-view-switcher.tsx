'use client';

import { cn } from '@/lib/utils';
import { Layers, Sliders, Users2, PenTool, Music, ScrollText } from 'lucide-react';

export type MainViewType = 'timeline' | 'mixer' | 'avatar-world' | 'canvas' | 'notation' | 'teleprompter';

interface MainViewSwitcherProps {
  activeView: MainViewType;
  onViewChange: (view: MainViewType) => void;
  isMaster: boolean;
}

const views: { id: MainViewType; icon: typeof Layers; label: string; description: string; shortcut: string }[] = [
  { id: 'timeline', icon: Layers, label: 'Timeline', description: 'Track lanes view', shortcut: '1' },
  { id: 'mixer', icon: Sliders, label: 'Mixer', description: 'Stem mixing console', shortcut: '2' },
  { id: 'avatar-world', icon: Users2, label: 'World', description: 'Live jam scene', shortcut: '3' },
  { id: 'canvas', icon: PenTool, label: 'Canvas', description: 'Shared whiteboard', shortcut: '4' },
  { id: 'notation', icon: Music, label: 'Notation', description: 'Chords & tabs', shortcut: '5' },
  { id: 'teleprompter', icon: ScrollText, label: 'Lyrics', description: 'Synced lyrics', shortcut: '6' },
];

export function MainViewSwitcher({
  activeView,
  onViewChange,
}: MainViewSwitcherProps) {
  return (
    <div className="flex items-center gap-0.5 px-0.5 py-0.5 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
      {views.map(({ id, icon: Icon, label, shortcut }) => (
        <button
          key={id}
          onClick={() => onViewChange(id)}
          className={cn(
            'p-1 rounded transition-all',
            activeView === id
              ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-white/50 dark:hover:bg-white/5'
          )}
          title={`${label} (${shortcut})`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}
