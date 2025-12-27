'use client';

import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import { Modal } from '../ui/modal';
import {
  Upload,
  Music,
  X,
  FileAudio,
  Check,
  AlertCircle,
} from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, metadata: { name: string; artist?: string }) => Promise<void>;
  className?: string;
}

type UploadState = 'idle' | 'selected' | 'uploading' | 'success' | 'error';

export function UploadModal({ isOpen, onClose, onUpload, className }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [artist, setArtist] = useState('');
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Please select an MP3 or WAV file');
      return;
    }

    // Validate file size (max 50MB)
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File size must be under 50MB');
      return;
    }

    setFile(selectedFile);
    setName(selectedFile.name.replace(/\.[^/.]+$/, ''));
    setUploadState('selected');
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const input = inputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(droppedFile);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file || !name.trim()) return;

    setUploadState('uploading');
    setUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      await onUpload(file, { name: name.trim(), artist: artist.trim() || undefined });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadState('success');

      // Close modal after success
      setTimeout(() => {
        handleReset();
        onClose();
      }, 1500);
    } catch (err) {
      setError((err as Error).message);
      setUploadState('error');
    }
  }, [file, name, artist, onUpload, onClose]);

  const handleReset = useCallback(() => {
    setFile(null);
    setName('');
    setArtist('');
    setUploadState('idle');
    setUploadProgress(0);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Track"
      description="Upload an MP3 or WAV file to add to the queue"
    >
      <div className={cn('space-y-6', className)}>
        {/* File drop zone */}
        {uploadState === 'idle' && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="relative border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-indigo-500 transition-colors cursor-pointer"
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="audio/mpeg,audio/wav,audio/mp3,.mp3,.wav"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="w-12 h-12 mx-auto text-gray-500 mb-4" />
            <p className="text-gray-300 font-medium">
              Drop your audio file here
            </p>
            <p className="text-sm text-gray-500 mt-1">
              or click to browse
            </p>
            <p className="text-xs text-gray-600 mt-4">
              Supports MP3 and WAV (max 50MB)
            </p>
          </div>
        )}

        {/* Selected file */}
        {uploadState === 'selected' && file && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-800 rounded-lg">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                <FileAudio className="w-6 h-6 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{file.name}</p>
                <p className="text-sm text-gray-400">{formatFileSize(file.size)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleReset}
                className="shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <Input
              label="Track Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter track name"
            />

            <Input
              label="Artist (optional)"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Enter artist name"
            />
          </div>
        )}

        {/* Uploading */}
        {uploadState === 'uploading' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                <Upload className="w-6 h-6 text-indigo-500 animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">Uploading...</p>
                <p className="text-sm text-gray-400">{name}</p>
              </div>
            </div>
            <Progress value={uploadProgress} showLabel />
          </div>
        )}

        {/* Success */}
        {uploadState === 'success' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <p className="font-medium text-white">Upload Complete!</p>
            <p className="text-sm text-gray-400 mt-1">
              Track has been added to the queue
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        {uploadState === 'selected' && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!name.trim()}
              className="flex-1"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
