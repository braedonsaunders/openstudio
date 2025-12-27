'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room-store';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Send, MessageCircle } from 'lucide-react';

interface ChatProps {
  onSendMessage: (message: string) => void;
  className?: string;
}

export function Chat({ onSendMessage, className }: ChatProps) {
  const [message, setMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, users, currentUser } = useRoomStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const getUserName = (userId: string) => {
    if (userId === currentUser?.id) return 'You';
    return users.get(userId)?.name || 'Unknown';
  };

  const formatTime = (timestamp: string | number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isExpanded) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsExpanded(true)}
        className={cn('relative', className)}
      >
        <MessageCircle className="w-5 h-5" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full text-xs flex items-center justify-center">
            {messages.length}
          </span>
        )}
      </Button>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col w-80 h-96 bg-gray-900 rounded-xl border border-gray-800 shadow-xl',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-white">Chat</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(false)}
        >
          ×
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((msg, index) => {
            const isOwn = msg.userId === currentUser?.id;
            const isSystem = msg.type === 'system';

            if (isSystem) {
              return (
                <div
                  key={index}
                  className="text-xs text-gray-500 text-center py-1"
                >
                  {msg.content}
                </div>
              );
            }

            return (
              <div
                key={index}
                className={cn(
                  'flex flex-col gap-1',
                  isOwn && 'items-end'
                )}
              >
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{getUserName(msg.userId)}</span>
                  <span>{formatTime(msg.timestamp)}</span>
                </div>
                <div
                  className={cn(
                    'max-w-[80%] px-3 py-2 rounded-lg text-sm',
                    isOwn
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-200'
                  )}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-800">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!message.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
