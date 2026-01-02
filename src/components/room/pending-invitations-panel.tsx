'use client';

import { useState } from 'react';
import { useRoomInvitations } from '@/hooks/useRoomInvitations';
import { Button } from '@/components/ui/button';
import {
  Mail,
  Link2,
  User,
  Clock,
  X,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RoomInvitationWithDetails } from '@/types/invitations';

interface PendingInvitationsPanelProps {
  roomId: string;
  className?: string;
}

export function PendingInvitationsPanel({
  roomId,
  className,
}: PendingInvitationsPanelProps) {
  const { invitations, isLoading, error, refresh, revokeInvitation } =
    useRoomInvitations(roomId);

  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Filter to pending only
  const pendingInvitations = invitations.filter((i) => i.status === 'pending');

  const handleRevoke = async (invitationId: string) => {
    setRevokingId(invitationId);
    await revokeInvitation(invitationId);
    setRevokingId(null);
  };

  const formatExpiry = (expiresAt?: string) => {
    if (!expiresAt) return 'Never expires';

    const exp = new Date(expiresAt);
    const now = new Date();
    const diff = exp.getTime() - now.getTime();

    if (diff < 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d left`;
    if (hours > 0) return `${hours}h left`;
    return 'Expires soon';
  };

  const getInviteTypeIcon = (inv: RoomInvitationWithDetails) => {
    if (inv.inviteCode) return <Link2 className="w-4 h-4" />;
    if (inv.invitedEmail) return <Mail className="w-4 h-4" />;
    return <User className="w-4 h-4" />;
  };

  const getInviteTarget = (inv: RoomInvitationWithDetails) => {
    if (inv.invitedUserName) return inv.invitedUserName;
    if (inv.invitedEmail) return inv.invitedEmail;
    if (inv.inviteCode) return 'Invite Link';
    return 'Unknown';
  };

  if (isLoading) {
    return (
      <div className={cn('p-4', className)}>
        <div className="flex items-center gap-2 text-gray-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading invitations...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4', className)}>
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            className="ml-auto text-gray-400 hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (pendingInvitations.length === 0) {
    return (
      <div className={cn('p-4', className)}>
        <p className="text-sm text-gray-500 text-center">
          No pending invitations
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between px-2">
        <h4 className="text-sm font-medium text-gray-400">
          Pending Invitations ({pendingInvitations.length})
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          className="text-gray-400 hover:text-white h-7 w-7 p-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="space-y-1">
        {pendingInvitations.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors"
          >
            {/* Type Icon */}
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 text-gray-400">
              {getInviteTypeIcon(inv)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {getInviteTarget(inv)}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>by {inv.inviterName || 'Unknown'}</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatExpiry(inv.expiresAt)}
                </span>
              </div>
            </div>

            {/* Revoke Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRevoke(inv.id)}
              loading={revokingId === inv.id}
              className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
