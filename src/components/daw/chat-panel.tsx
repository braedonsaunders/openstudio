'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room-store';
import { useAuthStore } from '@/stores/auth-store';
import { saveChatMessage, getRoomChatMessages } from '@/lib/supabase/auth';
import { AvatarDisplay } from '@/components/avatar/AvatarDisplay';
import { REACTION_TYPES, type ReactionType } from '@/types/user';
import { Send, MessageSquare, Smile, Flame, Heart, Sparkles } from 'lucide-react';

interface ChatPanelProps {
  roomId: string;
  onSendMessage: (message: string) => void;
  onSendReaction?: (userId: string, reactionType: ReactionType) => void;
}

export function ChatPanel({ roomId, onSendMessage, onSendReaction }: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const trimmedMessage = message.trim();
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
      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-500">No messages yet</p>
              <p className="text-xs text-zinc-600 mt-1">Start the conversation!</p>
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
                    <span className="text-[11px] text-zinc-600 italic">{msg.content}</span>
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
                        isOwnMessage ? 'text-indigo-400' : 'text-zinc-400'
                      )}>
                        {isOwnMessage ? 'You' : msg.userName}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'px-3 py-2 rounded-xl text-sm',
                        isOwnMessage
                          ? 'bg-indigo-500/20 text-white rounded-tr-sm'
                          : 'glass-panel text-zinc-200 rounded-tl-sm'
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-white/5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
          <button
            type="submit"
            disabled={!message.trim()}
            className={cn(
              'p-2.5 rounded-xl transition-all',
              message.trim()
                ? 'neon-button text-white'
                : 'bg-white/5 text-zinc-600 cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
