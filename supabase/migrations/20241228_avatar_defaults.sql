-- Avatar System Defaults
-- Run after creating tables to populate with starter data

-- Add render position columns if they don't exist
ALTER TABLE avatar_categories
ADD COLUMN IF NOT EXISTS render_x INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS render_y INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS render_width INTEGER NOT NULL DEFAULT 512,
ADD COLUMN IF NOT EXISTS render_height INTEGER NOT NULL DEFAULT 512;

-- Drop old hint columns if they exist (no longer needed)
ALTER TABLE avatar_categories DROP COLUMN IF EXISTS position_hint;
ALTER TABLE avatar_categories DROP COLUMN IF EXISTS prompt_hint;

-- ============================================
-- DEFAULT COLOR PALETTES (JSONB format)
-- ============================================
INSERT INTO avatar_color_palettes (id, display_name, colors) VALUES
  ('hair', 'Hair Colors', '["#000000", "#1a1a1a", "#3d2314", "#6b3a1f", "#8b4513", "#a0522d", "#cd853f", "#daa520", "#f4c430", "#e8d5b7", "#faf0be", "#ff6b6b", "#c084fc", "#38bdf8", "#22c55e"]'::jsonb),
  ('skin', 'Skin Tones', '["#ffecd4", "#f5d6ba", "#e8c4a2", "#d4a574", "#c68642", "#8d5524", "#6b4423", "#4a3728", "#3d2b1f"]'::jsonb),
  ('eyes', 'Eye Colors', '["#3d2314", "#634e34", "#1c7ed6", "#15aabf", "#37b24d", "#fab005", "#7c3aed", "#868e96"]'::jsonb),
  ('clothing', 'Clothing Colors', '["#000000", "#ffffff", "#e03131", "#f76707", "#fab005", "#37b24d", "#1c7ed6", "#7c3aed", "#e64980", "#868e96", "#495057", "#212529"]'::jsonb),
  ('accessories', 'Accessory Colors', '["#ffd700", "#c0c0c0", "#cd7f32", "#b87333", "#000000", "#ffffff", "#e03131", "#1c7ed6", "#37b24d"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  colors = EXCLUDED.colors;

-- ============================================
-- DEFAULT CATEGORIES with FIXED RENDER POSITIONS
-- All positions based on 512x512 canvas
-- Avatar is roughly: head at top (0-250), body at bottom (250-512)
-- ============================================
INSERT INTO avatar_categories (id, display_name, layer_order, is_required, max_selections, supports_color_variants, default_color_palette, render_x, render_y, render_width, render_height) VALUES
  -- Background fills entire canvas
  ('background', 'Background', 0, false, 1, false, null,
   0, 0, 512, 512),

  -- Body/torso in lower portion
  ('body', 'Body Shape', 1, true, 1, true, 'skin',
   96, 220, 320, 292),

  -- Back hair behind head
  ('hair_back', 'Hair (Back)', 2, false, 1, true, 'hair',
   96, 20, 320, 240),

  -- Face/head shape
  ('face', 'Face', 3, true, 1, true, 'skin',
   128, 40, 256, 256),

  -- Eyes centered on face
  ('eyes', 'Eyes', 4, true, 1, true, 'eyes',
   156, 120, 200, 60),

  -- Eyebrows above eyes
  ('eyebrows', 'Eyebrows', 5, false, 1, true, 'hair',
   156, 100, 200, 40),

  -- Nose center of face
  ('nose', 'Nose', 6, false, 1, true, 'skin',
   216, 160, 80, 80),

  -- Mouth lower face
  ('mouth', 'Mouth', 7, true, 1, false, null,
   186, 220, 140, 60),

  -- Facial hair on lower face
  ('facial_hair', 'Facial Hair', 8, false, 1, true, 'hair',
   156, 200, 200, 100),

  -- Ears on sides of head
  ('ears', 'Ears', 9, false, 1, true, 'skin',
   108, 120, 296, 100),

  -- Front hair overlaps forehead
  ('hair_front', 'Hair (Front)', 10, false, 1, true, 'hair',
   96, 10, 320, 180),

  -- Shirt/top on torso
  ('clothing_base', 'Shirt/Top', 11, false, 1, true, 'clothing',
   96, 280, 320, 232),

  -- Jacket over shirt
  ('clothing_outer', 'Jacket/Outer', 12, false, 1, true, 'clothing',
   76, 270, 360, 242),

  -- Glasses over eyes
  ('glasses', 'Glasses', 13, false, 1, false, null,
   136, 110, 240, 80),

  -- Earrings at ear positions
  ('earrings', 'Earrings', 14, false, 2, true, 'accessories',
   108, 140, 296, 80),

  -- Headwear at top
  ('headwear', 'Headwear', 15, false, 1, true, 'accessories',
   76, 0, 360, 160),

  -- Face accessories (masks, etc)
  ('face_accessories', 'Face Accessories', 16, false, 3, false, null,
   128, 80, 256, 200)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  layer_order = EXCLUDED.layer_order,
  is_required = EXCLUDED.is_required,
  max_selections = EXCLUDED.max_selections,
  supports_color_variants = EXCLUDED.supports_color_variants,
  default_color_palette = EXCLUDED.default_color_palette,
  render_x = EXCLUDED.render_x,
  render_y = EXCLUDED.render_y,
  render_width = EXCLUDED.render_width,
  render_height = EXCLUDED.render_height;

-- ============================================
-- DEFAULT GENERATION PRESETS
-- AI just generates isolated assets, no positioning
-- ============================================
INSERT INTO avatar_generation_presets (id, name, prompt_template, negative_prompt, style_suffix, model) VALUES
  ('anime', 'Anime Style',
   'isolated {component}, single game asset, anime style, cel shaded, clean lines, centered on transparent background, sprite sheet ready',
   'full body, full character, person, human, multiple objects, scene, background, nsfw, nude, realistic photo',
   'high quality anime game asset',
   'cf-flux-schnell'),
  ('pixel', 'Pixel Art',
   'isolated {component}, single pixel art sprite, retro game asset, clean pixels, centered on transparent background, 2D game ready',
   'full body, character, person, human, anti-aliased, smooth, background, nsfw, nude, 3D, realistic',
   'indie game sprite',
   'cf-flux-schnell'),
  ('cartoon', 'Cartoon Style',
   'isolated {component}, single cartoon game asset, bold outlines, flat colors, centered on transparent background, 2D game sprite',
   'full body, full character, person, human, realistic, 3D, background, nsfw, nude, multiple objects',
   'fun cartoon game asset',
   'cf-flux-schnell'),
  ('chibi', 'Chibi Style',
   'isolated {component}, single chibi game asset, cute kawaii style, centered on transparent background, adorable sprite',
   'full body, full character, person standing, realistic, scary, dark, background, nsfw, nude',
   'cute chibi game asset',
   'cf-flux-schnell'),
  ('realistic', 'Semi-Realistic',
   'isolated {component}, single digital art asset, semi-realistic style, centered on transparent background, professional game sprite',
   'full body, full character, person, photo, anime, cartoon, background, nsfw, nude, multiple objects',
   'detailed digital game asset',
   'cf-flux-schnell')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  prompt_template = EXCLUDED.prompt_template,
  negative_prompt = EXCLUDED.negative_prompt,
  style_suffix = EXCLUDED.style_suffix,
  model = EXCLUDED.model;
