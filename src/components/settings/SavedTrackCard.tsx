'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { InstrumentIcon, InstrumentSelector } from '@/components/ui/instrument-icon';
import { INSTRUMENTS, type SavedTrackPreset } from '@/types/user';
import { useSavedTracksStore } from '@/stores/saved-tracks-store';
import {
  Star,
  Trash2,
  Edit2,
  Copy,
  MoreVertical,
  Volume2,
  VolumeX,
  Mic,
  Music,
  Sliders,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SavedTrackCardProps {
  preset: SavedTrackPreset;
  onEdit?: (preset: SavedTrackPreset) => void;
  showSelection?: boolean;
  isSelected?: boolean;
  onSelect?: (presetId: string) => void;
}

export function SavedTrackCard({
  preset,
  onEdit,
  showSelection = false,
  isSelected = false,
  onSelect,
}: SavedTrackCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const { deletePreset, duplicatePreset, setDefaultPreset } = useSavedTracksStore();

  const instrument = INSTRUMENTS[preset.instrumentId];

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePreset(preset.id);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateName.trim()) return;
    setIsDuplicating(true);
    try {
      await duplicatePreset(preset.id, duplicateName.trim());
      setShowDuplicateModal(false);
      setDuplicateName('');
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleSetDefault = async () => {
    await setDefaultPreset(preset.id);
    setShowMenu(false);
  };

  return (
    <>
      <div
        className={cn(
          'relative group rounded-lg border transition-all',
          'bg-white dark:bg-gray-800',
          isSelected
            ? 'border-indigo-500 ring-2 ring-indigo-500/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        )}
        style={{
          borderLeftWidth: '4px',
          borderLeftColor: preset.color,
        }}
      >
        {/* Selection checkbox */}
        {showSelection && (
          <button
            onClick={() => onSelect?.(preset.id)}
            className={cn(
              'absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all z-10',
              isSelected
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
            )}
          >
            {isSelected && <Check className="w-4 h-4" />}
          </button>
        )}

        {/* Card content */}
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${preset.color}20` }}
              >
                <InstrumentIcon
                  instrumentId={preset.instrumentId}
                  size="lg"
                  className="opacity-80"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900 dark:text-white truncate">
                    {preset.name}
                  </h3>
                  {preset.isDefault && (
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {instrument?.name || preset.instrumentId}
                </p>
              </div>
            </div>

            {/* Menu button */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMenu(!showMenu)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                    <button
                      onClick={() => {
                        onEdit?.(preset);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setDuplicateName(`${preset.name} Copy`);
                        setShowDuplicateModal(true);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </button>
                    {!preset.isDefault && (
                      <button
                        onClick={handleSetDefault}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Star className="w-4 h-4" />
                        Set as Default
                      </button>
                    )}
                    <hr className="my-1 border-gray-200 dark:border-gray-700" />
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          {preset.description && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
              {preset.description}
            </p>
          )}

          {/* Info badges */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              {preset.type === 'audio' ? (
                <Mic className="w-3 h-3" />
              ) : (
                <Music className="w-3 h-3" />
              )}
              {preset.type === 'audio' ? 'Audio' : 'MIDI'}
            </span>

            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              {preset.isMuted ? (
                <VolumeX className="w-3 h-3" />
              ) : (
                <Volume2 className="w-3 h-3" />
              )}
              {Math.round(preset.volume * 100)}%
            </span>

            {preset.activeEffectPreset && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                <Sliders className="w-3 h-3" />
                {preset.activeEffectPreset}
              </span>
            )}

            {preset.useCount > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Used {preset.useCount}x
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Track Preset"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Are you sure you want to delete <strong>{preset.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={isDeleting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Duplicate modal */}
      <Modal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        title="Duplicate Track Preset"
      >
        <div className="space-y-4">
          <Input
            label="New Preset Name"
            value={duplicateName}
            onChange={(e) => setDuplicateName(e.target.value)}
            placeholder="Enter a name for the copy"
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setShowDuplicateModal(false)}
              disabled={isDuplicating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDuplicate}
              loading={isDuplicating}
              disabled={!duplicateName.trim()}
            >
              Duplicate
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

interface SavedTrackEditorProps {
  preset?: SavedTrackPreset;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (preset: SavedTrackPreset) => void;
}

export function SavedTrackEditor({
  preset,
  userId,
  isOpen,
  onClose,
  onSave,
}: SavedTrackEditorProps) {
  const [name, setName] = useState(preset?.name || '');
  const [description, setDescription] = useState(preset?.description || '');
  const [instrumentId, setInstrumentId] = useState(preset?.instrumentId || 'other');
  const [color, setColor] = useState(preset?.color || '#6366f1');
  const [isSaving, setIsSaving] = useState(false);

  const { savePreset, updatePreset } = useSavedTracksStore();

  const colorOptions = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  ];

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      if (preset) {
        // Update existing preset
        await updatePreset(preset.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          instrumentId,
          color,
        });
      } else {
        // Create new preset (basic - full track settings would come from track)
        const newPreset = await savePreset({
          userId,
          name: name.trim(),
          description: description.trim() || undefined,
          type: 'audio',
          instrumentId,
          color,
          volume: 1,
          isMuted: false,
          isSolo: false,
          effects: {},
          isDefault: false,
        });
        onSave?.(newPreset);
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={preset ? 'Edit Track Preset' : 'Create Track Preset'}
    >
      <div className="space-y-6">
        <Input
          label="Preset Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., My Guitar Setup"
        />

        <div>
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this track preset..."
            className="w-full h-20 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            maxLength={200}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
            Track Color
          </label>
          <div className="flex flex-wrap gap-2">
            {colorOptions.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  'w-8 h-8 rounded-full transition-all',
                  color === c ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-900' : ''
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-3">
            Instrument Type
          </label>
          <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <InstrumentSelector
              value={instrumentId}
              onChange={setInstrumentId}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isSaving} disabled={!name.trim()}>
            {preset ? 'Save Changes' : 'Create Preset'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default SavedTrackCard;
