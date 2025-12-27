'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { SavedRoom } from '@/types/user';
import { ChevronDown, ChevronUp, Edit2, Save, X, Users, Music, Shield } from 'lucide-react';

interface RoomDescriptionProps {
  room: SavedRoom;
  isOwner?: boolean;
  onUpdate?: (description: string) => Promise<void>;
  collapsed?: boolean;
}

export function RoomDescription({
  room,
  isOwner = false,
  onUpdate,
  collapsed = true,
}: RoomDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(!collapsed);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(room.description);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!onUpdate) return;
    setIsSaving(true);
    try {
      await onUpdate(editContent);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save description:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditContent(room.description);
    setIsEditing(false);
  };

  if (!room.description && !isOwner) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Music className="w-5 h-5 text-indigo-500" />
          <span className="font-medium text-white">{room.name}</span>
          {room.genre && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
              {room.genre}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <Users className="w-4 h-4" />
            <span>{room.maxUsers}</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-800">
          {isEditing ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Editing description (Markdown supported)</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCancel}>
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} loading={isSaving}>
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-64 bg-gray-800 border border-gray-700 rounded-lg p-4 text-white font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="# Room Title

Describe your room using **Markdown**!

## What We Play
- Genre 1
- Genre 2

## House Rules
> Be respectful and have fun!

1. Rule one
2. Rule two"
              />
              <p className="text-xs text-gray-500">
                Supports headers, bold, italic, lists, links, blockquotes, and more.
              </p>
            </div>
          ) : (
            <div className="relative">
              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 z-10"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              )}

              {room.description ? (
                <div className="p-4 prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-xl font-bold text-white mb-3">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-base font-medium text-white mt-3 mb-1">{children}</h3>
                      ),
                      p: ({ children }) => (
                        <p className="text-gray-300 mb-2">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside text-gray-300 mb-2 space-y-1">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-inside text-gray-300 mb-2 space-y-1">{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li className="text-gray-300">{children}</li>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-gray-400 my-3">
                          {children}
                        </blockquote>
                      ),
                      code: ({ children }) => (
                        <code className="bg-gray-800 px-1.5 py-0.5 rounded text-indigo-400 text-sm">
                          {children}
                        </code>
                      ),
                      pre: ({ children }) => (
                        <pre className="bg-gray-800 p-4 rounded-lg overflow-x-auto my-3">
                          {children}
                        </pre>
                      ),
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 underline"
                        >
                          {children}
                        </a>
                      ),
                      hr: () => <hr className="border-gray-700 my-4" />,
                      strong: ({ children }) => (
                        <strong className="font-bold text-white">{children}</strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic">{children}</em>
                      ),
                    }}
                  >
                    {room.description}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <p className="mb-3">No room description yet</p>
                  {isOwner && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Add Description
                    </Button>
                  )}
                </div>
              )}

              {/* Room Info Footer */}
              {(room.rules || room.welcomeMessage || room.skillLevel) && (
                <div className="border-t border-gray-800 p-4 space-y-3">
                  {room.welcomeMessage && (
                    <div className="text-sm text-gray-400 italic">
                      {room.welcomeMessage}
                    </div>
                  )}
                  {room.skillLevel && (
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-400 capitalize">
                        Skill Level: {room.skillLevel}
                      </span>
                    </div>
                  )}
                  {room.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {room.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// Preview component for room cards
export function RoomDescriptionPreview({ description, maxLength = 150 }: { description: string; maxLength?: number }) {
  // Strip markdown and truncate
  const plainText = description
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/>/g, '')
    .replace(/\n+/g, ' ')
    .trim();

  const truncated = plainText.length > maxLength
    ? plainText.slice(0, maxLength) + '...'
    : plainText;

  return <p className="text-sm text-gray-400">{truncated}</p>;
}
