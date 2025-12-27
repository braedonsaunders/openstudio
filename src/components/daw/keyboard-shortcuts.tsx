'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface KeyboardShortcutsProps {
  onClose: () => void;
}

const shortcuts = [
  {
    category: 'Transport',
    items: [
      { key: 'Space', description: 'Play / Pause' },
      { key: '← →', description: 'Seek 5 seconds' },
      { key: 'Shift + ← →', description: 'Seek 30 seconds' },
      { key: '[ ]', description: 'Previous / Next track' },
    ],
  },
  {
    category: 'Mixing',
    items: [
      { key: 'M', description: 'Mute yourself' },
      { key: '1-9', description: 'Solo track 1-9' },
      { key: 'Shift + 1-9', description: 'Mute track 1-9' },
    ],
  },
  {
    category: 'Panels',
    items: [
      { key: 'Tab', description: 'Cycle panels' },
      { key: 'Q', description: 'Queue panel' },
      { key: 'A', description: 'Analysis panel' },
      { key: 'C', description: 'Chat panel' },
    ],
  },
  {
    category: 'General',
    items: [
      { key: '?', description: 'Show shortcuts' },
      { key: 'Esc', description: 'Close dialogs' },
      { key: 'Ctrl + Scroll', description: 'Zoom timeline' },
    ],
  },
];

export function KeyboardShortcuts({ onClose }: KeyboardShortcutsProps) {
  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div
          className="glass-elevated rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden pointer-events-auto animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
            {shortcuts.map((section) => (
              <div key={section.category}>
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                  {section.category}
                </h3>
                <div className="space-y-2">
                  {section.items.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm text-zinc-300">{item.description}</span>
                      <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-zinc-400">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02]">
            <p className="text-xs text-zinc-500 text-center">
              Press <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-zinc-400 font-mono">?</kbd> anytime to show this dialog
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
