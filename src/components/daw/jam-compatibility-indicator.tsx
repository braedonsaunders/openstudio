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
  tight: 'Tight Jamming',
  good: 'Good to Jam',
  loose: 'Loose Jamming',
  difficult: 'Difficult',
  impossible: 'Too High Latency',
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
    <div className={cn('rounded-xl border overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full px-4 py-3 flex items-center justify-between',
          getJamQualityBgColor(compatibility.quality),
          'hover:brightness-95 transition-all'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center',
            compatibility.canJam ? 'bg-white/50' : 'bg-red-500/20',
            getJamQualityColor(compatibility.quality)
          )}>
            {qualityIcons[compatibility.quality]}
          </div>

          <div className="text-left">
            <div className={cn(
              'font-medium',
              getJamQualityColor(compatibility.quality)
            )}>
              {qualityLabels[compatibility.quality]}
            </div>
            <div className="text-xs text-gray-600 dark:text-zinc-400">
              Group latency: {compatibility.maxGroupLatency}ms
              {compatibility.suggestedBpmMax && (
                <span className="ml-2">
                  Max BPM: ~{compatibility.suggestedBpmMax}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasOptimizations && !expanded && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
              <Lightbulb className="w-3 h-3" />
              <span>{compatibility.autoOptimizations.length} suggestions</span>
            </div>
          )}

          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
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
            <div className="px-4 py-3 bg-gray-50 dark:bg-white/5">
              <p className="text-sm text-gray-700 dark:text-zinc-300">
                {compatibility.recommendation}
              </p>
            </div>

            {/* Auto-optimizations */}
            {hasOptimizations && (
              <div className="px-4 py-3 space-y-2">
                <div className="text-xs font-medium text-gray-500 dark:text-zinc-500 mb-2">
                  Suggested Optimizations
                </div>

                {compatibility.autoOptimizations.map((opt, index) => (
                  <div
                    key={`${opt.type}-${index}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-gray-100 dark:bg-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center',
                        opt.automatic
                          ? 'bg-emerald-500/20 text-emerald-500'
                          : 'bg-amber-500/20 text-amber-500'
                      )}>
                        {opt.automatic ? (
                          <Zap className="w-3 h-3" />
                        ) : (
                          <Lightbulb className="w-3 h-3" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm text-gray-900 dark:text-white">
                          {opt.description}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-zinc-500">
                          {opt.automatic ? 'Will apply automatically' : 'Requires approval'}
                        </div>
                      </div>
                    </div>

                    {!opt.automatic && !opt.applied && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onAcceptOptimization?.(opt.type)}
                          className="px-2 py-1 text-xs rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => onDismissOptimization?.(opt.type)}
                          className="px-2 py-1 text-xs rounded bg-gray-300 dark:bg-white/10 text-gray-700 dark:text-zinc-300 hover:bg-gray-400 dark:hover:bg-white/20 transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}

                    {opt.applied && (
                      <span className="px-2 py-1 text-xs rounded bg-emerald-500/20 text-emerald-500">
                        Applied
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tips based on quality */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-white/10">
              <div className="text-xs font-medium text-gray-500 dark:text-zinc-500 mb-2">
                Tips for Better Jamming
              </div>
              <ul className="text-xs text-gray-600 dark:text-zinc-400 space-y-1">
                {compatibility.quality === 'tight' && (
                  <>
                    <li>• You&apos;re in great shape! Play any genre, any tempo.</li>
                    <li>• Consider using Studio Quality preset for best audio.</li>
                  </>
                )}
                {compatibility.quality === 'good' && (
                  <>
                    <li>• Great for most music. Fast tempos work well.</li>
                    <li>• Consider Low Latency preset for tighter sync.</li>
                  </>
                )}
                {compatibility.quality === 'loose' && (
                  <>
                    <li>• Best for slower tempos and ambient music.</li>
                    <li>• Jazz, ballads, and atmospheric music work well.</li>
                    <li>• Enable Ultra Low Latency preset if possible.</li>
                  </>
                )}
                {compatibility.quality === 'difficult' && (
                  <>
                    <li>• Try turn-taking mode: one person plays at a time.</li>
                    <li>• Slow ambient music may still work.</li>
                    <li>• Check if anyone can use a wired connection.</li>
                  </>
                )}
                {compatibility.quality === 'impossible' && (
                  <>
                    <li>• Real-time jamming isn&apos;t possible at this latency.</li>
                    <li>• Try: wired connections, closer server region.</li>
                    <li>• Consider recording and sharing instead.</li>
                  </>
                )}
              </ul>
            </div>
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
