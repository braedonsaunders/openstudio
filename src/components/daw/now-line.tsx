'use client';

import { cn } from '@/lib/utils';

interface NowLineProps {
  isRecording?: boolean;
  className?: string;
}

export function NowLine({ isRecording = false, className }: NowLineProps) {
  return (
    <div
      className={cn(
        'absolute top-0 bottom-0 w-px z-20 pointer-events-none',
        className
      )}
      style={{ right: 0 }}
    >
      {/* Main glow effect */}
      <div
        className={cn(
          'absolute inset-0 w-0.5 transition-all duration-300',
          isRecording
            ? 'bg-red-500 shadow-[0_0_20px_4px_rgba(239,68,68,0.6)]'
            : 'bg-indigo-500 shadow-[0_0_20px_4px_rgba(99,102,241,0.5)]'
        )}
      />

      {/* Secondary glow layer */}
      <div
        className={cn(
          'absolute inset-0 w-1 -left-0.5 blur-sm transition-all duration-300',
          isRecording ? 'bg-red-400/50' : 'bg-indigo-400/50'
        )}
      />

      {/* Top indicator triangle */}
      <div
        className={cn(
          'absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0',
          'border-l-[6px] border-l-transparent',
          'border-r-[6px] border-r-transparent',
          'border-t-[8px]',
          isRecording ? 'border-t-red-500' : 'border-t-indigo-500'
        )}
      />

      {/* NOW label */}
      <div
        className={cn(
          'absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider whitespace-nowrap',
          isRecording
            ? 'bg-red-500 text-white'
            : 'bg-indigo-500 text-white'
        )}
      >
        {isRecording ? 'REC' : 'NOW'}
      </div>

      {/* Animated pulse rings (recording) */}
      {isRecording && (
        <>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-red-500/20 animate-ping" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        </>
      )}

      {/* Particle effect container */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating particles */}
        <div
          className={cn(
            'absolute w-1 h-1 rounded-full animate-float-up',
            isRecording ? 'bg-red-400/60' : 'bg-indigo-400/60'
          )}
          style={{ left: '0px', animationDelay: '0s', animationDuration: '2s' }}
        />
        <div
          className={cn(
            'absolute w-0.5 h-0.5 rounded-full animate-float-up',
            isRecording ? 'bg-red-300/40' : 'bg-indigo-300/40'
          )}
          style={{ left: '-2px', animationDelay: '0.5s', animationDuration: '2.5s' }}
        />
        <div
          className={cn(
            'absolute w-1 h-1 rounded-full animate-float-up',
            isRecording ? 'bg-red-400/60' : 'bg-indigo-400/60'
          )}
          style={{ left: '2px', animationDelay: '1s', animationDuration: '1.8s' }}
        />
      </div>
    </div>
  );
}
