'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useInviteLink } from '@/hooks/useMyInvitations';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import {
  Music,
  AlertCircle,
  Clock,
  UserPlus,
  LogIn,
  Loader2,
  Check,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROOM_COLORS, ROOM_ICONS } from '@/types/index';

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const { user, isInitialized } = useAuthStore();
  const { isLoading, error, roomInfo, fetchLinkInfo, acceptInviteLink } =
    useInviteLink();

  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Fetch invite info on mount
  useEffect(() => {
    if (code) {
      fetchLinkInfo(code);
    }
  }, [code, fetchLinkInfo]);

  const handleAccept = async () => {
    if (!user) {
      // Redirect to login with return URL
      const returnUrl = encodeURIComponent(`/invite/${code}`);
      router.push(`/login?redirect=${returnUrl}`);
      return;
    }

    setIsAccepting(true);
    setAcceptError(null);

    const result = await acceptInviteLink(code);

    if (result?.success && result.roomId) {
      router.push(`/room/${result.roomId}`);
    } else {
      setAcceptError(result?.error || 'Failed to accept invitation');
      setIsAccepting(false);
    }
  };

  const getRoomColor = (colorValue?: string) => {
    const color = ROOM_COLORS.find((c) => c.value === colorValue);
    return color?.bg || 'bg-indigo-500';
  };

  const getRoomIcon = (iconValue?: string) => {
    const icon = ROOM_ICONS.find((i) => i.value === iconValue);
    return icon?.icon || null;
  };

  const formatExpiry = (expiresAt?: string) => {
    if (!expiresAt) return null;

    const exp = new Date(expiresAt);
    const now = new Date();
    const diff = exp.getTime() - now.getTime();

    if (diff < 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `Expires in ${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `Expires in ${hours} hour${hours > 1 ? 's' : ''}`;
    return 'Expires soon';
  };

  // Loading state
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gray-900 border-gray-700">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-gray-400">Verifying invite link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid invite
  if (!roomInfo?.valid || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gray-900 border-gray-700">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <CardTitle className="text-white">Invalid Invite Link</CardTitle>
            <CardDescription className="text-gray-400">
              {roomInfo?.error || error || 'This invite link is not valid.'}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button
              variant="secondary"
              onClick={() => router.push('/')}
              className="bg-gray-800 hover:bg-gray-700 text-white"
            >
              Go Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Valid invite
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-900 border-gray-700 overflow-hidden">
        {/* Room Header */}
        <div
          className={cn(
            'p-8 flex flex-col items-center text-center',
            getRoomColor(roomInfo.roomColor)
          )}
        >
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl mb-4">
            {getRoomIcon(roomInfo.roomIcon) || <Music className="w-10 h-10 text-white" />}
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">
            {roomInfo.roomName}
          </h1>
          {roomInfo.inviterName && (
            <p className="text-white/80 text-sm">
              Invited by {roomInfo.inviterName}
            </p>
          )}
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Expiry Warning */}
          {roomInfo.expiresAt && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{formatExpiry(roomInfo.expiresAt)}</span>
            </div>
          )}

          {/* Error */}
          {acceptError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{acceptError}</span>
            </div>
          )}

          {/* Auth Status */}
          {!user && (
            <div className="text-center p-4 bg-gray-800/50 rounded-xl">
              <p className="text-gray-400 text-sm mb-2">
                You need to be logged in to join this room
              </p>
              <p className="text-gray-500 text-xs">
                You&apos;ll be redirected back here after logging in
              </p>
            </div>
          )}

          {user && (
            <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <Check className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-emerald-400 text-sm font-medium">
                  Ready to join
                </p>
                <p className="text-emerald-400/70 text-xs">
                  Logged in as {user.email}
                </p>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="p-6 pt-0 flex gap-3">
          <Button
            variant="ghost"
            onClick={() => router.push('/')}
            className="flex-1 text-gray-400 hover:text-white hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAccept}
            loading={isAccepting}
            className="flex-1"
          >
            {user ? (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Join Room
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                Login to Join
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
