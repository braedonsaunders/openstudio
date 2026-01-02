'use client';

import { useState, useCallback } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRoomInvitations } from '@/hooks/useRoomInvitations';
import {
  UserPlus,
  Mail,
  Link2,
  Copy,
  Check,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

type InviteMethod = 'user' | 'email' | 'link';

export function InviteMemberModal({
  isOpen,
  onClose,
  roomId,
}: InviteMemberModalProps) {
  const [method, setMethod] = useState<InviteMethod>('link');
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [expiresInHours, setExpiresInHours] = useState<number>(24);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { createInvitation } = useRoomInvitations(roomId);

  const handleSubmit = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const input: {
        userId?: string;
        email?: string;
        generateLink?: boolean;
        message?: string;
        expiresInHours?: number;
      } = {
        message: message || undefined,
        expiresInHours: expiresInHours > 0 ? expiresInHours : undefined,
      };

      switch (method) {
        case 'user':
          if (!userId.trim()) {
            setError('Please enter a user ID');
            setIsLoading(false);
            return;
          }
          input.userId = userId.trim();
          break;
        case 'email':
          if (!email.trim() || !email.includes('@')) {
            setError('Please enter a valid email');
            setIsLoading(false);
            return;
          }
          input.email = email.trim();
          break;
        case 'link':
          input.generateLink = true;
          break;
      }

      const result = await createInvitation(input);

      if (result) {
        if (method === 'link' && result.inviteLink) {
          setInviteLink(result.inviteLink);
          setSuccess('Invite link created!');
        } else if (method === 'email') {
          setSuccess(`Invitation sent to ${email}`);
          setEmail('');
        } else if (method === 'user') {
          setSuccess('Invitation sent!');
          setUserId('');
        }
        setMessage('');
      } else {
        setError('Failed to create invitation');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invitation');
    } finally {
      setIsLoading(false);
    }
  }, [method, userId, email, message, expiresInHours, createInvitation]);

  const copyToClipboard = useCallback(() => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [inviteLink]);

  const handleClose = useCallback(() => {
    setUserId('');
    setEmail('');
    setMessage('');
    setError(null);
    setSuccess(null);
    setInviteLink(null);
    onClose();
  }, [onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Invite to Room"
      description="Invite someone to join this private room"
      variant="dark"
    >
      <div className="space-y-6">
        {/* Method Selection */}
        <div className="flex gap-2">
          <button
            onClick={() => setMethod('link')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all',
              method === 'link'
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                : 'border-gray-700 text-gray-400 hover:border-gray-600'
            )}
          >
            <Link2 className="w-4 h-4" />
            <span className="text-sm font-medium">Link</span>
          </button>
          <button
            onClick={() => setMethod('email')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all',
              method === 'email'
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                : 'border-gray-700 text-gray-400 hover:border-gray-600'
            )}
          >
            <Mail className="w-4 h-4" />
            <span className="text-sm font-medium">Email</span>
          </button>
          <button
            onClick={() => setMethod('user')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all',
              method === 'user'
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                : 'border-gray-700 text-gray-400 hover:border-gray-600'
            )}
          >
            <UserPlus className="w-4 h-4" />
            <span className="text-sm font-medium">User ID</span>
          </button>
        </div>

        {/* Input based on method */}
        {method === 'user' && (
          <Input
            label="User ID"
            placeholder="Enter user ID..."
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        )}

        {method === 'email' && (
          <Input
            label="Email Address"
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}

        {/* Message (optional) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-400">
            Message (optional)
          </label>
          <textarea
            className="w-full h-20 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 resize-none"
            placeholder="Add a personal message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {/* Expiration */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-400">
            <Clock className="w-4 h-4" />
            Expires in
          </label>
          <select
            className="w-full h-10 px-4 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            value={expiresInHours}
            onChange={(e) => setExpiresInHours(Number(e.target.value))}
          >
            <option value={0}>Never</option>
            <option value={1}>1 hour</option>
            <option value={24}>24 hours</option>
            <option value={72}>3 days</option>
            <option value={168}>7 days</option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        {/* Generated Link */}
        {inviteLink && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-400">
              Invite Link
            </label>
            <div className="flex gap-2">
              <input
                readOnly
                value={inviteLink}
                className="flex-1 h-10 px-4 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm"
              />
              <Button
                variant="secondary"
                size="icon"
                onClick={copyToClipboard}
                className="bg-gray-700 hover:bg-gray-600 text-white"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={handleClose}
            className="flex-1 text-gray-400 hover:text-white hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={isLoading}
            className="flex-1"
          >
            {method === 'link' ? 'Generate Link' : 'Send Invitation'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
