'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface LevelMeterProps {
  level: number; // 0-1
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  showPeak?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function LevelMeter({
  level,
  className,
  orientation = 'horizontal',
  showPeak = true,
  size = 'md',
}: LevelMeterProps) {
  const percentage = Math.min(100, Math.max(0, level * 100));

  const getColor = useMemo(() => {
    if (percentage > 90) return 'bg-red-500';
    if (percentage > 70) return 'bg-yellow-500';
    return 'bg-green-500';
  }, [percentage]);

  const sizes = {
    sm: orientation === 'horizontal' ? 'h-1' : 'w-1',
    md: orientation === 'horizontal' ? 'h-2' : 'w-2',
    lg: orientation === 'horizontal' ? 'h-3' : 'w-3',
  };

  if (orientation === 'vertical') {
    return (
      <div
        className={cn(
          'relative bg-gray-800 rounded-full overflow-hidden',
          sizes[size],
          'h-24',
          className
        )}
      >
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 transition-all duration-75',
            getColor
          )}
          style={{ height: `${percentage}%` }}
        />
        {showPeak && percentage > 90 && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse" />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative w-full bg-gray-800 rounded-full overflow-hidden',
        sizes[size],
        className
      )}
    >
      <div
        className={cn(
          'h-full transition-all duration-75',
          getColor
        )}
        style={{ width: `${percentage}%` }}
      />
      {showPeak && percentage > 90 && (
        <div className="absolute top-0 right-0 bottom-0 w-1 bg-red-500 animate-pulse" />
      )}
    </div>
  );
}

interface StereoLevelMeterProps {
  leftLevel: number;
  rightLevel: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function StereoLevelMeter({
  leftLevel,
  rightLevel,
  className,
  size = 'md',
}: StereoLevelMeterProps) {
  return (
    <div className={cn('flex gap-1', className)}>
      <LevelMeter level={leftLevel} orientation="vertical" size={size} />
      <LevelMeter level={rightLevel} orientation="vertical" size={size} />
    </div>
  );
}
