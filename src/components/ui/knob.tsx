'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

export interface KnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  unit?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  color?: 'indigo' | 'orange';
}

function formatValue(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(1);
}

export function Knob({
  value,
  min,
  max,
  onChange,
  label,
  unit = '',
  size = 'md',
  disabled = false,
  color = 'indigo',
}: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startValue, setStartValue] = useState(0);

  const normalizedValue = (value - min) / (max - min);
  const rotation = -135 + normalizedValue * 270;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    setStartY(e.clientY);
    setStartValue(value);
    e.preventDefault();
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const delta = (startY - e.clientY) * ((max - min) / 100);
      const newValue = Math.max(min, Math.min(max, startValue + delta));
      onChange(newValue);
    },
    [isDragging, startY, startValue, min, max, onChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const colorClasses = color === 'orange' ? 'text-orange-500/30' : 'text-indigo-500/30';
  const indicatorColor = color === 'orange' ? 'bg-orange-400' : 'bg-indigo-400';

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          sizeClasses,
          'relative rounded-full bg-gradient-to-b from-zinc-700 to-zinc-800 shadow-inner cursor-pointer',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onMouseDown={handleMouseDown}
      >
        <div
          className="absolute inset-1 rounded-full bg-gradient-to-b from-zinc-600 to-zinc-700 shadow"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className={cn('absolute top-1 left-1/2 -translate-x-1/2 w-0.5 h-1.5 rounded-full', indicatorColor)} />
        </div>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 40 40">
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${normalizedValue * 85} 100`}
            strokeDashoffset="25"
            className={colorClasses}
            style={{ transform: 'rotate(-135deg)', transformOrigin: 'center' }}
          />
        </svg>
      </div>
      <div className="text-center">
        <div className="text-[9px] text-zinc-500 uppercase tracking-wide">{label}</div>
        <div className="text-[10px] text-zinc-300">
          {formatValue(value)}{unit}
        </div>
      </div>
    </div>
  );
}
