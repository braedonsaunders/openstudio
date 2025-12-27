'use client';

import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface FullHeightMeterProps {
  level: number; // 0-1
  color: string;
  showPeak?: boolean;
  className?: string;
  segments?: number;
}

// Parse color string to get RGB values
function parseColor(color: string): { r: number; g: number; b: number } {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return { r: 99, g: 102, b: 241 };
}

export function FullHeightMeter({
  level,
  color,
  showPeak = true,
  className,
  segments = 20,
}: FullHeightMeterProps) {
  const [peak, setPeak] = useState(0);
  const [smoothLevel, setSmoothLevel] = useState(0);
  const peakDecayRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);
  const targetLevelRef = useRef(0);

  // Smooth level animation
  useEffect(() => {
    targetLevelRef.current = level;

    const animate = () => {
      setSmoothLevel(prev => {
        const target = targetLevelRef.current;
        const diff = target - prev;
        // Fast attack, slow release
        const speed = diff > 0 ? 0.3 : 0.08;
        const next = prev + diff * speed;
        return Math.abs(diff) < 0.001 ? target : next;
      });
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [level]);

  // Peak tracking
  useEffect(() => {
    if (level > peak) {
      setPeak(level);
      if (peakDecayRef.current) {
        clearTimeout(peakDecayRef.current);
      }
      peakDecayRef.current = setTimeout(() => {
        const decay = () => {
          setPeak(p => {
            if (p <= level) return level;
            const next = p - 0.015;
            if (next > level) {
              setTimeout(decay, 30);
            }
            return Math.max(next, level);
          });
        };
        decay();
      }, 800);
    }

    return () => {
      if (peakDecayRef.current) {
        clearTimeout(peakDecayRef.current);
      }
    };
  }, [level, peak]);

  const baseColor = parseColor(color);
  const litSegments = Math.floor(smoothLevel * segments);
  const peakSegment = Math.floor(peak * segments);

  return (
    <div className={cn('relative w-full h-full flex flex-col-reverse gap-[2px] p-1', className)}>
      {/* Background glow when active */}
      {smoothLevel > 0.1 && (
        <div
          className="absolute inset-0 rounded transition-opacity duration-150"
          style={{
            background: `radial-gradient(ellipse at center bottom, ${color}20, transparent 70%)`,
            opacity: smoothLevel,
          }}
        />
      )}

      {/* Segments */}
      {Array.from({ length: segments }).map((_, i) => {
        const isLit = i < litSegments;
        const isPeak = showPeak && i === peakSegment && peak > 0.05;
        const segmentPosition = i / segments;

        // Color zones
        let segmentColor: string;
        let glowColor: string;

        if (segmentPosition >= 0.85) {
          // Red zone - top 15%
          segmentColor = isLit ? '#ef4444' : 'rgba(239, 68, 68, 0.15)';
          glowColor = 'rgba(239, 68, 68, 0.8)';
        } else if (segmentPosition >= 0.65) {
          // Yellow zone - 65-85%
          segmentColor = isLit ? '#eab308' : 'rgba(234, 179, 8, 0.15)';
          glowColor = 'rgba(234, 179, 8, 0.6)';
        } else {
          // Track color zone - bottom 65%
          segmentColor = isLit
            ? `rgb(${baseColor.r}, ${baseColor.g}, ${baseColor.b})`
            : `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.15)`;
          glowColor = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.6)`;
        }

        // Intensity increases towards top
        const intensity = isLit ? 0.7 + (segmentPosition * 0.3) : 0;

        return (
          <div
            key={i}
            className={cn(
              'w-full flex-1 rounded-[2px] transition-all',
              isLit && 'transition-none',
              isPeak && 'ring-1 ring-white/80'
            )}
            style={{
              backgroundColor: segmentColor,
              boxShadow: isLit
                ? `0 0 ${6 + intensity * 6}px ${glowColor}, inset 0 0 4px rgba(255,255,255,${intensity * 0.3})`
                : 'none',
              opacity: isLit ? 0.9 + intensity * 0.1 : 0.4,
            }}
          />
        );
      })}

      {/* Clip indicator */}
      {peak >= 0.98 && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
      )}
    </div>
  );
}
