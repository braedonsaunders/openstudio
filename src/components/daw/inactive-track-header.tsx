'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Mic,
  Monitor,
  UserX,
  Hand,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import type { UserTrack } from '@/types';

interface InactiveTrackHeaderProps {
  track: UserTrack;
  trackNumber: number;
  onClaim: () => void;
  onDelete: () => void;
}

export function InactiveTrackHeader({
  track,
  trackNumber: _trackNumber,
  onClaim,
  onDelete,
}: InactiveTrackHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Update menu position when showMenu changes
  useEffect(() => {
    if (showMenu && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left - 120,
      });
    }
  }, [showMenu]);

  return (
    <div
      className="border-b border-gray-200 dark:border-white/5 opacity-50"
      style={{ '--track-color': track.color } as React.CSSProperties}
    >
      {/* Main Track Row */}
      <div className="flex items-stretch gap-2 px-2 py-2">
        {/* Track Color Bar - greyed out */}
        <div className="relative flex-shrink-0">
          <div
            className="w-1 h-full min-h-[56px] rounded-full bg-gray-400 dark:bg-zinc-600"
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* Track Name Row */}
          <div className="flex items-center gap-1.5">
            {/* Disconnected Icon */}
            <div className="p-0.5 text-gray-500 dark:text-zinc-500">
              <UserX className="w-3 h-3" />
            </div>

            {/* Input Mode Icon - greyed out */}
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-gray-400 dark:bg-zinc-600">
              {track.audioSettings.inputMode === 'application' ? (
                <Monitor className="w-2.5 h-2.5 text-white" />
              ) : (
                <Mic className="w-2.5 h-2.5 text-white" />
              )}
            </div>

            {/* Track Name and Owner */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-gray-500 dark:text-zinc-500 truncate">
                  {track.name}
                </span>
              </div>
              <div className="text-[9px] text-gray-400 dark:text-zinc-600 truncate">
                {track.ownerUserName || 'Unknown user'} (disconnected)
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {/* Claim Button */}
              <button
                onClick={onClaim}
                className="p-1.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 transition-colors"
                title="Claim this track"
              >
                <Hand className="w-3 h-3" />
              </button>

              {/* Menu Button */}
              <button
                ref={menuButtonRef}
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Info Row */}
          <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-zinc-600">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-zinc-600" />
              Offline
            </span>
            <span>
              {track.audioSettings.inputMode === 'application'
                ? track.audioSettings.applicationName || 'App'
                : 'Microphone'}
            </span>
          </div>
        </div>
      </div>

      {/* Dropdown Menu */}
      {showMenu && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed z-[100]"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
          }}
        >
          <div className="w-40 bg-white dark:bg-[#16161f] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl overflow-hidden">
            <button
              onClick={() => {
                onClaim();
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <Hand className="w-3.5 h-3.5 text-indigo-500" />
              Claim Track
            </button>
            <div className="border-t border-gray-200 dark:border-white/5" />
            <button
              onClick={() => {
                onDelete();
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Track
            </button>
          </div>
          {/* Click outside handler */}
          <div
            className="fixed inset-0 -z-10"
            onClick={() => setShowMenu(false)}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
