'use client';

import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface VerticalMeterProps {
  level: number; // 0-1
  color?: string;
  showPeak?: boolean;
  className?: string;
}

export function VerticalMeter({
  level,
  color = '#6366f1',
  showPeak = true,
  className,
}: VerticalMeterProps) {
  const [peak, setPeak] = useState(0);
  const peakDecayRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (level > peak) {
      setPeak(level);
      // Clear existing decay timer
      if (peakDecayRef.current) {
        clearTimeout(peakDecayRef.current);
      }
      // Start peak decay after 1 second
      peakDecayRef.current = setTimeout(() => {
        const decay = () => {
          setPeak((p) => {
            if (p <= level) return level;
            const next = p - 0.02;
            if (next > level) {
              setTimeout(decay, 50);
            }
            return Math.max(next, level);
          });
        };
        decay();
      }, 1000);
    }

    return () => {
      if (peakDecayRef.current) {
        clearTimeout(peakDecayRef.current);
      }
    };
  }, [level, peak]);

  // Calculate color zones
  const greenZone = Math.min(level * 100, 60);
  const yellowZone = level > 0.6 ? Math.min((level - 0.6) * 100 / 0.25, 25) : 0;
  const redZone = level > 0.85 ? (level - 0.85) * 100 / 0.15 : 0;

  return (
    <div className={cn('relative w-full h-full rounded-sm overflow-hidden bg-black/40', className)}>
      {/* Background gradient */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute bottom-0 left-0 right-0 h-[60%] bg-emerald-500" />
        <div className="absolute bottom-[60%] left-0 right-0 h-[25%] bg-yellow-500" />
        <div className="absolute bottom-[85%] left-0 right-0 h-[15%] bg-red-500" />
      </div>

      {/* Active level */}
      <div
        className="absolute bottom-0 left-0 right-0 transition-all duration-75"
        style={{
          height: `${level * 100}%`,
        }}
      >
        {/* Green zone */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-emerald-600 to-emerald-400"
          style={{
            height: greenZone <= 100 ? `${(greenZone / (level * 100)) * 100}%` : '100%',
          }}
        />
        {/* Yellow zone */}
        {yellowZone > 0 && (
          <div
            className="absolute left-0 right-0 bg-gradient-to-t from-yellow-500 to-yellow-400"
            style={{
              bottom: `${60 / level}%`,
              height: `${(yellowZone / (level * 100)) * 100}%`,
            }}
          />
        )}
        {/* Red zone */}
        {redZone > 0 && (
          <div
            className="absolute top-0 left-0 right-0 bg-gradient-to-t from-red-500 to-red-400"
            style={{
              height: `${(redZone * 15) / (level * 100) * 100}%`,
            }}
          />
        )}
      </div>

      {/* Peak indicator */}
      {showPeak && peak > 0 && (
        <div
          className="absolute left-0 right-0 h-0.5 bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)] transition-all duration-75"
          style={{
            bottom: `${peak * 100}%`,
          }}
        />
      )}

      {/* Glow effect when loud */}
      {level > 0.1 && (
        <div
          className="absolute inset-0 transition-opacity duration-150"
          style={{
            background: `linear-gradient(to top, ${color}20, transparent)`,
            opacity: level,
          }}
        />
      )}
    </div>
  );
}

// Horizontal variant for inline use
interface HorizontalMeterProps {
  level: number;
  color?: string;
  className?: string;
}

export function HorizontalMeter({
  level,
  color = '#6366f1',
  className,
}: HorizontalMeterProps) {
  return (
    <div className={cn('relative w-full h-2 rounded-full overflow-hidden bg-black/40', className)}>
      {/* Background segments */}
      <div className="absolute inset-0 flex opacity-20">
        <div className="w-[60%] h-full bg-emerald-500" />
        <div className="w-[25%] h-full bg-yellow-500" />
        <div className="w-[15%] h-full bg-red-500" />
      </div>

      {/* Active level */}
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-75"
        style={{
          width: `${level * 100}%`,
          background: level < 0.6
            ? 'linear-gradient(to right, #10b981, #34d399)'
            : level < 0.85
            ? 'linear-gradient(to right, #10b981, #34d399, #eab308)'
            : 'linear-gradient(to right, #10b981, #34d399, #eab308, #ef4444)',
        }}
      />
    </div>
  );
}
