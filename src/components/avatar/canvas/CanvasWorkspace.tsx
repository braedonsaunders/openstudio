'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Rect, Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import type {
  CanvasLayer,
  CanvasBackground,
  LayerTransform,
  AvatarComponent,
  AvatarCategory,
} from '@/types/avatar';

const CANVAS_SIZE = 512;

interface CanvasWorkspaceProps {
  layers: CanvasLayer[];
  selectedLayerId: string | null;
  background: CanvasBackground;
  components: Map<string, AvatarComponent>;
  categories: Map<string, AvatarCategory>;
  onSelectLayer: (layerId: string | null) => void;
  onUpdateTransform: (layerId: string, transform: Partial<LayerTransform>) => void;
  onAddAsset: (component: AvatarComponent, category: AvatarCategory, position: { x: number; y: number }) => void;
  stageRef?: React.MutableRefObject<Konva.Stage | null>;
}

export function CanvasWorkspace({
  layers,
  selectedLayerId,
  background,
  components,
  categories,
  onSelectLayer,
  onUpdateTransform,
  onAddAsset,
  stageRef,
}: CanvasWorkspaceProps) {
  const transformerRef = useRef<Konva.Transformer>(null);
  const layerRefs = useRef<Map<string, Konva.Image>>(new Map());
  const internalStageRef = useRef<Konva.Stage>(null);

  // Sort layers by zIndex
  const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

  // Update transformer when selection changes
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    if (selectedLayerId) {
      const node = layerRefs.current.get(selectedLayerId);
      if (node) {
        transformer.nodes([node]);
        transformer.getLayer()?.batchDraw();
      }
    } else {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selectedLayerId, layers]);

  // Handle stage ref
  useEffect(() => {
    if (stageRef && internalStageRef.current) {
      stageRef.current = internalStageRef.current;
    }
  }, [stageRef]);

  // Handle click on stage background
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) {
      onSelectLayer(null);
    }
  };

  // Handle drag over for drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const stage = internalStageRef.current;
    if (!stage) return;

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const { componentId, categoryId } = data;

      const component = components.get(componentId);
      const category = categories.get(categoryId);
      if (!component || !category) return;

      // Calculate drop position relative to stage
      const stageRect = stage.container().getBoundingClientRect();
      const x = e.clientX - stageRect.left - 100; // Center on drop point
      const y = e.clientY - stageRect.top - 100;

      onAddAsset(component, category, { x: Math.max(0, x), y: Math.max(0, y) });
    } catch {
      // Invalid drop data
    }
  };

  return (
    <div
      className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
      style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Checkerboard pattern for transparency */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(45deg, #ccc 25%, transparent 25%),
            linear-gradient(-45deg, #ccc 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #ccc 75%),
            linear-gradient(-45deg, transparent 75%, #ccc 75%)
          `,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          opacity: 0.3,
        }}
      />

      <Stage
        ref={internalStageRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        {/* Background Layer */}
        <Layer>
          {background.type === 'color' && background.value && (
            <Rect
              x={0}
              y={0}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              fill={background.value}
            />
          )}
        </Layer>

        {/* Asset Layers */}
        <Layer>
          {sortedLayers.map((layer) => (
            <CanvasAsset
              key={layer.id}
              layer={layer}
              component={components.get(layer.componentId)}
              isSelected={layer.id === selectedLayerId}
              onSelect={() => onSelectLayer(layer.id)}
              onTransformEnd={(transform) => onUpdateTransform(layer.id, transform)}
              registerRef={(node) => {
                if (node) {
                  layerRefs.current.set(layer.id, node);
                } else {
                  layerRefs.current.delete(layer.id);
                }
              }}
            />
          ))}

          {/* Transformer */}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              // Limit minimum size
              if (newBox.width < 20 || newBox.height < 20) {
                return oldBox;
              }
              return newBox;
            }}
            rotateEnabled={true}
            enabledAnchors={[
              'top-left',
              'top-right',
              'bottom-left',
              'bottom-right',
            ]}
            anchorSize={10}
            anchorCornerRadius={5}
            borderStroke="#6366f1"
            borderStrokeWidth={2}
            anchorStroke="#6366f1"
            anchorFill="#fff"
          />
        </Layer>
      </Stage>
    </div>
  );
}

// Individual canvas asset component
interface CanvasAssetProps {
  layer: CanvasLayer;
  component?: AvatarComponent;
  isSelected: boolean;
  onSelect: () => void;
  onTransformEnd: (transform: Partial<LayerTransform>) => void;
  registerRef: (node: Konva.Image | null) => void;
}

function CanvasAsset({
  layer,
  component,
  isSelected,
  onSelect,
  onTransformEnd,
  registerRef,
}: CanvasAssetProps) {
  const imageRef = useRef<Konva.Image>(null);

  // Get image URL (color variant or base)
  const imageUrl = component
    ? layer.colorVariant && component.colorVariants?.[layer.colorVariant]
      ? component.colorVariants[layer.colorVariant]
      : component.imageUrl
    : '';

  const [image] = useImage(imageUrl, 'anonymous');

  // Register ref
  useEffect(() => {
    registerRef(imageRef.current);
    return () => registerRef(null);
  }, [registerRef]);

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      onTransformEnd({
        x: e.target.x(),
        y: e.target.y(),
      });
    },
    [onTransformEnd]
  );

  const handleTransformEnd = useCallback(() => {
    const node = imageRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale and apply to width/height
    node.scaleX(1);
    node.scaleY(1);

    onTransformEnd({
      x: node.x(),
      y: node.y(),
      width: Math.max(20, node.width() * scaleX),
      height: Math.max(20, node.height() * scaleY),
      rotation: node.rotation(),
    });
  }, [onTransformEnd]);

  if (!image) return null;

  return (
    <KonvaImage
      ref={imageRef}
      image={image}
      x={layer.transform.x}
      y={layer.transform.y}
      width={layer.transform.width}
      height={layer.transform.height}
      rotation={layer.transform.rotation}
      scaleX={layer.transform.flipX ? -1 : 1}
      scaleY={layer.transform.flipY ? -1 : 1}
      offsetX={layer.transform.flipX ? layer.transform.width : 0}
      offsetY={layer.transform.flipY ? layer.transform.height : 0}
      opacity={layer.transform.opacity}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    />
  );
}
