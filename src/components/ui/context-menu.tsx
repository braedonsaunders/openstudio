'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let { x, y } = position;

    // Adjust horizontal position
    if (x + rect.width > viewportWidth - 10) {
      x = viewportWidth - rect.width - 10;
    }

    // Adjust vertical position
    if (y + rect.height > viewportHeight - 10) {
      y = viewportHeight - rect.height - 10;
    }

    setAdjustedPosition({ x: Math.max(10, x), y: Math.max(10, y) });
  }, [position]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  return createPortal(
    <div
      ref={menuRef}
      className={cn(
        'fixed z-[9999] min-w-[160px] py-1 rounded-lg shadow-xl border',
        'animate-in fade-in-0 zoom-in-95 duration-100',
        isDark
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-slate-200'
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {items.map((item, index) => {
        if (item.divider) {
          return (
            <div
              key={index}
              className={cn(
                'my-1 h-px',
                isDark ? 'bg-gray-700' : 'bg-slate-200'
              )}
            />
          );
        }

        return (
          <button
            key={index}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            disabled={item.disabled}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors',
              item.disabled && 'opacity-50 cursor-not-allowed',
              !item.disabled && (
                item.danger
                  ? 'hover:bg-red-500/10 text-red-500'
                  : isDark
                    ? 'hover:bg-gray-700 text-gray-200'
                    : 'hover:bg-slate-100 text-slate-700'
              )
            )}
          >
            {item.icon && (
              <span className={cn('w-4 h-4', item.danger ? 'text-red-500' : isDark ? 'text-gray-400' : 'text-slate-400')}>
                {item.icon}
              </span>
            )}
            {item.label}
          </button>
        );
      })}
    </div>,
    document.body
  );
}

// Hook to manage context menu state
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number };
    items: ContextMenuItem[];
  } | null>(null);

  const showContextMenu = useCallback(
    (e: React.MouseEvent, items: ContextMenuItem[]) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        position: { x: e.clientX, y: e.clientY },
        items,
      });
    },
    []
  );

  const hideContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const ContextMenuComponent = contextMenu ? (
    <ContextMenu
      items={contextMenu.items}
      position={contextMenu.position}
      onClose={hideContextMenu}
    />
  ) : null;

  return {
    showContextMenu,
    hideContextMenu,
    ContextMenuComponent,
  };
}
