'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  FolderOpen,
  Save,
  Upload,
  Download,
  Clock,
  Settings,
  Undo,
  Redo,
  Scissors,
  Copy,
  ClipboardPaste,
  CheckSquare,
  Sliders,
  ListMusic,
  Activity,
  MessageSquare,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3X3,
  Plus,
  Youtube,
  Trash2,
  VolumeX,
  Volume2,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Repeat,
  Wand2,
  AudioLines,
  Lightbulb,
  RefreshCw,
  Users,
  UserPlus,
  Crown,
  LogOut,
  Keyboard,
  BookOpen,
  HelpCircle,
  Info,
  ChevronRight,
  Sun,
  Moon,
  Layers,
  Users2,
} from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';
import type { MainViewType } from './main-view-switcher';

interface MenuItem {
  label: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action?: () => void;
  disabled?: boolean;
  divider?: boolean;
  submenu?: MenuItem[];
}

interface MenuBarProps {
  onNewSession?: () => void;
  onExportSession?: () => void;
  onSaveToCloud?: () => void;
  onImportProject?: () => void;
  onPreferences?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onTogglePanel?: (panel: string) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onAddBackingTrack?: () => void;
  onUploadAudio?: () => void;
  onYouTubeImport?: () => void;
  onRemoveTrack?: () => void;
  onSoloAllOff?: () => void;
  onMuteAll?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
  onToggleLoop?: () => void;
  onGenerateTrack?: () => void;
  onSeparateStems?: () => void;
  onAISuggestions?: () => void;
  onRemixTrack?: () => void;
  onInviteUsers?: () => void;
  onRoomSettings?: () => void;
  onLeaveRoom?: () => void;
  onTransferMaster?: () => void;
  onShowShortcuts?: () => void;
  onShowDocs?: () => void;
  onShowAbout?: () => void;
  isPlaying?: boolean;
  isMaster?: boolean;
  loopEnabled?: boolean;
  activePanel?: string;
  // Main view props
  mainView?: MainViewType;
  onViewChange?: (view: MainViewType) => void;
}

export function MenuBar({
  onNewSession,
  onExportSession,
  onSaveToCloud,
  onImportProject,
  onPreferences,
  onUndo,
  onRedo,
  onTogglePanel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onAddBackingTrack,
  onUploadAudio,
  onYouTubeImport,
  onRemoveTrack,
  onSoloAllOff,
  onMuteAll,
  onPlay,
  onPause,
  onStop,
  onSeekStart,
  onSeekEnd,
  onToggleLoop,
  onGenerateTrack,
  onSeparateStems,
  onAISuggestions,
  onRemixTrack,
  onInviteUsers,
  onRoomSettings,
  onLeaveRoom,
  onTransferMaster,
  onShowShortcuts,
  onShowDocs,
  onShowAbout,
  isPlaying = false,
  isMaster = false,
  loopEnabled = false,
  activePanel = 'mixer',
  mainView = 'timeline',
  onViewChange,
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const menus: { label: string; items: MenuItem[] }[] = [
    {
      label: 'File',
      items: [
        { label: 'New Session', shortcut: '⌘N', icon: <FolderOpen className="w-3.5 h-3.5" />, action: onNewSession },
        { label: 'divider', divider: true },
        { label: 'Import Project...', shortcut: '⌘O', icon: <Upload className="w-3.5 h-3.5" />, action: onImportProject },
        { label: 'Export Session', shortcut: '⌘E', icon: <Download className="w-3.5 h-3.5" />, action: onExportSession },
        { label: 'divider', divider: true },
        { label: 'Save to Cloud', shortcut: '⌘S', icon: <Save className="w-3.5 h-3.5" />, action: onSaveToCloud },
        { label: 'Recent Sessions', icon: <Clock className="w-3.5 h-3.5" />, disabled: true },
        { label: 'divider', divider: true },
        { label: 'Preferences...', shortcut: '⌘,', icon: <Settings className="w-3.5 h-3.5" />, action: onPreferences },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: '⌘Z', icon: <Undo className="w-3.5 h-3.5" />, action: onUndo, disabled: true },
        { label: 'Redo', shortcut: '⇧⌘Z', icon: <Redo className="w-3.5 h-3.5" />, action: onRedo, disabled: true },
        { label: 'divider', divider: true },
        { label: 'Cut', shortcut: '⌘X', icon: <Scissors className="w-3.5 h-3.5" />, disabled: true },
        { label: 'Copy', shortcut: '⌘C', icon: <Copy className="w-3.5 h-3.5" />, disabled: true },
        { label: 'Paste', shortcut: '⌘V', icon: <ClipboardPaste className="w-3.5 h-3.5" />, disabled: true },
        { label: 'divider', divider: true },
        { label: 'Select All', shortcut: '⌘A', icon: <CheckSquare className="w-3.5 h-3.5" />, disabled: true },
      ],
    },
    {
      label: 'View',
      items: [
        { label: mainView === 'timeline' ? '✓ Timeline' : '  Timeline', shortcut: '1', icon: <Layers className="w-3.5 h-3.5" />, action: () => onViewChange?.('timeline') },
        { label: mainView === 'mixer' ? '✓ Mixer' : '  Mixer', shortcut: '2', icon: <Sliders className="w-3.5 h-3.5" />, action: () => onViewChange?.('mixer') },
        { label: mainView === 'avatar-world' ? '✓ World' : '  World', shortcut: '3', icon: <Users2 className="w-3.5 h-3.5" />, action: () => onViewChange?.('avatar-world') },
        { label: 'divider', divider: true },
        { label: 'Analysis Panel', shortcut: 'A', icon: <Activity className="w-3.5 h-3.5" />, action: () => onTogglePanel?.('analysis') },
        { label: 'Chat Panel', shortcut: 'C', icon: <MessageSquare className="w-3.5 h-3.5" />, action: () => onTogglePanel?.('chat') },
        { label: 'AI Panel', shortcut: 'I', icon: <Sparkles className="w-3.5 h-3.5" />, action: () => onTogglePanel?.('ai') },
        { label: 'divider', divider: true },
        { label: 'Zoom In', shortcut: '⌘+', icon: <ZoomIn className="w-3.5 h-3.5" />, action: onZoomIn },
        { label: 'Zoom Out', shortcut: '⌘-', icon: <ZoomOut className="w-3.5 h-3.5" />, action: onZoomOut },
        { label: 'Reset Zoom', shortcut: '⌘0', icon: <Maximize2 className="w-3.5 h-3.5" />, action: onResetZoom },
      ],
    },
    {
      label: 'Tracks',
      items: [
        { label: 'Add Backing Track...', icon: <Plus className="w-3.5 h-3.5" />, action: onAddBackingTrack },
        { label: 'Upload Audio...', shortcut: '⌘U', icon: <Upload className="w-3.5 h-3.5" />, action: onUploadAudio },
        { label: 'YouTube Import...', shortcut: '⌘Y', icon: <Youtube className="w-3.5 h-3.5" />, action: onYouTubeImport },
        { label: 'divider', divider: true },
        { label: 'Remove Track', shortcut: '⌫', icon: <Trash2 className="w-3.5 h-3.5" />, action: onRemoveTrack, disabled: true },
        { label: 'divider', divider: true },
        { label: 'Solo All Off', icon: <Volume2 className="w-3.5 h-3.5" />, action: onSoloAllOff },
        { label: 'Mute All', icon: <VolumeX className="w-3.5 h-3.5" />, action: onMuteAll },
      ],
    },
    {
      label: 'Playback',
      items: [
        { label: isPlaying ? 'Pause' : 'Play', shortcut: 'Space', icon: isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />, action: isPlaying ? onPause : onPlay, disabled: !isMaster },
        { label: 'Stop', icon: <Square className="w-3.5 h-3.5" />, action: onStop, disabled: !isMaster },
        { label: 'divider', divider: true },
        { label: 'Seek to Start', shortcut: 'Home', icon: <SkipBack className="w-3.5 h-3.5" />, action: onSeekStart, disabled: !isMaster },
        { label: 'Seek to End', shortcut: 'End', icon: <SkipForward className="w-3.5 h-3.5" />, action: onSeekEnd, disabled: !isMaster },
        { label: 'divider', divider: true },
        { label: loopEnabled ? 'Disable Loop' : 'Enable Loop', shortcut: 'L', icon: <Repeat className="w-3.5 h-3.5" />, action: onToggleLoop },
      ],
    },
    {
      label: 'AI',
      items: [
        { label: 'Generate Track...', shortcut: '⌘G', icon: <Wand2 className="w-3.5 h-3.5" />, action: onGenerateTrack },
        { label: 'Separate Stems', icon: <AudioLines className="w-3.5 h-3.5" />, action: onSeparateStems },
        { label: 'divider', divider: true },
        { label: 'AI Suggestions', icon: <Lightbulb className="w-3.5 h-3.5" />, action: onAISuggestions, disabled: true },
        { label: 'Remix Track...', icon: <RefreshCw className="w-3.5 h-3.5" />, action: onRemixTrack, disabled: true },
      ],
    },
    {
      label: 'Room',
      items: [
        { label: 'Invite Users...', icon: <UserPlus className="w-3.5 h-3.5" />, action: onInviteUsers },
        { label: 'Room Settings...', icon: <Settings className="w-3.5 h-3.5" />, action: onRoomSettings },
        { label: 'divider', divider: true },
        { label: 'Transfer Master', icon: <Crown className="w-3.5 h-3.5" />, action: onTransferMaster, disabled: !isMaster },
        { label: 'divider', divider: true },
        { label: 'Leave Room', shortcut: '⌘W', icon: <LogOut className="w-3.5 h-3.5" />, action: onLeaveRoom },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Keyboard Shortcuts', shortcut: '?', icon: <Keyboard className="w-3.5 h-3.5" />, action: onShowShortcuts },
        { label: 'Documentation', icon: <BookOpen className="w-3.5 h-3.5" />, action: onShowDocs },
        { label: 'divider', divider: true },
        { label: 'About OpenStudio', icon: <Info className="w-3.5 h-3.5" />, action: onShowAbout },
      ],
    },
  ];

  const handleMenuClick = (menuLabel: string) => {
    setOpenMenu(openMenu === menuLabel ? null : menuLabel);
  };

  const handleMenuHover = (menuLabel: string) => {
    if (openMenu !== null) {
      setOpenMenu(menuLabel);
    }
  };

  const handleItemClick = (item: MenuItem) => {
    if (item.disabled || item.divider) return;
    item.action?.();
    setOpenMenu(null);
  };

  return (
    <div
      ref={menuBarRef}
      className="h-6 bg-gray-100 dark:bg-[#0d0d12] border-b border-gray-200 dark:border-white/5 flex items-center px-2 gap-0 shrink-0 select-none"
    >
      {menus.map((menu) => (
        <div key={menu.label} className="relative">
          <button
            onClick={() => handleMenuClick(menu.label)}
            onMouseEnter={() => handleMenuHover(menu.label)}
            className={cn(
              'px-2.5 py-0.5 text-[11px] font-medium rounded transition-colors',
              openMenu === menu.label
                ? 'bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-200 dark:hover:bg-white/5'
            )}
          >
            {menu.label}
          </button>

          {/* Dropdown */}
          {openMenu === menu.label && (
            <div className="absolute top-full left-0 mt-0.5 min-w-[200px] bg-white dark:bg-[#1a1a22] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl shadow-black/20 dark:shadow-black/50 py-1 z-50">
              {menu.items.map((item, index) =>
                item.divider ? (
                  <div key={`divider-${index}`} className="h-px bg-gray-200 dark:bg-white/5 my-1 mx-2" />
                ) : (
                  <button
                    key={item.label}
                    onClick={() => handleItemClick(item)}
                    disabled={item.disabled}
                    className={cn(
                      'w-full px-3 py-1.5 flex items-center gap-2.5 text-left transition-colors',
                      item.disabled
                        ? 'text-gray-400 dark:text-zinc-600 cursor-not-allowed'
                        : 'text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                    )}
                  >
                    <span className="w-4 flex items-center justify-center text-gray-400 dark:text-zinc-500">
                      {item.icon}
                    </span>
                    <span className="flex-1 text-[11px]">{item.label}</span>
                    {item.shortcut && (
                      <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-mono">
                        {item.shortcut}
                      </span>
                    )}
                    {item.submenu && (
                      <ChevronRight className="w-3 h-3 text-gray-400 dark:text-zinc-500" />
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}

      {/* Right side - theme toggle and keyboard shortcut hint */}
      <div className="flex-1" />
      <button
        onClick={toggleTheme}
        className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
      </button>
      <button
        onClick={onShowShortcuts}
        className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
      >
        <Keyboard className="w-3 h-3" />
        <span>?</span>
      </button>
    </div>
  );
}
