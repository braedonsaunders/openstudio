'use client';

import { useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from './button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
  variant?: 'light' | 'dark';
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  showCloseButton = true,
  variant = 'light',
}: ModalProps) {
  const isDark = variant === 'dark';
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative z-10 w-full max-w-lg rounded-2xl shadow-2xl',
          'animate-in fade-in-0 zoom-in-95 duration-200',
          'max-h-[90vh] overflow-y-auto',
          isDark ? 'bg-gray-900' : 'bg-white',
          className
        )}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className={cn(
            "flex items-center justify-between p-6 border-b sticky top-0 z-10",
            isDark ? 'border-gray-700 bg-gray-900' : 'border-slate-200 bg-white'
          )}>
            <div>
              {title && (
                <h2 className={cn("text-xl font-semibold", isDark ? 'text-white' : 'text-slate-900')}>{title}</h2>
              )}
              {description && (
                <p className={cn("mt-1 text-sm", isDark ? 'text-gray-400' : 'text-slate-500')}>{description}</p>
              )}
            </div>
            {showCloseButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className={isDark ? "text-gray-400 hover:text-white" : "text-slate-400 hover:text-slate-700"}
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
