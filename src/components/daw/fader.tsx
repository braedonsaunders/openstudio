'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface FaderProps {
  value: number; // 0-1
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  disabled?: boolean;
}

export function Fader({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  orientation = 'horizontal',
  className,
  disabled = false,
}: FaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const normalizedValue = (value - min) / (max - min);

  const updateValue = useCallback((clientX: number, clientY: number) => {
    if (!trackRef.current || disabled) return;

    const rect = trackRef.current.getBoundingClientRect();
    let ratio: number;

    if (orientation === 'horizontal') {
      ratio = (clientX - rect.left) / rect.width;
    } else {
      ratio = 1 - (clientY - rect.top) / rect.height;
    }

    ratio = Math.max(0, Math.min(1, ratio));
    const newValue = min + ratio * (max - min);
    const steppedValue = Math.round(newValue / step) * step;
    onChange(Math.max(min, Math.min(max, steppedValue)));
  }, [orientation, min, max, step, onChange, disabled]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    updateValue(e.clientX, e.clientY);
  }, [updateValue, disabled]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateValue(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, updateValue]);

  if (orientation === 'vertical') {
    return (
      <div
        ref={trackRef}
        className={cn(
          'relative w-6 h-full cursor-pointer select-none',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        onMouseDown={handleMouseDown}
      >
        {/* Track */}
        <div className="absolute left-1/2 -translate-x-1/2 w-2 h-full fader-track rounded" />

        {/* Fill */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-2 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded transition-all"
          style={{
            height: `${normalizedValue * 100}%`,
            bottom: 0,
          }}
        />

        {/* Thumb */}
        <div
          className={cn(
            'absolute left-1/2 -translate-x-1/2 w-5 h-3 fader-thumb rounded-sm cursor-grab',
            isDragging && 'cursor-grabbing'
          )}
          style={{
            bottom: `calc(${normalizedValue * 100}% - 6px)`,
          }}
        >
          {/* Grip lines */}
          <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
            <div className="h-px bg-white/20" />
            <div className="h-px bg-white/20" />
          </div>
        </div>

        {/* Center mark */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-white/10" />
      </div>
    );
  }

  return (
    <div
      ref={trackRef}
      className={cn(
        'relative h-2 w-full cursor-pointer select-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onMouseDown={handleMouseDown}
    >
      {/* Track */}
      <div className="absolute inset-0 rounded-full fader-track" />

      {/* Fill */}
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-75"
        style={{
          width: `${normalizedValue * 100}%`,
        }}
      />

      {/* Thumb */}
      <div
        className={cn(
          'absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full fader-thumb cursor-grab shadow-lg',
          isDragging && 'cursor-grabbing scale-110'
        )}
        style={{
          left: `calc(${normalizedValue * 100}% - 8px)`,
        }}
      />
    </div>
  );
}

// Knob variant for pan controls
interface KnobProps {
  value: number; // -1 to 1 for pan, 0-1 for other
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}

export function Knob({
  value,
  onChange,
  min = -1,
  max = 1,
  size = 'md',
  className,
  disabled = false,
}: KnobProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startValue = useRef(value);

  const normalizedValue = (value - min) / (max - min);
  const rotation = normalizedValue * 270 - 135; // -135 to +135 degrees

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = value;
  }, [value, disabled]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startY.current - e.clientY;
      const sensitivity = 0.005;
      const deltaValue = deltaY * sensitivity * (max - min);
      const newValue = Math.max(min, Math.min(max, startValue.current + deltaValue));
      onChange(newValue);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, min, max, onChange]);

  return (
    <div
      ref={knobRef}
      className={cn(
        'relative rounded-full cursor-pointer select-none knob-outer',
        sizeClasses[size],
        isDragging && 'ring-2 ring-indigo-500/50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onMouseDown={handleMouseDown}
    >
      {/* Rotation indicator */}
      <div
        className="absolute inset-1 rounded-full"
        style={{
          transform: `rotate(${rotation}deg)`,
        }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-1.5 knob-indicator rounded-full" />
      </div>

      {/* Arc indicator (optional, shows range) */}
      <svg
        className="absolute inset-0 w-full h-full -rotate-[135deg]"
        viewBox="0 0 32 32"
      >
        <circle
          cx="16"
          cy="16"
          r="14"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="2"
          strokeDasharray={`${270 * Math.PI * 14 / 180} 360`}
        />
        <circle
          cx="16"
          cy="16"
          r="14"
          fill="none"
          stroke="#6366f1"
          strokeWidth="2"
          strokeDasharray={`${normalizedValue * 270 * Math.PI * 14 / 180} 360`}
          strokeLinecap="round"
          className="drop-shadow-[0_0_4px_rgba(99,102,241,0.5)]"
        />
      </svg>
    </div>
  );
}
