// Avatar system Supabase operations

import { supabaseAuth } from '@/lib/supabase/auth';
import { getAdminSupabase } from '@/lib/supabase/server';
import { getSignedUrlFromKeyOrUrl, extractAvatarR2Key } from '@/lib/storage/r2';
import type {
  AvatarCategory,
  AvatarComponent,
  AvatarUnlockRule,
  AvatarComponentUnlock,
  AvatarColorPalette,
  AvatarGenerationPreset,
  UserUnlockedComponent,
  AvatarComponentLibrary,
  CreateComponentRequest,
  UpdateComponentRequest,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CreateUnlockRuleRequest,
  UpdateUnlockRuleRequest,
  AdminAvatarStats,
  CanvasData,
  UserAvatarCanvas,
} from '@/types/avatar';

// ============================================
// TRANSFORM FUNCTIONS
// ============================================

function transformCategory(data: Record<string, unknown>): AvatarCategory {
  return {
    id: data.id as string,
    displayName: data.display_name as string,
    layerOrder: data.layer_order as number,
    isRequired: data.is_required as boolean,
    maxSelections: data.max_selections as number,
    supportsColorVariants: data.supports_color_variants as boolean,
    defaultColorPalette: data.default_color_palette as string | undefined,
    promptAddition: data.prompt_addition as string | undefined,
    renderX: (data.render_x as number) ?? 0,
    renderY: (data.render_y as number) ?? 0,
    renderWidth: (data.render_width as number) ?? 512,
    renderHeight: (data.render_height as number) ?? 512,
    isActive: data.is_active as boolean,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

function transformComponent(data: Record<string, unknown>): AvatarComponent {
  return {
    id: data.id as string,
    categoryId: data.category_id as string,
    name: data.name as string,
    imageUrl: data.image_url as string,
    thumbnailUrl: data.thumbnail_url as string | undefined,
    r2Key: data.r2_key as string,
    tags: (data.tags as string[]) || [],
    rarity: data.rarity as AvatarComponent['rarity'],
    colorVariants: data.color_variants as Record<string, string> | undefined,
    baseColor: data.base_color as string | undefined,
    generationPrompt: data.generation_prompt as string | undefined,
    generationModel: data.generation_model as string | undefined,
    generationParams: data.generation_params as Record<string, unknown> | undefined,
    isActive: data.is_active as boolean,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    createdBy: data.created_by as string | undefined,
  };
}

/**
 * Refresh component URLs to use fresh signed URLs
 * This handles both expired presigned URLs and plain R2 keys
 */
async function refreshComponentUrls(component: AvatarComponent): Promise<AvatarComponent> {
  // Use r2Key as the source of truth if available, otherwise extract from imageUrl
  const imageKey = component.r2Key || extractAvatarR2Key(component.imageUrl);
  const thumbnailKey = component.thumbnailUrl
    ? extractAvatarR2Key(component.thumbnailUrl)
    : imageKey.replace('.png', '_thumb.png');

  const [freshImageUrl, freshThumbnailUrl] = await Promise.all([
    getSignedUrlFromKeyOrUrl(imageKey),
    getSignedUrlFromKeyOrUrl(thumbnailKey),
  ]);

  // Also refresh color variant URLs if present
  let freshColorVariants = component.colorVariants;
  if (component.colorVariants && Object.keys(component.colorVariants).length > 0) {
    const variantEntries = await Promise.all(
      Object.entries(component.colorVariants).map(async ([color, url]) => {
        const freshUrl = await getSignedUrlFromKeyOrUrl(url);
        return [color, freshUrl || url] as [string, string];
      })
    );
    freshColorVariants = Object.fromEntries(variantEntries);
  }

  return {
    ...component,
    imageUrl: freshImageUrl || component.imageUrl,
    thumbnailUrl: freshThumbnailUrl || component.thumbnailUrl,
    colorVariants: freshColorVariants,
  };
}

/**
 * Refresh URLs for multiple components in parallel
 */
async function refreshComponentsUrls(components: AvatarComponent[]): Promise<AvatarComponent[]> {
  return Promise.all(components.map(refreshComponentUrls));
}

function transformUnlockRule(data: Record<string, unknown>): AvatarUnlockRule {
  return {
    id: data.id as string,
    displayName: data.display_name as string,
    description: data.description as string | undefined,
    unlockType: data.unlock_type as AvatarUnlockRule['unlockType'],
    levelRequired: data.level_required as number | undefined,
    achievementId: data.achievement_id as string | undefined,
    statisticKey: data.statistic_key as string | undefined,
    statisticOperator: data.statistic_operator as AvatarUnlockRule['statisticOperator'] | undefined,
    statisticValue: data.statistic_value as number | undefined,
    isActive: data.is_active as boolean,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

function transformPreset(data: Record<string, unknown>): AvatarGenerationPreset {
  return {
    id: data.id as string,
    name: data.name as string,
    promptTemplate: data.prompt_template as string,
    negativePrompt: data.negative_prompt as string | undefined,
    styleSuffix: data.style_suffix as string | undefined,
    model: data.model as string,
    params: data.params as Record<string, unknown> | undefined,
    isActive: data.is_active as boolean,
    createdAt: data.created_at as string,
  };
}

// ============================================
// PUBLIC LIBRARY FUNCTIONS
// ============================================

export async function getAvatarLibrary(): Promise<AvatarComponentLibrary> {
  const [
    { data: categoriesData },
    { data: componentsData },
    { data: palettesData },
    { data: rulesData },
    { data: unlocksData },
  ] = await Promise.all([
    supabaseAuth.from('avatar_categories').select('*').eq('is_active', true).order('layer_order'),
    supabaseAuth.from('avatar_components').select('*').eq('is_active', true),
    supabaseAuth.from('avatar_color_palettes').select('*'),
    supabaseAuth.from('avatar_unlock_rules').select('*').eq('is_active', true),
    supabaseAuth.from('avatar_component_unlocks').select('*'),
  ]);

  const categories = (categoriesData || []).map(transformCategory);
  const rawComponents = (componentsData || []).map(transformComponent);
  // Refresh URLs to get fresh signed URLs (handles expired presigned URLs)
  const components = await refreshComponentsUrls(rawComponents);
  const unlockRules = (rulesData || []).map(transformUnlockRule);

  const colorPalettes: Record<string, string[]> = {};
  for (const palette of palettesData || []) {
    colorPalettes[palette.id] = palette.colors as string[];
  }

  const componentUnlocks: AvatarComponentUnlock[] = (unlocksData || []).map((d) => ({
    componentId: d.component_id as string,
    unlockRuleId: d.unlock_rule_id as string,
  }));

  return {
    categories,
    components,
    colorPalettes,
    unlockRules,
    componentUnlocks,
  };
}

export async function getUserUnlockedComponents(userId: string): Promise<Set<string>> {
  const { data } = await supabaseAuth
    .from('user_unlocked_components')
    .select('component_id')
    .eq('user_id', userId);

  return new Set((data || []).map((d) => d.component_id as string));
}

// ============================================
// ADMIN: CATEGORY FUNCTIONS
// ============================================

export async function getAllCategories(): Promise<AvatarCategory[]> {
  const { data, error } = await supabaseAuth
    .from('avatar_categories')
    .select('*')
    .order('layer_order');

  if (error) throw error;
  return (data || []).map(transformCategory);
}

export async function createCategory(request: CreateCategoryRequest): Promise<AvatarCategory> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  const { data, error } = await adminClient
    .from('avatar_categories')
    .insert({
      id: request.id,
      display_name: request.displayName,
      layer_order: request.layerOrder,
      is_required: request.isRequired ?? false,
      max_selections: request.maxSelections ?? 1,
      supports_color_variants: request.supportsColorVariants ?? false,
      default_color_palette: request.defaultColorPalette,
      prompt_addition: request.promptAddition,
      render_x: request.renderX ?? 0,
      render_y: request.renderY ?? 0,
      render_width: request.renderWidth ?? 512,
      render_height: request.renderHeight ?? 512,
    })
    .select()
    .single();

  if (error) throw error;
  return transformCategory(data);
}

export async function updateCategory(
  id: string,
  request: UpdateCategoryRequest
): Promise<AvatarCategory> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (request.displayName !== undefined) updates.display_name = request.displayName;
  if (request.layerOrder !== undefined) updates.layer_order = request.layerOrder;
  if (request.isRequired !== undefined) updates.is_required = request.isRequired;
  if (request.maxSelections !== undefined) updates.max_selections = request.maxSelections;
  if (request.supportsColorVariants !== undefined) updates.supports_color_variants = request.supportsColorVariants;
  if (request.defaultColorPalette !== undefined) updates.default_color_palette = request.defaultColorPalette;
  if (request.promptAddition !== undefined) updates.prompt_addition = request.promptAddition;
  if (request.isActive !== undefined) updates.is_active = request.isActive;
  if (request.renderX !== undefined) updates.render_x = request.renderX;
  if (request.renderY !== undefined) updates.render_y = request.renderY;
  if (request.renderWidth !== undefined) updates.render_width = request.renderWidth;
  if (request.renderHeight !== undefined) updates.render_height = request.renderHeight;

  const { data, error } = await adminClient
    .from('avatar_categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return transformCategory(data);
}

export async function updateCategoryOrder(orderedIds: string[]): Promise<void> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  const updates = orderedIds.map((id, index) => ({
    id,
    layer_order: index,
    updated_at: new Date().toISOString(),
  }));

  for (const update of updates) {
    await adminClient
      .from('avatar_categories')
      .update({ layer_order: update.layer_order, updated_at: update.updated_at })
      .eq('id', update.id);
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  const { error } = await adminClient
    .from('avatar_categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// ADMIN: COMPONENT FUNCTIONS
// ============================================

export async function getAllComponents(): Promise<AvatarComponent[]> {
  const { data, error } = await supabaseAuth
    .from('avatar_components')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  const rawComponents = (data || []).map(transformComponent);
  return refreshComponentsUrls(rawComponents);
}

export async function getComponentsByCategory(categoryId: string): Promise<AvatarComponent[]> {
  const { data, error } = await supabaseAuth
    .from('avatar_components')
    .select('*')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const rawComponents = (data || []).map(transformComponent);
  return refreshComponentsUrls(rawComponents);
}

export async function getComponentById(id: string): Promise<AvatarComponent | null> {
  const { data, error } = await supabaseAuth
    .from('avatar_components')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  if (!data) return null;
  const component = transformComponent(data);
  return refreshComponentUrls(component);
}

export async function createComponent(
  request: CreateComponentRequest,
  createdBy: string
): Promise<AvatarComponent> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  const { data, error } = await adminClient
    .from('avatar_components')
    .insert({
      id: request.id,
      category_id: request.categoryId,
      name: request.name,
      image_url: request.imageUrl,
      thumbnail_url: request.thumbnailUrl,
      r2_key: request.r2Key,
      tags: request.tags || [],
      rarity: request.rarity || 'common',
      color_variants: request.colorVariants || {},
      base_color: request.baseColor,
      generation_prompt: request.generationPrompt,
      generation_model: request.generationModel,
      generation_params: request.generationParams,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return transformComponent(data);
}

export async function updateComponent(
  id: string,
  request: UpdateComponentRequest
): Promise<AvatarComponent> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (request.name !== undefined) updates.name = request.name;
  if (request.tags !== undefined) updates.tags = request.tags;
  if (request.rarity !== undefined) updates.rarity = request.rarity;
  if (request.colorVariants !== undefined) updates.color_variants = request.colorVariants;
  if (request.baseColor !== undefined) updates.base_color = request.baseColor;
  if (request.isActive !== undefined) updates.is_active = request.isActive;

  const { data, error } = await adminClient
    .from('avatar_components')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Update unlock rules if provided
  if (request.unlockRuleIds !== undefined) {
    // Remove existing
    await adminClient
      .from('avatar_component_unlocks')
      .delete()
      .eq('component_id', id);

    // Add new
    if (request.unlockRuleIds.length > 0) {
      await adminClient
        .from('avatar_component_unlocks')
        .insert(
          request.unlockRuleIds.map((ruleId) => ({
            component_id: id,
            unlock_rule_id: ruleId,
          }))
        );
    }
  }

  return transformComponent(data);
}

export async function deleteComponent(id: string): Promise<void> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  const { error } = await adminClient
    .from('avatar_components')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function changeComponentId(oldId: string, newId: string): Promise<void> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  // Update the component ID directly (PostgreSQL supports updating PKs)
  const { error } = await adminClient
    .from('avatar_components')
    .update({ id: newId, updated_at: new Date().toISOString() })
    .eq('id', oldId);

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Component ID "${newId}" already exists`);
    }
    throw error;
  }

  // Also update any references in avatar_component_unlocks
  await adminClient
    .from('avatar_component_unlocks')
    .update({ component_id: newId })
    .eq('component_id', oldId);

  // Update references in user_unlocked_components
  await adminClient
    .from('user_unlocked_components')
    .update({ component_id: newId })
    .eq('component_id', oldId);
}

// ============================================
// ADMIN: UNLOCK RULE FUNCTIONS
// ============================================

export async function getAllUnlockRules(): Promise<AvatarUnlockRule[]> {
  const { data, error } = await supabaseAuth
    .from('avatar_unlock_rules')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(transformUnlockRule);
}

export async function createUnlockRule(request: CreateUnlockRuleRequest): Promise<AvatarUnlockRule> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  const { data, error } = await adminClient
    .from('avatar_unlock_rules')
    .insert({
      id: request.id,
      display_name: request.displayName,
      description: request.description,
      unlock_type: request.unlockType,
      level_required: request.levelRequired,
      achievement_id: request.achievementId,
      statistic_key: request.statisticKey,
      statistic_operator: request.statisticOperator,
      statistic_value: request.statisticValue,
    })
    .select()
    .single();

  if (error) throw error;
  return transformUnlockRule(data);
}

export async function updateUnlockRule(
  id: string,
  request: UpdateUnlockRuleRequest
): Promise<AvatarUnlockRule> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (request.displayName !== undefined) updates.display_name = request.displayName;
  if (request.description !== undefined) updates.description = request.description;
  if (request.unlockType !== undefined) updates.unlock_type = request.unlockType;
  if (request.levelRequired !== undefined) updates.level_required = request.levelRequired;
  if (request.achievementId !== undefined) updates.achievement_id = request.achievementId;
  if (request.statisticKey !== undefined) updates.statistic_key = request.statisticKey;
  if (request.statisticOperator !== undefined) updates.statistic_operator = request.statisticOperator;
  if (request.statisticValue !== undefined) updates.statistic_value = request.statisticValue;
  if (request.isActive !== undefined) updates.is_active = request.isActive;

  const { data, error } = await adminClient
    .from('avatar_unlock_rules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Update component associations if provided
  if (request.componentIds !== undefined) {
    // Remove existing
    await adminClient
      .from('avatar_component_unlocks')
      .delete()
      .eq('unlock_rule_id', id);

    // Add new
    if (request.componentIds.length > 0) {
      await adminClient
        .from('avatar_component_unlocks')
        .insert(
          request.componentIds.map((componentId) => ({
            component_id: componentId,
            unlock_rule_id: id,
          }))
        );
    }
  }

  return transformUnlockRule(data);
}

export async function deleteUnlockRule(id: string): Promise<void> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  const { error } = await adminClient
    .from('avatar_unlock_rules')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// ADMIN: PRESET FUNCTIONS
// ============================================

export async function getGenerationPresets(): Promise<AvatarGenerationPreset[]> {
  const { data, error } = await supabaseAuth
    .from('avatar_generation_presets')
    .select('*')
    .order('name');

  if (error) throw error;
  return (data || []).map(transformPreset);
}

export async function createGenerationPreset(
  preset: Omit<AvatarGenerationPreset, 'createdAt' | 'isActive'>
): Promise<AvatarGenerationPreset> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  const { data, error } = await adminClient
    .from('avatar_generation_presets')
    .insert({
      id: preset.id,
      name: preset.name,
      prompt_template: preset.promptTemplate,
      negative_prompt: preset.negativePrompt,
      style_suffix: preset.styleSuffix,
      model: preset.model,
      params: preset.params,
    })
    .select()
    .single();

  if (error) throw error;
  return transformPreset(data);
}

export async function updateGenerationPreset(
  id: string,
  updates: Partial<AvatarGenerationPreset>
): Promise<AvatarGenerationPreset> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  const dbUpdates: Record<string, unknown> = {};

  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.promptTemplate !== undefined) dbUpdates.prompt_template = updates.promptTemplate;
  if (updates.negativePrompt !== undefined) dbUpdates.negative_prompt = updates.negativePrompt;
  if (updates.styleSuffix !== undefined) dbUpdates.style_suffix = updates.styleSuffix;
  if (updates.model !== undefined) dbUpdates.model = updates.model;
  if (updates.params !== undefined) dbUpdates.params = updates.params;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

  const { data, error } = await adminClient
    .from('avatar_generation_presets')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return transformPreset(data);
}

export async function deleteGenerationPreset(id: string): Promise<void> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  const { error } = await adminClient
    .from('avatar_generation_presets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// ADMIN: COLOR PALETTE FUNCTIONS
// ============================================

export async function getColorPalettes(): Promise<AvatarColorPalette[]> {
  const { data, error } = await supabaseAuth
    .from('avatar_color_palettes')
    .select('*')
    .order('display_name');

  if (error) throw error;
  return (data || []).map((d) => ({
    id: d.id as string,
    displayName: d.display_name as string,
    colors: d.colors as string[],
    createdAt: d.created_at as string,
  }));
}

export async function upsertColorPalette(
  id: string,
  displayName: string,
  colors: string[]
): Promise<AvatarColorPalette> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  const { data, error } = await adminClient
    .from('avatar_color_palettes')
    .upsert({
      id,
      display_name: displayName,
      colors,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id as string,
    displayName: data.display_name as string,
    colors: data.colors as string[],
    createdAt: data.created_at as string,
  };
}

// ============================================
// ADMIN: MANUAL UNLOCK FUNCTIONS
// ============================================

export async function grantComponentToUser(
  userId: string,
  componentId: string,
  reason?: string
): Promise<void> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  const { error } = await adminClient
    .from('user_unlocked_components')
    .upsert({
      user_id: userId,
      component_id: componentId,
      unlocked_reason: reason || 'admin_grant',
    });

  if (error) throw error;
}

export async function revokeComponentFromUser(
  userId: string,
  componentId: string
): Promise<void> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  const { error } = await adminClient
    .from('user_unlocked_components')
    .delete()
    .eq('user_id', userId)
    .eq('component_id', componentId);

  if (error) throw error;
}

// ============================================
// ADMIN: STATS
// ============================================

export async function getAvatarStats(): Promise<AdminAvatarStats> {
  const [
    { count: totalComponents },
    { data: componentsData },
    { count: totalUnlockRules },
    { data: lockedComponentsData },
  ] = await Promise.all([
    supabaseAuth.from('avatar_components').select('*', { count: 'exact', head: true }),
    supabaseAuth.from('avatar_components').select('category_id, rarity'),
    supabaseAuth.from('avatar_unlock_rules').select('*', { count: 'exact', head: true }),
    supabaseAuth.from('avatar_component_unlocks').select('component_id'),
  ]);

  const componentsByCategory: Record<string, number> = {};
  const componentsByRarity: Record<string, number> = {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  };

  for (const comp of componentsData || []) {
    const catId = comp.category_id as string;
    const rarity = comp.rarity as string;
    componentsByCategory[catId] = (componentsByCategory[catId] || 0) + 1;
    componentsByRarity[rarity] = (componentsByRarity[rarity] || 0) + 1;
  }

  const lockedComponentIds = new Set((lockedComponentsData || []).map((d) => d.component_id));

  return {
    totalComponents: totalComponents || 0,
    componentsByCategory,
    componentsByRarity: componentsByRarity as Record<'common' | 'rare' | 'epic' | 'legendary', number>,
    totalUnlockRules: totalUnlockRules || 0,
    lockedComponents: lockedComponentIds.size,
  };
}

// ============================================
// COMPONENT UNLOCK ASSOCIATIONS
// ============================================

export async function getComponentUnlocks(): Promise<AvatarComponentUnlock[]> {
  const { data, error } = await supabaseAuth
    .from('avatar_component_unlocks')
    .select('*');

  if (error) throw error;
  return (data || []).map((d) => ({
    componentId: d.component_id as string,
    unlockRuleId: d.unlock_rule_id as string,
  }));
}

export async function setComponentUnlockRules(
  componentId: string,
  unlockRuleIds: string[]
): Promise<void> {
  const adminClient = getAdminSupabase();
  if (!adminClient) throw new Error('Admin client not configured');

  // Remove existing
  await adminClient
    .from('avatar_component_unlocks')
    .delete()
    .eq('component_id', componentId);

  // Add new
  if (unlockRuleIds.length > 0) {
    const { error } = await adminClient
      .from('avatar_component_unlocks')
      .insert(
        unlockRuleIds.map((ruleId) => ({
          component_id: componentId,
          unlock_rule_id: ruleId,
        }))
      );

    if (error) throw error;
  }
}

// ============================================
// CANVAS FUNCTIONS
// ============================================

function transformUserAvatarCanvas(data: Record<string, unknown>): UserAvatarCanvas {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    canvasData: data.canvas_data as CanvasData,
    fullBodyUrl: data.full_body_url as string | null,
    headshotUrl: data.headshot_url as string | null,
    thumbnailUrls: data.thumbnail_urls as UserAvatarCanvas['thumbnailUrls'],
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

export async function getUserAvatarCanvas(userId: string): Promise<UserAvatarCanvas | null> {
  // Use admin client for server-side operations
  const supabase = getAdminSupabase();
  if (!supabase) throw new Error('Admin client not available');
  const { data, error } = await supabase
    .from('user_avatar_canvas')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  if (!data) return null;

  const canvas = transformUserAvatarCanvas(data);

  // Generate fresh signed URLs from stored R2 keys
  const [freshFullBodyUrl, freshHeadshotUrl] = await Promise.all([
    canvas.fullBodyUrl ? getSignedUrlFromKeyOrUrl(canvas.fullBodyUrl) : null,
    canvas.headshotUrl ? getSignedUrlFromKeyOrUrl(canvas.headshotUrl) : null,
  ]);

  // Refresh thumbnail URLs if present
  let freshThumbnailUrls: UserAvatarCanvas['thumbnailUrls'] = canvas.thumbnailUrls;
  if (canvas.thumbnailUrls) {
    const [xs, sm, md, lg] = await Promise.all([
      canvas.thumbnailUrls.xs ? getSignedUrlFromKeyOrUrl(canvas.thumbnailUrls.xs) : null,
      canvas.thumbnailUrls.sm ? getSignedUrlFromKeyOrUrl(canvas.thumbnailUrls.sm) : null,
      canvas.thumbnailUrls.md ? getSignedUrlFromKeyOrUrl(canvas.thumbnailUrls.md) : null,
      canvas.thumbnailUrls.lg ? getSignedUrlFromKeyOrUrl(canvas.thumbnailUrls.lg) : null,
    ]);
    freshThumbnailUrls = { xs, sm, md, lg } as UserAvatarCanvas['thumbnailUrls'];
  }

  return {
    ...canvas,
    fullBodyUrl: freshFullBodyUrl,
    headshotUrl: freshHeadshotUrl,
    thumbnailUrls: freshThumbnailUrls,
  };
}

export async function saveUserAvatarCanvas(
  userId: string,
  canvasData: CanvasData,
  fullBodyUrl?: string,
  headshotUrl?: string,
  thumbnailUrls?: UserAvatarCanvas['thumbnailUrls']
): Promise<UserAvatarCanvas> {
  // Use admin client to bypass RLS - API already validates auth
  const supabase = getAdminSupabase();
  if (!supabase) throw new Error('Admin client not available');
  const { data, error } = await supabase
    .from('user_avatar_canvas')
    .upsert(
      {
        user_id: userId,
        canvas_data: canvasData,
        full_body_url: fullBodyUrl,
        headshot_url: headshotUrl,
        thumbnail_urls: thumbnailUrls,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return transformUserAvatarCanvas(data);
}

export async function getPublicAvatarUrls(userId: string): Promise<{
  fullBodyUrl: string | null;
  headshotUrl: string | null;
  thumbnailUrls: UserAvatarCanvas['thumbnailUrls'];
} | null> {
  // Use admin client for server-side operations
  const supabase = getAdminSupabase();
  if (!supabase) throw new Error('Admin client not available');
  const { data, error } = await supabase
    .from('user_avatar_canvas')
    .select('full_body_url, headshot_url, thumbnail_urls')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  if (!data) return null;

  const fullBodyKey = data.full_body_url as string | null;
  const headshotKey = data.headshot_url as string | null;
  const thumbnailKeys = data.thumbnail_urls as UserAvatarCanvas['thumbnailUrls'];

  // Generate fresh signed URLs from stored R2 keys
  const [freshFullBodyUrl, freshHeadshotUrl] = await Promise.all([
    fullBodyKey ? getSignedUrlFromKeyOrUrl(fullBodyKey) : null,
    headshotKey ? getSignedUrlFromKeyOrUrl(headshotKey) : null,
  ]);

  // Refresh thumbnail URLs if present
  let freshThumbnailUrls: UserAvatarCanvas['thumbnailUrls'] = null;
  if (thumbnailKeys) {
    const [xs, sm, md, lg] = await Promise.all([
      thumbnailKeys.xs ? getSignedUrlFromKeyOrUrl(thumbnailKeys.xs) : null,
      thumbnailKeys.sm ? getSignedUrlFromKeyOrUrl(thumbnailKeys.sm) : null,
      thumbnailKeys.md ? getSignedUrlFromKeyOrUrl(thumbnailKeys.md) : null,
      thumbnailKeys.lg ? getSignedUrlFromKeyOrUrl(thumbnailKeys.lg) : null,
    ]);
    freshThumbnailUrls = { xs, sm, md, lg } as UserAvatarCanvas['thumbnailUrls'];
  }

  return {
    fullBodyUrl: freshFullBodyUrl,
    headshotUrl: freshHeadshotUrl,
    thumbnailUrls: freshThumbnailUrls,
  };
}
