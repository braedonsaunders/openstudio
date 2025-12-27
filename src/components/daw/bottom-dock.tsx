'use client';

import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface BottomDockProps {
  onClose: () => void;
}

export function BottomDock({ onClose }: BottomDockProps) {
  return (
    <div className="h-48 bg-gray-100 dark:bg-[#12121a] border-t border-gray-200 dark:border-white/5 shrink-0 panel-slide-up">
      {/* Header */}
      <div className="h-8 flex items-center justify-between px-4 border-b border-gray-200 dark:border-white/5">
        <span className="text-xs text-gray-500 dark:text-zinc-500">Extended View</span>
        <button
          onClick={onClose}
          className="p-1 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-4">
        <div className="h-full flex items-center justify-center">
          <p className="text-sm text-gray-500 dark:text-zinc-600">
            Extended controls and visualizations (Coming Soon)
          </p>
        </div>
      </div>
    </div>
  );
}
