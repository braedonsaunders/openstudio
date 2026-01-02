'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMyInvitations } from '@/hooks/useMyInvitations';
import { Button } from '@/components/ui/button';
import {
  Mail,
  Check,
  X,
  Clock,
  Music,
  ChevronDown,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROOM_COLORS, ROOM_ICONS } from '@/types/index';

interface MyInvitationsDropdownProps {
  className?: string;
}

export function MyInvitationsDropdown({ className }: MyInvitationsDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { invitations, count, isLoading, acceptInvitation, declineInvitation } =
    useMyInvitations();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAccept = async (invitationId: string) => {
    setProcessingId(invitationId);
    const result = await acceptInvitation(invitationId);
    setProcessingId(null);

    if (result?.success && result.roomId) {
      setIsOpen(false);
      router.push(`/room/${result.roomId}`);
    }
  };

  const handleDecline = async (invitationId: string) => {
    setProcessingId(invitationId);
    await declineInvitation(invitationId);
    setProcessingId(null);
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getRoomColor = (colorValue?: string) => {
    const color = ROOM_COLORS.find((c) => c.value === colorValue);
    return color?.bg || 'bg-indigo-500';
  };

  const getRoomIcon = (iconValue?: string) => {
    const icon = ROOM_ICONS.find((i) => i.value === iconValue);
    return icon?.icon || null;
  };

  // Don't render if loading or no invitations
  if (isLoading || count === 0) {
    return null;
  }

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl transition-all',
          'hover:bg-gray-800/50',
          isOpen && 'bg-gray-800/50'
        )}
      >
        <div className="relative">
          <Bell className="w-5 h-5 text-gray-400" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[10px] font-bold bg-indigo-500 text-white rounded-full">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </div>
        <span className="text-sm text-gray-300 hidden sm:inline">Invites</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-500 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-700">
            <h3 className="font-semibold text-white">Room Invitations</h3>
            <p className="text-xs text-gray-500">
              {count} pending {count === 1 ? 'invitation' : 'invitations'}
            </p>
          </div>

          {/* Invitations List */}
          <div className="max-h-80 overflow-y-auto">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="p-4 border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex gap-3">
                  {/* Room Icon */}
                  <div
                    className={cn(
                      'w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 text-white',
                      getRoomColor(inv.roomColor)
                    )}
                  >
                    {getRoomIcon(inv.roomIcon) || <Music className="w-5 h-5" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">
                      {inv.roomName}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      Invited by {inv.inviterName || 'Unknown'}
                    </p>
                    {inv.message && (
                      <p className="text-xs text-gray-500 mt-1 italic truncate">
                        &ldquo;{inv.message}&rdquo;
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {formatTimeAgo(inv.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDecline(inv.id)}
                    disabled={processingId === inv.id}
                    className="flex-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Decline
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleAccept(inv.id)}
                    loading={processingId === inv.id}
                    className="flex-1"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
