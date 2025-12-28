-- Default Avatar Categories and Palettes
-- Run this to populate your avatar system with starter data

-- ============================================
-- DEFAULT COLOR PALETTES
-- ============================================
INSERT INTO avatar_color_palettes (id, display_name, colors) VALUES
  ('hair', 'Hair Colors', ARRAY['#000000', '#1a1a1a', '#3d2314', '#6b3a1f', '#8b4513', '#a0522d', '#cd853f', '#daa520', '#f4c430', '#e8d5b7', '#faf0be', '#ff6b6b', '#c084fc', '#38bdf8', '#22c55e']),
  ('skin', 'Skin Tones', ARRAY['#ffecd4', '#f5d6ba', '#e8c4a2', '#d4a574', '#c68642', '#8d5524', '#6b4423', '#4a3728', '#3d2b1f']),
  ('eyes', 'Eye Colors', ARRAY['#3d2314', '#634e34', '#1c7ed6', '#15aabf', '#37b24d', '#fab005', '#7c3aed', '#868e96']),
  ('clothing', 'Clothing Colors', ARRAY['#000000', '#ffffff', '#e03131', '#f76707', '#fab005', '#37b24d', '#1c7ed6', '#7c3aed', '#e64980', '#868e96', '#495057', '#212529']),
  ('accessories', 'Accessory Colors', ARRAY['#ffd700', '#c0c0c0', '#cd7f32', '#b87333', '#000000', '#ffffff', '#e03131', '#1c7ed6', '#37b24d'])
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  colors = EXCLUDED.colors;

-- ============================================
-- DEFAULT CATEGORIES
-- Layered from back to front (lower layer_order = rendered first/behind)
-- ============================================
INSERT INTO avatar_categories (id, display_name, layer_order, is_required, max_selections, supports_color_variants, default_color_palette) VALUES
  -- Base layers (rendered first - behind everything)
  ('background', 'Background', 0, false, 1, false, null),
  ('body', 'Body Shape', 1, true, 1, true, 'skin'),

  -- Back hair (behind the head)
  ('hair_back', 'Hair (Back)', 2, false, 1, true, 'hair'),

  -- Face and features
  ('face', 'Face', 3, true, 1, true, 'skin'),
  ('eyes', 'Eyes', 4, true, 1, true, 'eyes'),
  ('eyebrows', 'Eyebrows', 5, false, 1, true, 'hair'),
  ('nose', 'Nose', 6, false, 1, true, 'skin'),
  ('mouth', 'Mouth', 7, true, 1, false, null),
  ('facial_hair', 'Facial Hair', 8, false, 1, true, 'hair'),

  -- Ears (before front hair so hair can overlap)
  ('ears', 'Ears', 9, false, 1, true, 'skin'),

  -- Front hair (in front of face)
  ('hair_front', 'Hair (Front)', 10, false, 1, true, 'hair'),

  -- Clothing layers
  ('clothing_base', 'Shirt/Top', 11, false, 1, true, 'clothing'),
  ('clothing_outer', 'Jacket/Outer', 12, false, 1, true, 'clothing'),

  -- Accessories (topmost layers)
  ('glasses', 'Glasses', 13, false, 1, false, null),
  ('earrings', 'Earrings', 14, false, 2, true, 'accessories'),
  ('headwear', 'Headwear', 15, false, 1, true, 'accessories'),
  ('face_accessories', 'Face Accessories', 16, false, 3, false, null)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  layer_order = EXCLUDED.layer_order,
  is_required = EXCLUDED.is_required,
  max_selections = EXCLUDED.max_selections,
  supports_color_variants = EXCLUDED.supports_color_variants,
  default_color_palette = EXCLUDED.default_color_palette;

-- ============================================
-- DEFAULT GENERATION PRESETS
-- ============================================
INSERT INTO avatar_generation_presets (id, name, prompt_template, negative_prompt, style_suffix, model) VALUES
  ('anime', 'Anime Style',
   '{component}, anime style, cel shaded, clean lines, vibrant colors, high quality illustration, transparent background',
   'realistic, photorealistic, 3D, blurry, low quality, watermark, signature',
   'studio ghibli inspired, soft lighting',
   'cf-flux-schnell'),

  ('pixel', 'Pixel Art',
   '{component}, pixel art style, 32x32 sprite, retro game aesthetic, clean pixels, limited color palette, transparent background',
   'anti-aliased, smooth, blurry, realistic, high resolution photo',
   'indie game style, nostalgic',
   'cf-flux-schnell'),

  ('cartoon', 'Cartoon Style',
   '{component}, cartoon illustration, bold outlines, flat colors, playful style, character design, transparent background',
   'realistic, photorealistic, 3D render, complex shading',
   'disney inspired, fun and expressive',
   'cf-flux-schnell'),

  ('chibi', 'Chibi Style',
   '{component}, chibi style, cute proportions, big head small body, kawaii, adorable, transparent background',
   'realistic proportions, photorealistic, scary, dark',
   'japanese chibi art, pastel colors',
   'cf-flux-schnell'),

  ('realistic', 'Semi-Realistic',
   '{component}, digital art portrait, semi-realistic style, detailed, professional illustration, transparent background',
   'anime, cartoon, pixel art, low quality, deformed',
   'artstation quality, detailed rendering',
   'cf-flux-schnell')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  prompt_template = EXCLUDED.prompt_template,
  negative_prompt = EXCLUDED.negative_prompt,
  style_suffix = EXCLUDED.style_suffix,
  model = EXCLUDED.model;
