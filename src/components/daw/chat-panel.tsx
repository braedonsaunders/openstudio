'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room-store';
import { useAuthStore } from '@/stores/auth-store';
import { saveChatMessage, getRoomChatMessages } from '@/lib/supabase/auth';
import { AvatarDisplay } from '@/components/avatar/AvatarDisplay';
import { REACTION_TYPES, type ReactionType } from '@/types/user';
import { Send, MessageSquare, Link2, Video, X, ExternalLink } from 'lucide-react';

interface ChatPanelProps {
  roomId: string;
  onSendMessage: (message: string) => void;
  onSendReaction?: (userId: string, reactionType: ReactionType) => void;
  onStartVideoChat?: () => void;
}

// URL detection regex
const URL_REGEX = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;

// Parse message content and convert URLs to clickable links
function parseMessageContent(content: string): React.ReactNode {
  const parts = content.split(URL_REGEX);

  return parts.map((part, index) => {
    if (URL_REGEX.test(part)) {
      // Reset regex lastIndex
      URL_REGEX.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 underline inline-flex items-center gap-0.5 break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part.length > 50 ? `${part.slice(0, 50)}...` : part}
          <ExternalLink className="w-3 h-3 inline shrink-0" />
        </a>
      );
    }
    return part;
  });
}

export function ChatPanel({ roomId, onSendMessage, onSendReaction, onStartVideoChat }: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const { messages, currentUser, addMessage } = useRoomStore();
  const { profile, avatar, user } = useAuthStore();

  // Load persisted messages on mount
  useEffect(() => {
    async function loadMessages() {
      if (!roomId) return;
      try {
        const persistedMessages = await getRoomChatMessages(roomId);
        // Add persisted messages to store (avoiding duplicates)
        persistedMessages.forEach((msg) => {
          addMessage({
            type: msg.messageType === 'text' ? 'chat' : msg.messageType as 'chat' | 'system' | 'sync' | 'control',
            userId: msg.userId || '',
            userName: msg.user?.displayName,
            content: msg.content,
            timestamp: msg.createdAt,
          });
        });
      } catch (error) {
        console.error('Failed to load chat messages:', error);
      }
    }
    loadMessages();
  }, [roomId, addMessage]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus link input when shown
  useEffect(() => {
    if (showLinkInput && linkInputRef.current) {
      linkInputRef.current.focus();
    }
  }, [showLinkInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    setMessage('');

    // Send to realtime (other users)
    onSendMessage(trimmedMessage);

    // Persist to database if user is authenticated
    if (user && roomId) {
      try {
        await saveChatMessage(roomId, user.id, trimmedMessage, 'text');
      } catch (error) {
        console.error('Failed to persist message:', error);
      }
    }
  };

  const handleShareLink = async () => {
    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl) return;

    // Format message with title if provided
    const trimmedTitle = linkTitle.trim();
    const linkMessage = trimmedTitle
      ? `${trimmedTitle}: ${trimmedUrl}`
      : trimmedUrl;

    // Send to realtime
    onSendMessage(linkMessage);

    // Persist to database if user is authenticated
    if (user && roomId) {
      try {
        await saveChatMessage(roomId, user.id, linkMessage, 'text');
      } catch (error) {
        console.error('Failed to persist link message:', error);
      }
    }

    // Reset state
    setLinkUrl('');
    setLinkTitle('');
    setShowLinkInput(false);
  };

  const handleReaction = async (targetUserId: string, reactionType: ReactionType) => {
    setShowReactions(null);
    onSendReaction?.(targetUserId, reactionType);

    // Persist reaction
    if (user && roomId) {
      try {
        await saveChatMessage(
          roomId,
          user.id,
          REACTION_TYPES[reactionType].emoji,
          'reaction',
          reactionType,
          targetUserId
        );
      } catch (error) {
        console.error('Failed to persist reaction:', error);
      }
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with Video Chat Button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-white/5">
        <span className="text-xs font-medium text-gray-500 dark:text-zinc-500">Chat</span>
        <button
          onClick={onStartVideoChat}
          className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
          title="Start video chat"
        >
          <Video className="w-3.5 h-3.5" />
          <span>Video</span>
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-gray-400 dark:text-zinc-600" />
              </div>
              <p className="text-sm text-gray-500 dark:text-zinc-500">No messages yet</p>
              <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">Start the conversation!</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => {
              const isOwnMessage = msg.userId === currentUser?.id;
              const isSystemMessage = msg.type === 'system';

              if (isSystemMessage) {
                return (
                  <div key={index} className="text-center">
                    <span className="text-[11px] text-gray-400 dark:text-zinc-600 italic">{msg.content}</span>
                  </div>
                );
              }

              return (
                <div
                  key={index}
                  className={cn(
                    'flex gap-2',
                    isOwnMessage && 'flex-row-reverse'
                  )}
                >
                  {/* Avatar */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                    style={{ backgroundColor: msg.userColor || '#6366f1' }}
                  >
                    {msg.userName?.charAt(0).toUpperCase() || '?'}
                  </div>

                  {/* Message Bubble */}
                  <div className={cn('max-w-[75%]', isOwnMessage && 'text-right')}>
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className={cn(
                        'text-xs font-medium',
                        isOwnMessage ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-500 dark:text-zinc-400'
                      )}>
                        {isOwnMessage ? 'You' : msg.userName}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-zinc-600">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'px-3 py-2 rounded-xl text-sm',
                        isOwnMessage
                          ? 'bg-indigo-500/20 text-gray-900 dark:text-white rounded-tr-sm'
                          : 'bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-zinc-200 rounded-tl-sm'
                      )}
                    >
                      {parseMessageContent(msg.content)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Link Input Popup */}
      {showLinkInput && (
        <div className="px-3 py-2 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">Share a link</span>
            <button
              onClick={() => {
                setShowLinkInput(false);
                setLinkUrl('');
                setLinkTitle('');
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
          <input
            ref={linkInputRef}
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-2.5 py-1.5 mb-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
          />
          <input
            type="text"
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full px-2.5 py-1.5 mb-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && linkUrl.trim()) {
                handleShareLink();
              }
            }}
          />
          <button
            onClick={handleShareLink}
            disabled={!linkUrl.trim()}
            className={cn(
              'w-full py-1.5 rounded-lg text-xs font-medium transition-all',
              linkUrl.trim()
                ? 'neon-button text-white'
                : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-zinc-600 cursor-not-allowed'
            )}
          >
            Share Link
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 dark:border-white/5">
        <div className="flex items-center gap-2">
          {/* Share Link Button */}
          <button
            type="button"
            onClick={() => setShowLinkInput(!showLinkInput)}
            className={cn(
              'p-2.5 rounded-xl transition-all',
              showLinkInput
                ? 'bg-indigo-500/20 text-indigo-500 dark:text-indigo-400'
                : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300'
            )}
            title="Share a link"
          >
            <Link2 className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
          <button
            type="submit"
            disabled={!message.trim()}
            className={cn(
              'p-2.5 rounded-xl transition-all',
              message.trim()
                ? 'neon-button text-white'
                : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-zinc-600 cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
