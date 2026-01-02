'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// Canvas element types
export type CanvasElementType = 'image' | 'text' | 'shape' | 'drawing' | 'chord-diagram' | 'annotation';

export interface CanvasElement {
  id: string;
  type: CanvasElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  createdBy: string;
  createdAt: number;
  // Type-specific data
  data: {
    // Image
    src?: string;
    alt?: string;
    // Text
    content?: string;
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    bold?: boolean;
    italic?: boolean;
    // Shape
    shapeType?: 'rectangle' | 'circle' | 'arrow' | 'line';
    strokeColor?: string;
    fillColor?: string;
    strokeWidth?: number;
    // Drawing (freehand)
    points?: { x: number; y: number }[];
    // Chord diagram
    chordName?: string;
    chordFrets?: number[];
    chordFingers?: number[];
    instrument?: 'guitar' | 'ukulele' | 'bass';
  };
}

export interface CanvasState {
  // Canvas elements
  elements: Map<string, CanvasElement>;
  selectedElementId: string | null;

  // Canvas settings
  zoom: number;
  panX: number;
  panY: number;
  gridEnabled: boolean;
  snapToGrid: boolean;
  gridSize: number;

  // Tool state
  activeTool: 'select' | 'pan' | 'draw' | 'text' | 'shape' | 'chord';
  drawingColor: string;
  drawingWidth: number;

  // Permission state
  isEditable: boolean; // Only room owner can edit by default

  // Sync state
  lastSyncedAt: number | null;
  isSyncing: boolean;

  // Actions
  addElement: (element: Omit<CanvasElement, 'id' | 'createdAt' | 'zIndex'>) => string;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  removeElement: (id: string) => void;
  selectElement: (id: string | null) => void;
  moveElement: (id: string, x: number, y: number) => void;
  resizeElement: (id: string, width: number, height: number) => void;
  rotateElement: (id: string, rotation: number) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  lockElement: (id: string, locked: boolean) => void;

  // Canvas actions
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  resetView: () => void;
  setGridEnabled: (enabled: boolean) => void;
  setSnapToGrid: (enabled: boolean) => void;

  // Tool actions
  setActiveTool: (tool: CanvasState['activeTool']) => void;
  setDrawingColor: (color: string) => void;
  setDrawingWidth: (width: number) => void;

  // Permission actions
  setEditable: (editable: boolean) => void;

  // Sync actions
  syncFromRemote: (elements: CanvasElement[]) => void;
  markSynced: () => void;

  // Bulk actions
  clearCanvas: () => void;
  duplicateElement: (id: string) => string | null;
  getElementsArray: () => CanvasElement[];
}

function generateId(): string {
  return `canvas-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useCanvasStore = create<CanvasState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    elements: new Map(),
    selectedElementId: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    gridEnabled: false,
    snapToGrid: false,
    gridSize: 20,
    activeTool: 'select',
    drawingColor: '#ffffff',
    drawingWidth: 2,
    isEditable: true,
    lastSyncedAt: null,
    isSyncing: false,

    // Element actions
    addElement: (element) => {
      const id = generateId();
      const elements = get().elements;
      const maxZIndex = Math.max(0, ...Array.from(elements.values()).map(e => e.zIndex));

      const newElement: CanvasElement = {
        ...element,
        id,
        createdAt: Date.now(),
        zIndex: maxZIndex + 1,
      };

      set((state) => {
        const newElements = new Map(state.elements);
        newElements.set(id, newElement);
        return { elements: newElements };
      });

      return id;
    },

    updateElement: (id, updates) => {
      set((state) => {
        const element = state.elements.get(id);
        if (!element) return state;

        const newElements = new Map(state.elements);
        newElements.set(id, { ...element, ...updates });
        return { elements: newElements };
      });
    },

    removeElement: (id) => {
      set((state) => {
        const newElements = new Map(state.elements);
        newElements.delete(id);
        return {
          elements: newElements,
          selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
        };
      });
    },

    selectElement: (id) => {
      set({ selectedElementId: id });
    },

    moveElement: (id, x, y) => {
      const state = get();
      const element = state.elements.get(id);
      if (!element || element.locked) return;

      let finalX = x;
      let finalY = y;

      if (state.snapToGrid) {
        finalX = Math.round(x / state.gridSize) * state.gridSize;
        finalY = Math.round(y / state.gridSize) * state.gridSize;
      }

      get().updateElement(id, { x: finalX, y: finalY });
    },

    resizeElement: (id, width, height) => {
      const element = get().elements.get(id);
      if (!element || element.locked) return;
      get().updateElement(id, { width: Math.max(10, width), height: Math.max(10, height) });
    },

    rotateElement: (id, rotation) => {
      const element = get().elements.get(id);
      if (!element || element.locked) return;
      get().updateElement(id, { rotation: rotation % 360 });
    },

    bringToFront: (id) => {
      const elements = get().elements;
      const maxZIndex = Math.max(0, ...Array.from(elements.values()).map(e => e.zIndex));
      get().updateElement(id, { zIndex: maxZIndex + 1 });
    },

    sendToBack: (id) => {
      const elements = get().elements;
      const minZIndex = Math.min(0, ...Array.from(elements.values()).map(e => e.zIndex));
      get().updateElement(id, { zIndex: minZIndex - 1 });
    },

    lockElement: (id, locked) => {
      get().updateElement(id, { locked });
    },

    // Canvas actions
    setZoom: (zoom) => {
      set({ zoom: Math.max(0.1, Math.min(5, zoom)) });
    },

    setPan: (x, y) => {
      set({ panX: x, panY: y });
    },

    resetView: () => {
      set({ zoom: 1, panX: 0, panY: 0 });
    },

    setGridEnabled: (enabled) => {
      set({ gridEnabled: enabled });
    },

    setSnapToGrid: (enabled) => {
      set({ snapToGrid: enabled });
    },

    // Tool actions
    setActiveTool: (tool) => {
      set({ activeTool: tool, selectedElementId: null });
    },

    setDrawingColor: (color) => {
      set({ drawingColor: color });
    },

    setDrawingWidth: (width) => {
      set({ drawingWidth: Math.max(1, Math.min(20, width)) });
    },

    // Permission actions
    setEditable: (editable) => {
      set({ isEditable: editable });
    },

    // Sync actions
    syncFromRemote: (elements) => {
      set((state) => {
        const newElements = new Map<string, CanvasElement>();
        elements.forEach(e => newElements.set(e.id, e));
        return { elements: newElements, lastSyncedAt: Date.now() };
      });
    },

    markSynced: () => {
      set({ lastSyncedAt: Date.now(), isSyncing: false });
    },

    // Bulk actions
    clearCanvas: () => {
      set({ elements: new Map(), selectedElementId: null });
    },

    duplicateElement: (id) => {
      const element = get().elements.get(id);
      if (!element) return null;

      return get().addElement({
        ...element,
        x: element.x + 20,
        y: element.y + 20,
        locked: false,
      });
    },

    getElementsArray: () => {
      return Array.from(get().elements.values()).sort((a, b) => a.zIndex - b.zIndex);
    },
  }))
);
