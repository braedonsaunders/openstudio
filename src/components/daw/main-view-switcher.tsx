'use client';

import { cn } from '@/lib/utils';
import { Layers, Sliders, Users2 } from 'lucide-react';

export type MainViewType = 'timeline' | 'mixer' | 'avatar-world';

interface MainViewSwitcherProps {
  activeView: MainViewType;
  onViewChange: (view: MainViewType) => void;
  isMaster: boolean;
}

const views: { id: MainViewType; icon: typeof Layers; label: string; description: string }[] = [
  { id: 'timeline', icon: Layers, label: 'Timeline', description: 'Track lanes view' },
  { id: 'mixer', icon: Sliders, label: 'Mixer', description: 'Stem mixing console' },
  { id: 'avatar-world', icon: Users2, label: 'World', description: 'Live jam scene' },
];

export function MainViewSwitcher({
  activeView,
  onViewChange,
  isMaster,
}: MainViewSwitcherProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
      {views.map(({ id, icon: Icon, label, description }) => (
        <button
          key={id}
          onClick={() => onViewChange(id)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
            activeView === id
              ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-white/50 dark:hover:bg-white/5'
          )}
          title={description}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{label}</span>
          {/* Master indicator for mixer */}
          {id === 'mixer' && !isMaster && activeView !== id && (
            <span className="text-[9px] text-amber-500/70 font-normal">(view)</span>
          )}
        </button>
      ))}
    </div>
  );
}
