'use client';

import { useReducer, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  CanvasState,
  CanvasAction,
  CanvasData,
  CanvasLayer,
  CanvasBackground,
  LayerTransform,
  AvatarComponent,
  AvatarCategory,
} from '@/types/avatar';

const CANVAS_SIZE = 512;
const MAX_HISTORY = 50;

const DEFAULT_BACKGROUND: CanvasBackground = {
  type: 'transparent',
  value: null,
};

const DEFAULT_STATE: CanvasState = {
  layers: [],
  selectedLayerId: null,
  background: DEFAULT_BACKGROUND,
  zoom: 1,
  showGrid: false,
  history: [],
  historyIndex: -1,
};

function createDefaultTransform(category?: AvatarCategory): LayerTransform {
  // Use category's default position if available, otherwise center
  if (category) {
    return {
      x: category.renderX,
      y: category.renderY,
      width: category.renderWidth,
      height: category.renderHeight,
      rotation: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
    };
  }

  return {
    x: (CANVAS_SIZE - 200) / 2,
    y: (CANVAS_SIZE - 200) / 2,
    width: 200,
    height: 200,
    rotation: 0,
    flipX: false,
    flipY: false,
    opacity: 1,
  };
}

function getCanvasData(state: CanvasState): CanvasData {
  return {
    version: 1,
    layers: state.layers,
    background: state.background,
  };
}

function pushToHistory(state: CanvasState): CanvasState {
  const canvasData = getCanvasData(state);
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(canvasData);

  // Limit history size
  if (newHistory.length > MAX_HISTORY) {
    newHistory.shift();
  }

  return {
    ...state,
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
}

function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case 'ADD_LAYER': {
      const { component, position } = action;
      const newLayer: CanvasLayer = {
        id: uuidv4(),
        componentId: component.id,
        categoryId: component.categoryId,
        transform: {
          x: position?.x ?? (CANVAS_SIZE - 200) / 2,
          y: position?.y ?? (CANVAS_SIZE - 200) / 2,
          width: 200,
          height: 200,
          rotation: 0,
          flipX: false,
          flipY: false,
          opacity: 1,
        },
        zIndex: state.layers.length,
      };

      const newState = {
        ...state,
        layers: [...state.layers, newLayer],
        selectedLayerId: newLayer.id,
      };

      return pushToHistory(newState);
    }

    case 'REMOVE_LAYER': {
      const newLayers = state.layers.filter((l) => l.id !== action.layerId);
      // Recalculate zIndex
      const reindexedLayers = newLayers.map((layer, index) => ({
        ...layer,
        zIndex: index,
      }));

      const newState = {
        ...state,
        layers: reindexedLayers,
        selectedLayerId:
          state.selectedLayerId === action.layerId ? null : state.selectedLayerId,
      };

      return pushToHistory(newState);
    }

    case 'SELECT_LAYER': {
      return {
        ...state,
        selectedLayerId: action.layerId,
      };
    }

    case 'UPDATE_TRANSFORM': {
      const newLayers = state.layers.map((layer) => {
        if (layer.id === action.layerId) {
          return {
            ...layer,
            transform: { ...layer.transform, ...action.transform },
          };
        }
        return layer;
      });

      const newState = {
        ...state,
        layers: newLayers,
      };

      return pushToHistory(newState);
    }

    case 'REORDER_LAYERS': {
      const { fromIndex, toIndex } = action;
      const newLayers = [...state.layers];
      const [movedLayer] = newLayers.splice(fromIndex, 1);
      newLayers.splice(toIndex, 0, movedLayer);

      // Recalculate zIndex
      const reindexedLayers = newLayers.map((layer, index) => ({
        ...layer,
        zIndex: index,
      }));

      const newState = {
        ...state,
        layers: reindexedLayers,
      };

      return pushToHistory(newState);
    }

    case 'SET_COLOR_VARIANT': {
      const newLayers = state.layers.map((layer) => {
        if (layer.id === action.layerId) {
          return { ...layer, colorVariant: action.variant };
        }
        return layer;
      });

      const newState = {
        ...state,
        layers: newLayers,
      };

      return pushToHistory(newState);
    }

    case 'SET_BACKGROUND': {
      const newState = {
        ...state,
        background: action.background,
      };

      return pushToHistory(newState);
    }

    case 'DUPLICATE_LAYER': {
      const layerToDuplicate = state.layers.find((l) => l.id === action.layerId);
      if (!layerToDuplicate) return state;

      const newLayer: CanvasLayer = {
        ...layerToDuplicate,
        id: uuidv4(),
        transform: {
          ...layerToDuplicate.transform,
          x: layerToDuplicate.transform.x + 20,
          y: layerToDuplicate.transform.y + 20,
        },
        zIndex: state.layers.length,
      };

      const newState = {
        ...state,
        layers: [...state.layers, newLayer],
        selectedLayerId: newLayer.id,
      };

      return pushToHistory(newState);
    }

    case 'LOAD_CANVAS': {
      return {
        ...state,
        layers: action.canvasData.layers,
        background: action.canvasData.background,
        selectedLayerId: null,
        history: [action.canvasData],
        historyIndex: 0,
      };
    }

    case 'RESET_CANVAS': {
      const newState = {
        ...DEFAULT_STATE,
        history: [],
        historyIndex: -1,
      };

      return pushToHistory(newState);
    }

    case 'UNDO': {
      if (state.historyIndex <= 0) return state;

      const newIndex = state.historyIndex - 1;
      const prevData = state.history[newIndex];

      return {
        ...state,
        layers: prevData.layers,
        background: prevData.background,
        historyIndex: newIndex,
        selectedLayerId: null,
      };
    }

    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;

      const newIndex = state.historyIndex + 1;
      const nextData = state.history[newIndex];

      return {
        ...state,
        layers: nextData.layers,
        background: nextData.background,
        historyIndex: newIndex,
        selectedLayerId: null,
      };
    }

    default:
      return state;
  }
}

export function useCanvasState(initialCanvasData?: CanvasData) {
  const initialState: CanvasState = initialCanvasData
    ? {
        ...DEFAULT_STATE,
        layers: initialCanvasData.layers,
        background: initialCanvasData.background,
        history: [initialCanvasData],
        historyIndex: 0,
      }
    : DEFAULT_STATE;

  const [state, dispatch] = useReducer(canvasReducer, initialState);

  // Memoized actions
  const addLayer = useCallback(
    (component: AvatarComponent, category?: AvatarCategory, position?: { x: number; y: number }) => {
      // Use category defaults for position if not specified
      const defaultTransform = createDefaultTransform(category);
      dispatch({
        type: 'ADD_LAYER',
        component,
        position: position ?? { x: defaultTransform.x, y: defaultTransform.y },
      });
    },
    []
  );

  const removeLayer = useCallback((layerId: string) => {
    dispatch({ type: 'REMOVE_LAYER', layerId });
  }, []);

  const selectLayer = useCallback((layerId: string | null) => {
    dispatch({ type: 'SELECT_LAYER', layerId });
  }, []);

  const updateTransform = useCallback(
    (layerId: string, transform: Partial<LayerTransform>) => {
      dispatch({ type: 'UPDATE_TRANSFORM', layerId, transform });
    },
    []
  );

  const reorderLayers = useCallback((fromIndex: number, toIndex: number) => {
    dispatch({ type: 'REORDER_LAYERS', fromIndex, toIndex });
  }, []);

  const setColorVariant = useCallback((layerId: string, variant: string) => {
    dispatch({ type: 'SET_COLOR_VARIANT', layerId, variant });
  }, []);

  const setBackground = useCallback((background: CanvasBackground) => {
    dispatch({ type: 'SET_BACKGROUND', background });
  }, []);

  const duplicateLayer = useCallback((layerId: string) => {
    dispatch({ type: 'DUPLICATE_LAYER', layerId });
  }, []);

  const loadCanvas = useCallback((canvasData: CanvasData) => {
    dispatch({ type: 'LOAD_CANVAS', canvasData });
  }, []);

  const resetCanvas = useCallback(() => {
    dispatch({ type: 'RESET_CANVAS' });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  // Computed values
  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  const selectedLayer = useMemo(
    () => state.layers.find((l) => l.id === state.selectedLayerId) ?? null,
    [state.layers, state.selectedLayerId]
  );

  const sortedLayers = useMemo(
    () => [...state.layers].sort((a, b) => a.zIndex - b.zIndex),
    [state.layers]
  );

  const canvasData = useMemo(() => getCanvasData(state), [state.layers, state.background]);

  return {
    // State
    state,
    layers: state.layers,
    sortedLayers,
    selectedLayerId: state.selectedLayerId,
    selectedLayer,
    background: state.background,
    zoom: state.zoom,
    showGrid: state.showGrid,
    canvasData,

    // History
    canUndo,
    canRedo,

    // Actions
    addLayer,
    removeLayer,
    selectLayer,
    updateTransform,
    reorderLayers,
    setColorVariant,
    setBackground,
    duplicateLayer,
    loadCanvas,
    resetCanvas,
    undo,
    redo,
  };
}

export type UseCanvasStateReturn = ReturnType<typeof useCanvasState>;
