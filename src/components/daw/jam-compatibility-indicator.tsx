'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Music2,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
} from 'lucide-react';
import type { JamCompatibility, AutoOptimization } from '@/types';
import { getJamQualityColor, getJamQualityBgColor } from '@/stores/performance-sync-store';
import { useState } from 'react';

interface JamCompatibilityIndicatorProps {
  compatibility: JamCompatibility;
  onAcceptOptimization?: (type: AutoOptimization['type']) => void;
  onDismissOptimization?: (type: AutoOptimization['type']) => void;
  className?: string;
}

const qualityIcons = {
  tight: <Zap className="w-4 h-4" />,
  good: <CheckCircle className="w-4 h-4" />,
  loose: <Music2 className="w-4 h-4" />,
  difficult: <AlertTriangle className="w-4 h-4" />,
  impossible: <XCircle className="w-4 h-4" />,
};

const qualityLabels = {
  tight: 'Excellent',
  good: 'Good',
  loose: 'Playable',
  difficult: 'Difficult',
  impossible: 'Unstable',
};

export function JamCompatibilityIndicator({
  compatibility,
  onAcceptOptimization,
  onDismissOptimization,
  className,
}: JamCompatibilityIndicatorProps) {
  const [expanded, setExpanded] = useState(false);
  const hasOptimizations = compatibility.autoOptimizations.length > 0;

  return (
    <div className={cn('rounded-lg border overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full px-3 py-2 flex items-center justify-between',
          getJamQualityBgColor(compatibility.quality),
          'hover:brightness-95 transition-all'
        )}
      >
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center',
            compatibility.canJam ? 'bg-white/50' : 'bg-red-500/20',
            getJamQualityColor(compatibility.quality)
          )}>
            {qualityIcons[compatibility.quality]}
          </div>

          <div className={cn(
            'font-medium text-sm',
            getJamQualityColor(compatibility.quality)
          )}>
            {qualityLabels[compatibility.quality]}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-zinc-400">
            <span className="font-mono">{compatibility.maxGroupLatency}ms</span>
            {compatibility.suggestedBpmMax && (
              <>
                <span className="text-gray-300 dark:text-zinc-600">·</span>
                <span>≤{compatibility.suggestedBpmMax} BPM</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {hasOptimizations && !expanded && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px]">
              <Lightbulb className="w-2.5 h-2.5" />
              <span>{compatibility.autoOptimizations.length}</span>
            </div>
          )}

          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-200 dark:border-white/10"
          >
            {/* Recommendation */}
            <div className="px-3 py-2 bg-gray-50 dark:bg-white/5">
              <p className="text-xs text-gray-600 dark:text-zinc-400">
                {compatibility.recommendation}
              </p>
            </div>

            {/* Auto-optimizations */}
            {hasOptimizations && (
              <div className="px-3 py-2 space-y-1.5">
                {compatibility.autoOptimizations.map((opt, index) => (
                  <div
                    key={`${opt.type}-${index}`}
                    className="flex items-center justify-between p-1.5 rounded-md bg-gray-100 dark:bg-white/5"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center',
                        opt.automatic
                          ? 'bg-emerald-500/20 text-emerald-500'
                          : 'bg-amber-500/20 text-amber-500'
                      )}>
                        {opt.automatic ? (
                          <Zap className="w-2.5 h-2.5" />
                        ) : (
                          <Lightbulb className="w-2.5 h-2.5" />
                        )}
                      </div>
                      <span className="text-xs text-gray-700 dark:text-zinc-300">
                        {opt.description}
                      </span>
                    </div>

                    {!opt.automatic && !opt.applied && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onAcceptOptimization?.(opt.type)}
                          className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => onDismissOptimization?.(opt.type)}
                          className="px-1.5 py-0.5 text-[10px] rounded bg-gray-300 dark:bg-white/10 text-gray-600 dark:text-zinc-400 hover:bg-gray-400 dark:hover:bg-white/20 transition-colors"
                        >
                          Skip
                        </button>
                      </div>
                    )}

                    {opt.applied && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-500">
                        Applied
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Compact version for header/status bar
 */
export function JamCompatibilityBadge({
  compatibility,
  onClick,
}: {
  compatibility: JamCompatibility;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full transition-all',
        getJamQualityBgColor(compatibility.quality),
        'hover:brightness-95'
      )}
    >
      <div className={getJamQualityColor(compatibility.quality)}>
        {qualityIcons[compatibility.quality]}
      </div>
      <span className={cn('text-sm font-medium', getJamQualityColor(compatibility.quality))}>
        {compatibility.maxGroupLatency}ms
      </span>
    </button>
  );
}
