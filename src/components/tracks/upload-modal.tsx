'use client';

import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import { Modal } from '../ui/modal';
import {
  Upload,
  X,
  FileAudio,
  Check,
  AlertCircle,
} from 'lucide-react';

interface UploadedTrack {
  id: string;
  name: string;
  artist?: string;
  url: string;
  duration: number;
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (track: UploadedTrack) => Promise<void>;
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
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav', 'audio/webm'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Please select an MP3, WAV, or WebM file');
      return;
    }

    // Validate file size (max 100MB)
    if (selectedFile.size > 100 * 1024 * 1024) {
      setError('File size must be under 100MB');
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
    setError(null);

    try {
      // Calculate duration from the audio file
      const duration = await new Promise<number>((resolve) => {
        const audio = new Audio();
        audio.addEventListener('loadedmetadata', () => {
          resolve(audio.duration || 0);
        });
        audio.addEventListener('error', () => {
          resolve(0); // Fallback to 0 if can't determine
        });
        audio.src = URL.createObjectURL(file);
      });

      // Get presigned URL for direct upload
      const presignResponse = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      if (!presignResponse.ok) {
        const data = await presignResponse.json();
        throw new Error(data.error || 'Failed to get upload URL');
      }

      const { uploadUrl, publicUrl, trackId } = await presignResponse.json();

      // Upload directly to R2 using presigned URL
      const xhr = new XMLHttpRequest();

      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      // Notify parent with track info (no file - already uploaded to R2)
      await onUpload({
        id: trackId,
        name: name.trim(),
        artist: artist.trim() || undefined,
        url: publicUrl,
        duration,
      });

      setUploadProgress(100);
      setUploadState('success');

      // Close modal after success
      setTimeout(() => {
        handleReset();
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Upload error:', err);
      setError((err as Error).message || 'Upload failed. Please try again.');
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
      description="Upload an audio file to add to the queue"
    >
      <div className={cn('space-y-6', className)}>
        {/* File drop zone */}
        {uploadState === 'idle' && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="relative border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors cursor-pointer"
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="audio/mpeg,audio/wav,audio/mp3,audio/webm,.mp3,.wav,.webm"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-700 font-medium">
              Drop your audio file here
            </p>
            <p className="text-sm text-slate-500 mt-1">
              or click to browse
            </p>
            <p className="text-xs text-slate-400 mt-4">
              Supports MP3, WAV, WebM (max 100MB)
            </p>
          </div>
        )}

        {/* Selected file */}
        {uploadState === 'selected' && file && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <FileAudio className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{file.name}</p>
                <p className="text-sm text-slate-500">{formatFileSize(file.size)}</p>
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
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Upload className="w-6 h-6 text-indigo-600 animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900">Uploading...</p>
                <p className="text-sm text-slate-500">{name}</p>
              </div>
            </div>
            <Progress value={uploadProgress} showLabel />
          </div>
        )}

        {/* Success */}
        {uploadState === 'success' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="font-medium text-slate-900">Upload Complete!</p>
            <p className="text-sm text-slate-500 mt-1">
              Track has been added to the queue
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
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
              <Upload className="w-4 h-4" />
              Upload
            </Button>
          </div>
        )}

        {uploadState === 'error' && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Try Again
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
