'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  onResize: (delta: number) => void;
  position: 'left' | 'right';
  className?: string;
}

export function ResizeHandle({ onResize, position, className }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartX(e.clientX);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      setStartX(e.clientX);

      // For left panel, positive delta = expand right
      // For right panel, negative delta = expand left (so we invert)
      onResize(position === 'left' ? delta : -delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection while dragging
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, startX, onResize, position]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        'w-1 cursor-col-resize group relative z-20 flex-shrink-0',
        'hover:bg-indigo-500/50 transition-colors',
        isDragging && 'bg-indigo-500',
        className
      )}
    >
      {/* Larger hit area for easier grabbing */}
      <div className="absolute inset-y-0 -left-1 -right-1" />

      {/* Visual indicator on hover */}
      <div
        className={cn(
          'absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 rounded-full transition-all',
          'opacity-0 group-hover:opacity-100',
          isDragging ? 'opacity-100 bg-indigo-400' : 'bg-indigo-500/70'
        )}
      />
    </div>
  );
}
