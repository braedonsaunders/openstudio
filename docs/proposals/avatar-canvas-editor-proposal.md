# Avatar Canvas Editor - System Redesign Proposal

## Executive Summary

This proposal outlines a complete redesign of the avatar customization system, transitioning from **fixed-position category rendering** to a **free-form canvas editor** where users can place, resize, and rotate any unlocked asset freely. The system will generate both full-body and headshot avatar images for use throughout the application.

---

## Current System Analysis

### How It Works Now

1. **Admin-Defined Positioning**: Each category (Hair, Eyes, Face, etc.) has fixed render coordinates:
   ```
   Category: Face → renderX: 128, renderY: 40, renderWidth: 256, renderHeight: 256
   Category: Eyes → renderX: 156, renderY: 120, renderWidth: 200, renderHeight: 60
   ```

2. **User Selection Only**: Users pick ONE component per category, and it renders at the category's predetermined position.

3. **Compositor Logic**: All assets drawn at their category's fixed position, layered by `layerOrder`.

### Problems with Current Approach

| Issue | Impact |
|-------|--------|
| Fixed positions limit creativity | Users can't customize layout |
| One component per category | Can't add multiple accessories |
| No rotation support | All assets face same direction |
| No scaling control | Can't emphasize or minimize elements |
| Rigid structure | Doesn't support artistic expression |

---

## Proposed System: Canvas-Based Avatar Editor

### Core Concept

Transform the avatar editor into a **drag-and-drop canvas** where users freely compose their avatar from unlocked assets, similar to design tools like Canva or Figma.

### Key Features

#### 1. Asset Library Panel
- Browse all unlocked assets across ALL categories
- Filter by category, rarity, color
- Search by name/tags
- Visual grid with thumbnails
- Lock icons for locked assets (with unlock hints)

#### 2. Canvas Workspace
- **Base Canvas**: 512×512 pixels (maintains compatibility)
- **Infinite placement**: Assets can be placed anywhere
- **Layer management**: Drag to reorder layers
- **Visual guides**: Optional grid, snap-to-center

#### 3. Transform Controls (Per Asset)
- **Position**: Drag anywhere on canvas
- **Scale**: Resize handles (maintain aspect ratio option)
- **Rotation**: Rotate handle (0-360°)
- **Flip**: Horizontal/vertical mirror
- **Opacity**: Optional transparency slider

#### 4. Output Generation
- **Full Body**: 512×512 PNG (primary avatar)
- **Headshot**: 256×256 PNG (auto-cropped to upper portion)
- **Thumbnails**: xs(32), sm(48), md(64), lg(128) auto-generated

---

## Technical Architecture

### Database Schema Changes

#### Remove from `avatar_categories`:
```sql
-- REMOVE these columns (no longer needed)
ALTER TABLE avatar_categories
  DROP COLUMN render_x,
  DROP COLUMN render_y,
  DROP COLUMN render_width,
  DROP COLUMN render_height;
```

#### New Table: `user_avatar_canvas`
```sql
CREATE TABLE user_avatar_canvas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  canvas_data JSONB NOT NULL,           -- Full canvas state
  full_body_url TEXT,                    -- Generated 512×512 image
  headshot_url TEXT,                     -- Generated 256×256 headshot
  thumbnail_urls JSONB,                  -- {xs, sm, md, lg} URLs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Canvas data structure
{
  "version": 1,
  "layers": [
    {
      "id": "layer-uuid",
      "componentId": "component-uuid",
      "categoryId": "category-uuid",
      "transform": {
        "x": 128,
        "y": 40,
        "width": 256,
        "height": 256,
        "rotation": 0,
        "flipX": false,
        "flipY": false,
        "opacity": 1
      },
      "colorVariant": "blonde",
      "zIndex": 5
    }
  ],
  "background": {
    "type": "color" | "image" | "transparent",
    "value": "#ffffff" | "component-uuid"
  }
}
```

### Type Definitions

```typescript
// src/types/avatar.ts - New types

interface CanvasLayer {
  id: string
  componentId: string
  categoryId: string
  transform: LayerTransform
  colorVariant?: string
  zIndex: number
}

interface LayerTransform {
  x: number           // Position X (0-512)
  y: number           // Position Y (0-512)
  width: number       // Scaled width
  height: number      // Scaled height
  rotation: number    // Degrees (0-360)
  flipX: boolean      // Horizontal flip
  flipY: boolean      // Vertical flip
  opacity: number     // 0-1
}

interface CanvasBackground {
  type: 'color' | 'image' | 'transparent'
  value: string       // Hex color or component ID
}

interface UserAvatarCanvas {
  id: string
  userId: string
  canvasData: {
    version: number
    layers: CanvasLayer[]
    background: CanvasBackground
  }
  fullBodyUrl: string | null
  headshotUrl: string | null
  thumbnailUrls: {
    xs: string
    sm: string
    md: string
    lg: string
  } | null
  createdAt: Date
  updatedAt: Date
}
```

### Component Architecture

```
src/components/avatar/
├── canvas/
│   ├── AvatarCanvasEditor.tsx      # Main editor component
│   ├── CanvasWorkspace.tsx         # The draggable canvas area
│   ├── AssetLibraryPanel.tsx       # Browse/search assets
│   ├── LayerPanel.tsx              # Layer list & reordering
│   ├── TransformControls.tsx       # Resize/rotate handles
│   ├── ToolBar.tsx                 # Undo, redo, zoom, guides
│   ├── ExportPanel.tsx             # Preview & save
│   └── hooks/
│       ├── useCanvasState.ts       # Canvas state management
│       ├── useLayerTransform.ts    # Transform operations
│       ├── useCanvasHistory.ts     # Undo/redo stack
│       └── useCanvasExport.ts      # Image generation
```

### Canvas Editor Implementation

#### Core State Management
```typescript
// useCanvasState.ts
interface CanvasState {
  layers: CanvasLayer[]
  selectedLayerId: string | null
  background: CanvasBackground
  zoom: number
  showGrid: boolean
}

type CanvasAction =
  | { type: 'ADD_LAYER'; component: AvatarComponent; position?: {x: number, y: number} }
  | { type: 'REMOVE_LAYER'; layerId: string }
  | { type: 'SELECT_LAYER'; layerId: string | null }
  | { type: 'UPDATE_TRANSFORM'; layerId: string; transform: Partial<LayerTransform> }
  | { type: 'REORDER_LAYERS'; fromIndex: number; toIndex: number }
  | { type: 'SET_COLOR_VARIANT'; layerId: string; variant: string }
  | { type: 'SET_BACKGROUND'; background: CanvasBackground }
  | { type: 'DUPLICATE_LAYER'; layerId: string }
```

#### Canvas Rendering (fabric.js or Konva.js)
```typescript
// CanvasWorkspace.tsx - Using Konva.js for React
import { Stage, Layer, Image, Transformer } from 'react-konva'

const CanvasWorkspace: React.FC<Props> = ({ state, dispatch }) => {
  return (
    <Stage width={512} height={512}>
      {/* Background Layer */}
      <Layer>
        <Background config={state.background} />
      </Layer>

      {/* Asset Layers - sorted by zIndex */}
      <Layer>
        {state.layers
          .sort((a, b) => a.zIndex - b.zIndex)
          .map(layer => (
            <CanvasAsset
              key={layer.id}
              layer={layer}
              isSelected={layer.id === state.selectedLayerId}
              onSelect={() => dispatch({ type: 'SELECT_LAYER', layerId: layer.id })}
              onTransform={(transform) =>
                dispatch({ type: 'UPDATE_TRANSFORM', layerId: layer.id, transform })
              }
            />
          ))}
      </Layer>

      {/* Transform handles for selected layer */}
      {state.selectedLayerId && (
        <Transformer ref={transformerRef} />
      )}
    </Stage>
  )
}
```

### Image Export Pipeline

#### Client-Side Generation
```typescript
// useCanvasExport.ts
export function useCanvasExport(stageRef: RefObject<Konva.Stage>) {
  const generateImages = async (): Promise<GeneratedAvatars> => {
    const stage = stageRef.current
    if (!stage) throw new Error('Canvas not ready')

    // Generate full body (512×512)
    const fullBodyDataUrl = stage.toDataURL({
      pixelRatio: 1,
      mimeType: 'image/png'
    })

    // Generate headshot (crop upper 60% and resize to 256×256)
    const headshotDataUrl = await generateHeadshot(stage)

    // Generate thumbnails
    const thumbnails = await generateThumbnails(fullBodyDataUrl)

    return { fullBodyDataUrl, headshotDataUrl, thumbnails }
  }

  const generateHeadshot = async (stage: Konva.Stage): Promise<string> => {
    // Clone stage, crop to upper portion, resize
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')!

    // Draw upper 60% of full body, scaled to 256×256
    const fullImage = await loadImage(stage.toDataURL())
    ctx.drawImage(
      fullImage,
      0, 0, 512, 307,           // Source: top 60%
      0, 0, 256, 256            // Dest: full headshot
    )

    return canvas.toDataURL('image/png')
  }
}
```

#### Server-Side Upload
```typescript
// API: POST /api/avatar/canvas
export async function POST(request: NextRequest) {
  const { canvasData, fullBodyImage, headshotImage, thumbnails } = await request.json()

  // Upload images to R2
  const [fullBodyUrl, headshotUrl, thumbnailUrls] = await Promise.all([
    uploadToR2(`avatars/${userId}/full-body.png`, fullBodyImage),
    uploadToR2(`avatars/${userId}/headshot.png`, headshotImage),
    uploadThumbnails(userId, thumbnails)
  ])

  // Save canvas state to database
  await supabase.from('user_avatar_canvas').upsert({
    user_id: userId,
    canvas_data: canvasData,
    full_body_url: fullBodyUrl,
    headshot_url: headshotUrl,
    thumbnail_urls: thumbnailUrls,
    updated_at: new Date()
  })

  return NextResponse.json({ success: true, fullBodyUrl, headshotUrl })
}
```

---

## User Experience Flow

### Settings → Avatar Section (Rebuilt)

```
┌─────────────────────────────────────────────────────────────────┐
│  Avatar Editor                                          [Save]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌───────────────────────────────────────────┐ │
│  │   Assets    │  │                                           │ │
│  │─────────────│  │                                           │ │
│  │ [Search...] │  │                                           │ │
│  │             │  │              CANVAS                       │ │
│  │ ▼ Hair      │  │             512×512                       │ │
│  │  [🔒][img]  │  │                                           │ │
│  │  [img][img] │  │        ┌─────────────┐                    │ │
│  │             │  │        │  Selected   │ ↻ (rotate handle)  │ │
│  │ ▼ Face      │  │        │   Asset     │                    │ │
│  │  [img][img] │  │        └─────────────┘                    │ │
│  │  [img][img] │  │                                           │ │
│  │             │  │                                           │ │
│  │ ▼ Eyes      │  │                                           │ │
│  │  [img][img] │  │                                           │ │
│  │             │  └───────────────────────────────────────────┘ │
│  │ ▼ Clothes   │                                                │
│  │  [img][img] │  ┌───────────────────────────────────────────┐ │
│  │             │  │ Layers                          [+ Add]   │ │
│  └─────────────┘  │ ☰ Hair Front          [👁] [🎨] [🗑]      │ │
│                   │ ☰ Face                [👁] [🎨] [🗑]      │ │
│                   │ ☰ Eyes                [👁] [🎨] [🗑]      │ │
│                   │ ☰ Body                [👁] [🎨] [🗑]      │ │
│                   │ ☰ Background          [👁] [🎨] [🗑]      │ │
│                   └───────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Transform: X: [128] Y: [40] W: [256] H: [256] R: [0°]      ││
│  │            [Flip H] [Flip V] [Reset] [Delete]              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Interaction Flow

1. **Adding Assets**
   - Click/drag asset from library onto canvas
   - Asset appears at center (or drop position)
   - Automatically selected with transform handles

2. **Transforming Assets**
   - Drag to move
   - Corner handles to resize (Shift = maintain aspect ratio)
   - Top handle to rotate
   - Double-click for precise numeric input

3. **Managing Layers**
   - Drag layers in panel to reorder (z-index)
   - Toggle visibility (👁) for editing
   - Color picker (🎨) for variant selection
   - Delete (🗑) to remove

4. **Saving**
   - Click Save → Loading state
   - Client generates full-body, headshot, thumbnails
   - Uploads to server
   - Success notification with preview

---

## Migration Strategy

### Phase 1: Database Migration
```sql
-- Add new table
CREATE TABLE user_avatar_canvas (...);

-- Keep old table temporarily for rollback
-- avatar_categories positioning columns remain but unused
```

### Phase 2: Feature Flag Rollout
```typescript
// Enable new editor for beta users
const useNewAvatarEditor = featureFlags.get('avatar_canvas_editor')

// Settings page
{useNewAvatarEditor ? <AvatarCanvasEditor /> : <SpriteAvatarEditor />}
```

### Phase 3: Migration Script
```typescript
// Migrate existing user configs to canvas format
async function migrateUserAvatar(userId: string) {
  const oldConfig = await getUserAvatarConfig(userId)
  const categories = await getCategories()

  // Convert selections to canvas layers using old positions
  const layers = oldConfig.selections.map((selection, index) => {
    const category = categories.find(c => c.id === selection.categoryId)
    return {
      id: generateUUID(),
      componentId: selection.componentId,
      categoryId: selection.categoryId,
      transform: {
        x: category.renderX,      // Use old position as starting point
        y: category.renderY,
        width: category.renderWidth,
        height: category.renderHeight,
        rotation: 0,
        flipX: false,
        flipY: false,
        opacity: 1
      },
      colorVariant: selection.colorVariant,
      zIndex: category.layerOrder
    }
  })

  // Save as new canvas format
  await saveUserAvatarCanvas(userId, { layers, background: { type: 'transparent' } })
}
```

### Phase 4: Cleanup
- Remove old positioning columns from categories
- Remove old user_avatar_configs table (after verification)
- Remove SpriteAvatarEditor component
- Remove old compositor code

---

## Admin Panel Changes

### Simplified Category Manager

**Remove:**
- renderX, renderY, renderWidth, renderHeight inputs
- Position preview visualization

**Keep:**
- Category name, display order
- Color variant support
- Required flag
- Prompt additions for AI generation

**New UI (simplified):**
```
┌─────────────────────────────────────────────────────────────┐
│ Add Category                                                │
├─────────────────────────────────────────────────────────────┤
│ Name:           [Hair Front________________]                │
│ Layer Order:    [5___] (for default suggestions)            │
│ Color Variants: [✓] Enable   Palette: [Hair Colors ▼]      │
│ Required:       [ ] User must select                        │
│ AI Prompt:      [flowing, wavy________________]             │
│                                                             │
│                          [Cancel] [Save]                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Avatar Usage Throughout App

### Where Avatars Are Used

| Location | Size | Type |
|----------|------|------|
| Navigation header | 32×32 | Headshot |
| Profile page | 128×128 | Full body |
| Comments/posts | 48×48 | Headshot |
| Leaderboards | 64×64 | Headshot |
| User cards | 96×96 | Full body |
| Chat messages | 40×40 | Headshot |
| Social sharing | 512×512 | Full body |

### Avatar Component Update
```typescript
// Updated Avatar component
interface AvatarProps {
  userId: string
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
  variant?: 'headshot' | 'fullbody'
}

export function Avatar({ userId, size, variant = 'headshot' }: AvatarProps) {
  const { data: avatarCanvas } = useUserAvatarCanvas(userId)

  const imageUrl = variant === 'headshot'
    ? avatarCanvas?.headshotUrl
    : avatarCanvas?.fullBodyUrl

  const thumbnailUrl = avatarCanvas?.thumbnailUrls?.[size]

  return (
    <img
      src={thumbnailUrl || imageUrl || defaultAvatar}
      className={avatarSizes[size]}
      alt="User avatar"
    />
  )
}
```

---

## Technical Considerations

### Canvas Library Comparison

| Library | Pros | Cons | Recommendation |
|---------|------|------|----------------|
| **Konva.js** | React bindings, good perf, transform controls | Bundle size (~150KB) | ✅ Best for this use case |
| **Fabric.js** | Feature-rich, mature | No native React, complex API | Good alternative |
| **HTML Canvas** | No deps, full control | Manual transform math, more code | Too low-level |
| **react-dnd** | React native | No canvas, DOM-based | Not suitable |

**Recommendation: Konva.js** - Best React integration with built-in Transformer component for resize/rotate handles.

### Performance Optimizations

1. **Image Caching**
   - Pre-load all unlocked assets on editor mount
   - Cache processed images in IndexedDB

2. **Render Optimization**
   - Only re-render changed layers
   - Throttle transform updates (16ms)
   - Use `shouldComponentUpdate` for layer components

3. **Export Optimization**
   - Generate images in Web Worker
   - Progressive upload (thumbnails first)
   - Optimistic UI update

### Security Considerations

1. **Asset Validation**
   - Verify user owns/unlocked assets before saving
   - Server-side validation of canvas data structure
   - Sanitize all input values

2. **Size Limits**
   - Max layers per canvas: 50
   - Max canvas data size: 100KB
   - Rate limit save operations

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Konva.js and canvas infrastructure
- [ ] Create basic canvas workspace component
- [ ] Implement layer state management
- [ ] Add single asset placement and selection

### Phase 2: Transform Controls (Week 2-3)
- [ ] Resize handles with aspect ratio lock
- [ ] Rotation control
- [ ] Flip horizontal/vertical
- [ ] Numeric transform input panel

### Phase 3: Asset Library (Week 3-4)
- [ ] Asset library panel UI
- [ ] Category filtering
- [ ] Search functionality
- [ ] Drag-and-drop to canvas

### Phase 4: Layer Management (Week 4)
- [ ] Layer panel with drag reordering
- [ ] Visibility toggle
- [ ] Color variant selection per layer
- [ ] Duplicate/delete layers

### Phase 5: Export & Save (Week 5)
- [ ] Client-side image generation
- [ ] Headshot cropping algorithm
- [ ] Thumbnail generation
- [ ] Server upload and database save

### Phase 6: Integration (Week 5-6)
- [ ] Update Avatar component app-wide
- [ ] Settings page integration
- [ ] Migration script for existing users
- [ ] Admin panel simplification

### Phase 7: Polish (Week 6)
- [ ] Undo/redo functionality
- [ ] Keyboard shortcuts
- [ ] Touch/mobile support
- [ ] Loading states and error handling

---

## Dependencies

### New Packages
```json
{
  "konva": "^9.3.0",
  "react-konva": "^18.2.10",
  "use-image": "^1.1.1"
}
```

### Removed After Migration
- Old compositor code paths
- Fixed positioning logic
- SpriteAvatarEditor component

---

## Success Metrics

| Metric | Target |
|--------|--------|
| User engagement with editor | +40% time in avatar settings |
| Avatar customization variety | 80% of users use rotation/scaling |
| Save completion rate | >95% successful saves |
| Performance | <100ms transform updates |
| Mobile usability | Touch-friendly, no zoom issues |

---

## Open Questions

1. **Default Templates**: Should we provide pre-made avatar templates users can start from?

2. **Undo History Depth**: How many undo steps to store? (Suggested: 50)

3. **Auto-Save**: Should we auto-save drafts to localStorage?

4. **Collaboration**: Future consideration for sharing avatar designs?

5. **Headshot Cropping**: Fixed upper 60% or smart face detection?

6. **Background Options**: Color picker, gradients, or patterns?

---

## Appendix: Wireframes

### Mobile Layout
```
┌─────────────────────┐
│ Avatar Editor    [×]│
├─────────────────────┤
│ ┌─────────────────┐ │
│ │                 │ │
│ │     CANVAS      │ │
│ │    (300×300)    │ │
│ │                 │ │
│ └─────────────────┘ │
│                     │
│ [Assets] [Layers]   │  ← Tab switcher
├─────────────────────┤
│ ┌───┐┌───┐┌───┐┌───┐│
│ │   ││   ││   ││   ││  ← Scrollable asset grid
│ └───┘└───┘└───┘└───┘│
│ ┌───┐┌───┐┌───┐┌───┐│
│ │   ││   ││   ││   ││
│ └───┘└───┘└───┘└───┘│
├─────────────────────┤
│      [Save Avatar]  │
└─────────────────────┘
```

---

## Conclusion

This redesign transforms the avatar system from a rigid, category-based selector into a creative canvas editor. Users gain full control over asset placement, rotation, and scaling, enabling unique avatar compositions while maintaining the existing asset library and unlock system.

The phased approach ensures backward compatibility during rollout, and the migration path preserves existing user avatars as starting points in the new system.
