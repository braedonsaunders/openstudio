'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useCanvasStore, type CanvasElement, type CanvasElementType } from '@/stores/canvas-store';
import { useRoomStore } from '@/stores/room-store';
import {
  Image as ImageIcon,
  Type,
  Pencil,
  MousePointer2,
  Move,
  Square,
  Circle,
  ArrowRight,
  Minus,
  Music,
  Trash2,
  Copy,
  Lock,
  Unlock,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Grid3X3,
  Magnet,
  Upload,
  X,
  ChevronDown,
  Layers,
  Eye,
  EyeOff,
  Palette,
  Settings2,
  Download,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface SharedCanvasViewProps {
  isMaster: boolean;
  roomId: string;
}

// ============================================
// Chord Diagram Component
// ============================================

function ChordDiagram({
  chordName,
  frets = [-1, 0, 2, 2, 1, 0], // Default Am chord
  fingers = [0, 0, 2, 3, 1, 0],
  instrument = 'guitar',
  size = 'medium',
  color = '#ffffff',
}: {
  chordName: string;
  frets?: number[];
  fingers?: number[];
  instrument?: 'guitar' | 'ukulele' | 'bass';
  size?: 'small' | 'medium' | 'large';
  color?: string;
}) {
  const stringCount = instrument === 'bass' ? 4 : instrument === 'ukulele' ? 4 : 6;
  const fretCount = 5;

  const sizes = {
    small: { width: 60, height: 80, stringSpacing: 8, fretSpacing: 12 },
    medium: { width: 100, height: 130, stringSpacing: 14, fretSpacing: 20 },
    large: { width: 140, height: 180, stringSpacing: 20, fretSpacing: 28 },
  };

  const s = sizes[size];
  const startX = (s.width - (stringCount - 1) * s.stringSpacing) / 2;
  const startY = 25;

  return (
    <svg width={s.width} height={s.height} viewBox={`0 0 ${s.width} ${s.height}`}>
      {/* Chord name */}
      <text
        x={s.width / 2}
        y={14}
        textAnchor="middle"
        fill={color}
        fontSize={size === 'small' ? 10 : size === 'medium' ? 14 : 18}
        fontWeight="bold"
        fontFamily="system-ui"
      >
        {chordName}
      </text>

      {/* Nut (top bar) */}
      <rect
        x={startX - 2}
        y={startY}
        width={(stringCount - 1) * s.stringSpacing + 4}
        height={3}
        fill={color}
      />

      {/* Frets */}
      {Array.from({ length: fretCount }).map((_, i) => (
        <line
          key={`fret-${i}`}
          x1={startX}
          y1={startY + (i + 1) * s.fretSpacing}
          x2={startX + (stringCount - 1) * s.stringSpacing}
          y2={startY + (i + 1) * s.fretSpacing}
          stroke={color}
          strokeWidth={1}
          opacity={0.5}
        />
      ))}

      {/* Strings */}
      {Array.from({ length: stringCount }).map((_, i) => (
        <line
          key={`string-${i}`}
          x1={startX + i * s.stringSpacing}
          y1={startY}
          x2={startX + i * s.stringSpacing}
          y2={startY + fretCount * s.fretSpacing}
          stroke={color}
          strokeWidth={i === 0 ? 2 : 1}
          opacity={0.7}
        />
      ))}

      {/* Finger positions */}
      {frets.slice(0, stringCount).map((fret, stringIdx) => {
        const x = startX + stringIdx * s.stringSpacing;

        if (fret === -1) {
          // Muted string (X)
          return (
            <text
              key={`mute-${stringIdx}`}
              x={x}
              y={startY - 5}
              textAnchor="middle"
              fill={color}
              fontSize={size === 'small' ? 8 : 10}
              opacity={0.7}
            >
              ✕
            </text>
          );
        }

        if (fret === 0) {
          // Open string (O)
          return (
            <circle
              key={`open-${stringIdx}`}
              cx={x}
              cy={startY - 6}
              r={size === 'small' ? 3 : 4}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              opacity={0.7}
            />
          );
        }

        // Fretted note
        const y = startY + (fret - 0.5) * s.fretSpacing;
        return (
          <g key={`note-${stringIdx}`}>
            <circle
              cx={x}
              cy={y}
              r={size === 'small' ? 5 : size === 'medium' ? 7 : 9}
              fill={color}
            />
            {fingers[stringIdx] > 0 && (
              <text
                x={x}
                y={y + (size === 'small' ? 3 : 4)}
                textAnchor="middle"
                fill="#000"
                fontSize={size === 'small' ? 7 : size === 'medium' ? 9 : 11}
                fontWeight="bold"
              >
                {fingers[stringIdx]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ============================================
// Canvas Element Renderer
// ============================================

function CanvasElementRenderer({
  element,
  isSelected,
  onSelect,
  onMove,
  onResize,
  onUpdate,
  isEditable,
  zoom,
}: {
  element: CanvasElement;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  onUpdate: (updates: Partial<CanvasElement>) => void;
  isEditable: boolean;
  zoom: number;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editText, setEditText] = useState(element.data.content || '');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  // Update local text when element changes
  useEffect(() => {
    setEditText(element.data.content || '');
  }, [element.data.content]);

  // Focus text input when editing
  useEffect(() => {
    if (isEditingText && textInputRef.current) {
      textInputRef.current.focus();
      textInputRef.current.select();
    }
  }, [isEditingText]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEditable || element.locked || isEditingText) return;
    e.stopPropagation();
    onSelect();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: element.x, y: element.y, w: element.width, h: element.height });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!isEditable || element.locked) return;
    e.stopPropagation();
    if (element.type === 'text') {
      setIsEditingText(true);
    }
  };

  const handleTextBlur = () => {
    if (isEditingText) {
      onUpdate({ data: { ...element.data, content: editText } });
      setIsEditingText(false);
    }
  };

  const handleTextKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditText(element.data.content || '');
      setIsEditingText(false);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onUpdate({ data: { ...element.data, content: editText } });
      setIsEditingText(false);
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!isEditable || element.locked) return;
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: element.x, y: element.y, w: element.width, h: element.height });
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragStart.x) / zoom;
      const dy = (e.clientY - dragStart.y) / zoom;

      if (isDragging) {
        onMove(elementStart.x + dx, elementStart.y + dy);
      } else if (isResizing) {
        onResize(elementStart.w + dx, elementStart.h + dy);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, elementStart, zoom, onMove, onResize]);

  const renderContent = () => {
    switch (element.type) {
      case 'image':
        return (
          <img
            src={element.data.src}
            alt={element.data.alt || 'Canvas image'}
            className="w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        );

      case 'text':
        if (isEditingText) {
          return (
            <textarea
              ref={textInputRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleTextBlur}
              onKeyDown={handleTextKeyDown}
              className="w-full h-full p-2 bg-transparent border-none outline-none resize-none"
              style={{
                fontSize: element.data.fontSize || 16,
                fontFamily: element.data.fontFamily || 'inherit',
                color: element.data.color || '#ffffff',
                fontWeight: element.data.bold ? 'bold' : 'normal',
                fontStyle: element.data.italic ? 'italic' : 'normal',
              }}
            />
          );
        }
        return (
          <div
            className="w-full h-full flex items-center justify-center p-2 overflow-hidden cursor-text"
            style={{
              fontSize: element.data.fontSize || 16,
              fontFamily: element.data.fontFamily || 'inherit',
              color: element.data.color || '#ffffff',
              fontWeight: element.data.bold ? 'bold' : 'normal',
              fontStyle: element.data.italic ? 'italic' : 'normal',
            }}
          >
            {element.data.content || 'Double-click to edit'}
          </div>
        );

      case 'chord-diagram':
        return (
          <div className="w-full h-full flex items-center justify-center">
            <ChordDiagram
              chordName={element.data.chordName || 'Am'}
              frets={element.data.chordFrets}
              fingers={element.data.chordFingers}
              instrument={element.data.instrument || 'guitar'}
              size="medium"
              color={element.data.color || '#ffffff'}
            />
          </div>
        );

      case 'shape':
        const { shapeType, strokeColor, fillColor, strokeWidth } = element.data;
        if (shapeType === 'rectangle') {
          return (
            <div
              className="w-full h-full"
              style={{
                backgroundColor: fillColor || 'transparent',
                border: `${strokeWidth || 2}px solid ${strokeColor || '#ffffff'}`,
              }}
            />
          );
        }
        if (shapeType === 'circle') {
          return (
            <div
              className="w-full h-full rounded-full"
              style={{
                backgroundColor: fillColor || 'transparent',
                border: `${strokeWidth || 2}px solid ${strokeColor || '#ffffff'}`,
              }}
            />
          );
        }
        if (shapeType === 'line') {
          return (
            <svg className="w-full h-full" style={{ overflow: 'visible' }}>
              <line
                x1="0"
                y1="50%"
                x2="100%"
                y2="50%"
                stroke={strokeColor || '#ffffff'}
                strokeWidth={strokeWidth || 2}
              />
            </svg>
          );
        }
        if (shapeType === 'arrow') {
          return (
            <svg className="w-full h-full" style={{ overflow: 'visible' }}>
              <defs>
                <marker
                  id={`arrow-${element.id}`}
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L9,3 z" fill={strokeColor || '#ffffff'} />
                </marker>
              </defs>
              <line
                x1="0"
                y1="50%"
                x2="90%"
                y2="50%"
                stroke={strokeColor || '#ffffff'}
                strokeWidth={strokeWidth || 2}
                markerEnd={`url(#arrow-${element.id})`}
              />
            </svg>
          );
        }
        return null;

      case 'drawing':
        if (!element.data.points || element.data.points.length < 2) return null;
        const pathData = element.data.points.reduce((acc, point, i) => {
          return acc + (i === 0 ? `M ${point.x} ${point.y}` : ` L ${point.x} ${point.y}`);
        }, '');
        return (
          <svg className="w-full h-full" style={{ overflow: 'visible' }}>
            <path
              d={pathData}
              stroke={element.data.color || '#ffffff'}
              strokeWidth={element.data.strokeWidth || 2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      default:
        return <div className="w-full h-full bg-gray-500/20" />;
    }
  };

  return (
    <div
      className={cn(
        'absolute transition-shadow',
        isEditingText ? 'cursor-text' : 'cursor-move',
        isSelected && 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-transparent',
        element.locked && 'cursor-not-allowed opacity-70'
      )}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        transform: `rotate(${element.rotation}deg)`,
        zIndex: element.zIndex,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {renderContent()}

      {/* Resize handle */}
      {isSelected && isEditable && !element.locked && !isEditingText && (
        <div
          className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-indigo-500 rounded-sm cursor-se-resize"
          onMouseDown={handleResizeMouseDown}
        />
      )}

      {/* Lock indicator */}
      {element.locked && (
        <div className="absolute top-1 right-1">
          <Lock className="w-3 h-3 text-white/60" />
        </div>
      )}
    </div>
  );
}

// ============================================
// Toolbar Components
// ============================================

function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
  disabled,
}: {
  icon: typeof MousePointer2;
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        'p-1.5 rounded-md transition-colors',
        active
          ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/50'
          : 'text-zinc-400 hover:bg-white/5 hover:text-white',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const colors = [
    '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
  ];

  return (
    <div className="flex gap-1 flex-wrap max-w-[120px]">
      {colors.map((color) => (
        <button
          key={color}
          onClick={() => onChange(color)}
          className={cn(
            'w-5 h-5 rounded-sm transition-transform',
            value === color && 'ring-2 ring-white ring-offset-1 ring-offset-zinc-900 scale-110'
          )}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function SharedCanvasView({ isMaster, roomId }: SharedCanvasViewProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showChordPicker, setShowChordPicker] = useState(false);

  // Store state
  const {
    elements,
    selectedElementId,
    zoom,
    panX,
    panY,
    gridEnabled,
    snapToGrid,
    activeTool,
    drawingColor,
    isEditable,
    addElement,
    updateElement,
    removeElement,
    selectElement,
    moveElement,
    resizeElement,
    bringToFront,
    sendToBack,
    lockElement,
    duplicateElement,
    setZoom,
    setPan,
    resetView,
    setGridEnabled,
    setSnapToGrid,
    setActiveTool,
    setDrawingColor,
    setEditable,
    getElementsArray,
    clearCanvas,
  } = useCanvasStore();

  const elementsArray = getElementsArray();
  const selectedElement = selectedElementId ? elements.get(selectedElementId) : null;

  // Set editability based on master status
  useEffect(() => {
    setEditable(isMaster);
  }, [isMaster, setEditable]);

  // Load canvas data from room on mount
  const { loadFromRoom, setRoomContext } = useCanvasStore();

  useEffect(() => {
    if (roomId) {
      setRoomContext(roomId);
      loadFromRoom(roomId);
    }
  }, [roomId, setRoomContext, loadFromRoom]);

  // Handle canvas click (deselect)
  const handleCanvasClick = () => {
    if (activeTool === 'select') {
      selectElement(null);
    }
  };

  // Handle panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'pan' || e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
    }
  };

  useEffect(() => {
    if (!isPanning) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPan(e.clientX - panStart.x, e.clientY - panStart.y);
    };

    const handleMouseUp = () => {
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, panStart, setPan]);

  // Handle zoom with wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(zoom + delta);
    }
  }, [zoom, setZoom]);

  // Handle image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      addElement({
        type: 'image',
        x: 100 + Math.random() * 100,
        y: 100 + Math.random() * 100,
        width: 200,
        height: 150,
        rotation: 0,
        locked: false,
        createdBy: 'current-user', // TODO: Get from auth
        data: { src, alt: file.name },
      });
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  }, [addElement]);

  // Add text element
  const handleAddText = useCallback(() => {
    addElement({
      type: 'text',
      x: 100 + Math.random() * 100,
      y: 100 + Math.random() * 100,
      width: 150,
      height: 50,
      rotation: 0,
      locked: false,
      createdBy: 'current-user',
      data: {
        content: 'Text',
        fontSize: 18,
        color: drawingColor,
        bold: false,
        italic: false,
      },
    });
  }, [addElement, drawingColor]);

  // Add chord diagram
  const handleAddChord = useCallback((chordName: string, frets: number[], fingers: number[]) => {
    addElement({
      type: 'chord-diagram',
      x: 100 + Math.random() * 100,
      y: 100 + Math.random() * 100,
      width: 120,
      height: 150,
      rotation: 0,
      locked: false,
      createdBy: 'current-user',
      data: {
        chordName,
        chordFrets: frets,
        chordFingers: fingers,
        instrument: 'guitar',
        color: drawingColor,
      },
    });
    setShowChordPicker(false);
  }, [addElement, drawingColor]);

  // Add shape
  const handleAddShape = useCallback((shapeType: 'rectangle' | 'circle' | 'arrow' | 'line') => {
    addElement({
      type: 'shape',
      x: 100 + Math.random() * 100,
      y: 100 + Math.random() * 100,
      width: shapeType === 'line' || shapeType === 'arrow' ? 150 : 100,
      height: shapeType === 'line' || shapeType === 'arrow' ? 4 : 100,
      rotation: 0,
      locked: false,
      createdBy: 'current-user',
      data: {
        shapeType,
        strokeColor: drawingColor,
        fillColor: 'transparent',
        strokeWidth: 2,
      },
    });
  }, [addElement, drawingColor]);

  // Common chord shapes
  const commonChords = [
    { name: 'C', frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
    { name: 'D', frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
    { name: 'E', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
    { name: 'G', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
    { name: 'A', frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
    { name: 'Am', frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
    { name: 'Em', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
    { name: 'Dm', frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
    { name: 'F', frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] },
    { name: 'B7', frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
  ];

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header Toolbar */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-1">
          {/* Tool Selection */}
          <div className="flex items-center gap-0.5 p-0.5 bg-white/5 rounded-lg">
            <ToolButton
              icon={MousePointer2}
              label="Select (V)"
              active={activeTool === 'select'}
              onClick={() => setActiveTool('select')}
            />
            <ToolButton
              icon={Move}
              label="Pan (H)"
              active={activeTool === 'pan'}
              onClick={() => setActiveTool('pan')}
            />
          </div>

          <div className="w-px h-5 bg-zinc-700 mx-1" />

          {/* Add Elements */}
          <div className="flex items-center gap-0.5">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={!isEditable}
              />
              <div className={cn(
                'p-1.5 rounded-md transition-colors',
                isEditable
                  ? 'text-zinc-400 hover:bg-white/5 hover:text-white'
                  : 'text-zinc-600 cursor-not-allowed'
              )}>
                <ImageIcon className="w-4 h-4" />
              </div>
            </label>
            <ToolButton
              icon={Type}
              label="Add Text"
              onClick={handleAddText}
              disabled={!isEditable}
            />
            <div className="relative">
              <ToolButton
                icon={Music}
                label="Add Chord"
                active={showChordPicker}
                onClick={() => setShowChordPicker(!showChordPicker)}
                disabled={!isEditable}
              />
              <AnimatePresence>
                {showChordPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute top-full left-0 mt-1 p-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 min-w-[240px]"
                  >
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Common Chords</div>
                    <div className="grid grid-cols-5 gap-1">
                      {commonChords.map((chord) => (
                        <button
                          key={chord.name}
                          onClick={() => handleAddChord(chord.name, chord.frets, chord.fingers)}
                          className="p-1.5 text-xs font-medium text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
                        >
                          {chord.name}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="w-px h-5 bg-zinc-700 mx-1" />

          {/* Shapes */}
          <div className="flex items-center gap-0.5">
            <ToolButton
              icon={Square}
              label="Rectangle"
              onClick={() => handleAddShape('rectangle')}
              disabled={!isEditable}
            />
            <ToolButton
              icon={Circle}
              label="Circle"
              onClick={() => handleAddShape('circle')}
              disabled={!isEditable}
            />
            <ToolButton
              icon={ArrowRight}
              label="Arrow"
              onClick={() => handleAddShape('arrow')}
              disabled={!isEditable}
            />
            <ToolButton
              icon={Minus}
              label="Line"
              onClick={() => handleAddShape('line')}
              disabled={!isEditable}
            />
          </div>

          <div className="w-px h-5 bg-zinc-700 mx-1" />

          {/* Color */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center gap-1 p-1 rounded-md hover:bg-white/5"
            >
              <div
                className="w-4 h-4 rounded-sm border border-white/20"
                style={{ backgroundColor: drawingColor }}
              />
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>
            <AnimatePresence>
              {showColorPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute top-full left-0 mt-1 p-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50"
                >
                  <ColorPicker value={drawingColor} onChange={(c) => { setDrawingColor(c); setShowColorPicker(false); }} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Controls */}
          <div className="flex items-center gap-0.5">
            <ToolButton
              icon={Grid3X3}
              label="Toggle Grid"
              active={gridEnabled}
              onClick={() => setGridEnabled(!gridEnabled)}
            />
            <ToolButton
              icon={Magnet}
              label="Snap to Grid"
              active={snapToGrid}
              onClick={() => setSnapToGrid(!snapToGrid)}
            />
          </div>

          <div className="w-px h-5 bg-zinc-700" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <ToolButton icon={ZoomOut} label="Zoom Out" onClick={() => setZoom(zoom - 0.1)} />
            <span className="text-[10px] text-zinc-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <ToolButton icon={ZoomIn} label="Zoom In" onClick={() => setZoom(zoom + 0.1)} />
            <ToolButton icon={RotateCcw} label="Reset View" onClick={resetView} />
          </div>

          {/* Master indicator */}
          {!isMaster && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
              <Eye className="w-3 h-3 text-amber-400" />
              <span className="text-[9px] text-amber-400 font-medium">View Only</span>
            </div>
          )}
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={canvasRef}
        className={cn(
          'flex-1 relative overflow-hidden',
          activeTool === 'pan' && 'cursor-grab',
          isPanning && 'cursor-grabbing',
          gridEnabled && 'bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]'
        )}
        onClick={handleCanvasClick}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
      >
        {/* Transform container */}
        <div
          className="absolute inset-0 origin-top-left"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          }}
        >
          {/* Render elements */}
          {elementsArray.map((element) => (
            <CanvasElementRenderer
              key={element.id}
              element={element}
              isSelected={selectedElementId === element.id}
              onSelect={() => selectElement(element.id)}
              onMove={(x, y) => moveElement(element.id, x, y)}
              onResize={(w, h) => resizeElement(element.id, w, h)}
              onUpdate={(updates) => updateElement(element.id, updates)}
              isEditable={isEditable}
              zoom={zoom}
            />
          ))}

          {/* Empty state */}
          {elementsArray.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-zinc-600">
                <Layers className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Empty Canvas</p>
                <p className="text-xs mt-1 opacity-60">
                  {isEditable
                    ? 'Upload an image or add elements to get started'
                    : 'Waiting for the room owner to add content'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selection Toolbar (bottom) */}
      <AnimatePresence>
        {selectedElement && isEditable && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1.5 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl"
          >
            <ToolButton
              icon={selectedElement.locked ? Unlock : Lock}
              label={selectedElement.locked ? 'Unlock' : 'Lock'}
              onClick={() => lockElement(selectedElement.id, !selectedElement.locked)}
            />
            <div className="w-px h-5 bg-zinc-700" />
            <ToolButton
              icon={Copy}
              label="Duplicate"
              onClick={() => duplicateElement(selectedElement.id)}
            />
            <ToolButton
              icon={Layers}
              label="Bring to Front"
              onClick={() => bringToFront(selectedElement.id)}
            />
            <div className="w-px h-5 bg-zinc-700" />
            <ToolButton
              icon={Trash2}
              label="Delete"
              onClick={() => removeElement(selectedElement.id)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
