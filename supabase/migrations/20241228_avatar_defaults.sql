-- Avatar System Defaults
-- Run after creating tables to populate with starter data

-- Add position hint columns if they don't exist
ALTER TABLE avatar_color_palettes ALTER COLUMN colors TYPE jsonb USING colors::jsonb;

ALTER TABLE avatar_categories
ADD COLUMN IF NOT EXISTS position_hint TEXT,
ADD COLUMN IF NOT EXISTS prompt_hint TEXT;

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
-- DEFAULT CATEGORIES (layered back to front)
-- With position and prompt hints for AI generation
-- ============================================
INSERT INTO avatar_categories (id, display_name, layer_order, is_required, max_selections, supports_color_variants, default_color_palette, position_hint, prompt_hint) VALUES
  ('background', 'Background', 0, false, 1, false, null,
   'full canvas background',
   'background pattern or solid color, fills entire 512x512 canvas'),
  ('body', 'Body Shape', 1, true, 1, true, 'skin',
   'center, full body silhouette',
   'body silhouette centered on 512x512 canvas, torso and shoulders visible, no head detail'),
  ('hair_back', 'Hair (Back)', 2, false, 1, true, 'hair',
   'top center, behind head area',
   'back portion of hair, positioned at top of 512x512 canvas where back of head would be'),
  ('face', 'Face', 3, true, 1, true, 'skin',
   'upper center, head area',
   'face shape/head outline, centered in upper portion of 512x512 canvas'),
  ('eyes', 'Eyes', 4, true, 1, true, 'eyes',
   'upper center, eye level',
   'pair of eyes, horizontally centered, positioned at upper-middle of 512x512 canvas (roughly 35-40% from top)'),
  ('eyebrows', 'Eyebrows', 5, false, 1, true, 'hair',
   'above eyes',
   'pair of eyebrows, horizontally centered, positioned slightly above eye level on 512x512 canvas'),
  ('nose', 'Nose', 6, false, 1, true, 'skin',
   'center face, below eyes',
   'nose, centered horizontally, positioned below eyes on 512x512 canvas (roughly 45-50% from top)'),
  ('mouth', 'Mouth', 7, true, 1, false, null,
   'center face, lower',
   'mouth/lips, centered horizontally, positioned in lower-middle face area on 512x512 canvas (roughly 55-60% from top)'),
  ('facial_hair', 'Facial Hair', 8, false, 1, true, 'hair',
   'lower face',
   'facial hair (beard, mustache, stubble), positioned on lower face area of 512x512 canvas'),
  ('ears', 'Ears', 9, false, 1, true, 'skin',
   'sides of head',
   'ears, positioned on sides of head area on 512x512 canvas'),
  ('hair_front', 'Hair (Front)', 10, false, 1, true, 'hair',
   'top center, front of head',
   'front portion of hairstyle, positioned at top of 512x512 canvas, may overlap forehead area'),
  ('clothing_base', 'Shirt/Top', 11, false, 1, true, 'clothing',
   'lower body, torso',
   'shirt or top clothing, positioned in lower-center of 512x512 canvas covering torso area'),
  ('clothing_outer', 'Jacket/Outer', 12, false, 1, true, 'clothing',
   'over torso',
   'jacket or outer layer, positioned over torso area of 512x512 canvas'),
  ('glasses', 'Glasses', 13, false, 1, false, null,
   'over eyes',
   'glasses/eyewear, positioned at eye level on 512x512 canvas, horizontally centered'),
  ('earrings', 'Earrings', 14, false, 2, true, 'accessories',
   'at ear level, sides',
   'earrings, positioned at ear locations on sides of 512x512 canvas'),
  ('headwear', 'Headwear', 15, false, 1, true, 'accessories',
   'top of head',
   'hat or headwear, positioned at very top of 512x512 canvas, above hair'),
  ('face_accessories', 'Face Accessories', 16, false, 3, false, null,
   'on face',
   'face accessories (masks, face paint, piercings), positioned on face area of 512x512 canvas')
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  layer_order = EXCLUDED.layer_order,
  is_required = EXCLUDED.is_required,
  max_selections = EXCLUDED.max_selections,
  supports_color_variants = EXCLUDED.supports_color_variants,
  default_color_palette = EXCLUDED.default_color_palette,
  position_hint = EXCLUDED.position_hint,
  prompt_hint = EXCLUDED.prompt_hint;

-- ============================================
-- DEFAULT GENERATION PRESETS
-- Focus on isolated components with position awareness
-- ============================================
INSERT INTO avatar_generation_presets (id, name, prompt_template, negative_prompt, style_suffix, model) VALUES
  ('anime', 'Anime Style',
   'isolated {component} only, {position_hint}, anime style, single element on 512x512 transparent canvas, cel shaded, clean lines, game asset sprite, no full body, no full character',
   'full body, full character, person, human, multiple objects, background, nsfw, nude, realistic photo, multiple items',
   'high quality anime illustration',
   'cf-flux-schnell'),
  ('pixel', 'Pixel Art',
   'isolated {component} only, {position_hint}, pixel art style, single sprite on 512x512 transparent canvas, retro game aesthetic, clean pixels, no full body, no character',
   'full body, character, person, human, anti-aliased, smooth, background, nsfw, nude, realistic',
   'indie game sprite style',
   'cf-flux-schnell'),
  ('cartoon', 'Cartoon Style',
   'isolated {component} only, {position_hint}, cartoon illustration, single element on 512x512 transparent canvas, bold outlines, flat colors, game asset, no full body',
   'full body, full character, person, human, realistic, 3D, background, nsfw, nude, multiple objects',
   'fun cartoon style',
   'cf-flux-schnell'),
  ('chibi', 'Chibi Style',
   'isolated {component} only, {position_hint}, chibi style, single cute element on 512x512 transparent canvas, kawaii, game asset sprite, no full body',
   'full body, full character, person standing, realistic, scary, dark, background, nsfw, nude',
   'adorable chibi art',
   'cf-flux-schnell'),
  ('realistic', 'Semi-Realistic',
   'isolated {component} only, {position_hint}, digital art, single element on 512x512 transparent canvas, semi-realistic style, professional sprite, no full body',
   'full body, full character, person, photo, anime, cartoon, background, nsfw, nude, multiple objects',
   'detailed digital art',
   'cf-flux-schnell')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  prompt_template = EXCLUDED.prompt_template,
  negative_prompt = EXCLUDED.negative_prompt,
  style_suffix = EXCLUDED.style_suffix,
  model = EXCLUDED.model;
