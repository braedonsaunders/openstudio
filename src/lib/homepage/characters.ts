// Homepage Characters Supabase operations

import { supabaseAuth } from '@/lib/supabase/auth';
import { getAdminSupabase } from '@/lib/supabase/server';
import type {
  HomepageCharacter,
  CreateHomepageCharacterRequest,
  UpdateHomepageCharacterRequest,
  CanvasData,
  HomepageSceneType,
  CharacterPersonality,
  IdleAnimation,
} from '@/types/avatar';

// ============================================
// TRANSFORM FUNCTIONS
// ============================================

function transformCharacter(data: Record<string, unknown>): HomepageCharacter {
  return {
    id: data.id as string,
    name: data.name as string,
    description: data.description as string | undefined,
    canvasData: data.canvas_data as CanvasData,
    fullBodyUrl: data.full_body_url as string | null,
    thumbnailUrl: data.thumbnail_url as string | null,
    personality: data.personality as CharacterPersonality | undefined,
    preferredScenes: data.preferred_scenes as HomepageSceneType[] | undefined,
    walkSpeed: (data.walk_speed as number) ?? 1.0,
    idleAnimation: (data.idle_animation as IdleAnimation) ?? 'bounce',
    isActive: data.is_active as boolean,
    sortOrder: (data.sort_order as number) ?? 0,
    createdBy: data.created_by as string | undefined,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

// ============================================
// PUBLIC FUNCTIONS
// ============================================

/**
 * Get all active characters for homepage display
 */
export async function getActiveCharacters(): Promise<HomepageCharacter[]> {
  const { data, error } = await supabaseAuth
    .from('homepage_characters')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('Failed to fetch active characters:', error);
    return [];
  }

  return (data || []).map(transformCharacter);
}

/**
 * Get characters for a specific scene
 */
export async function getCharactersForScene(scene: HomepageSceneType): Promise<HomepageCharacter[]> {
  const { data, error } = await supabaseAuth
    .from('homepage_characters')
    .select('*')
    .eq('is_active', true)
    .or(`preferred_scenes.is.null,preferred_scenes.cs.{${scene}}`)
    .order('sort_order');

  if (error) {
    console.error('Failed to fetch characters for scene:', error);
    return [];
  }

  return (data || []).map(transformCharacter);
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Get all characters (including inactive) for admin
 */
export async function getAllCharacters(): Promise<HomepageCharacter[]> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('homepage_characters')
    .select('*')
    .order('sort_order');

  if (error) {
    throw new Error(`Failed to fetch all characters: ${error.message}`);
  }

  return (data || []).map(transformCharacter);
}

/**
 * Get a single character by ID
 */
export async function getCharacterById(id: string): Promise<HomepageCharacter | null> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('homepage_characters')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to fetch character: ${error.message}`);
  }

  return transformCharacter(data);
}

/**
 * Create a new character
 */
export async function createCharacter(
  request: CreateHomepageCharacterRequest,
  userId: string
): Promise<HomepageCharacter> {
  const supabase = getAdminSupabase();

  // Get max sort order
  const { data: maxOrder } = await supabase
    .from('homepage_characters')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (maxOrder?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('homepage_characters')
    .insert({
      name: request.name,
      description: request.description,
      canvas_data: request.canvasData,
      personality: request.personality,
      preferred_scenes: request.preferredScenes,
      walk_speed: request.walkSpeed ?? 1.0,
      idle_animation: request.idleAnimation ?? 'bounce',
      sort_order: nextOrder,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create character: ${error.message}`);
  }

  return transformCharacter(data);
}

/**
 * Update a character
 */
export async function updateCharacter(
  id: string,
  request: UpdateHomepageCharacterRequest
): Promise<HomepageCharacter> {
  const supabase = getAdminSupabase();

  const updateData: Record<string, unknown> = {};

  if (request.name !== undefined) updateData.name = request.name;
  if (request.description !== undefined) updateData.description = request.description;
  if (request.canvasData !== undefined) updateData.canvas_data = request.canvasData;
  if (request.fullBodyUrl !== undefined) updateData.full_body_url = request.fullBodyUrl;
  if (request.thumbnailUrl !== undefined) updateData.thumbnail_url = request.thumbnailUrl;
  if (request.personality !== undefined) updateData.personality = request.personality;
  if (request.preferredScenes !== undefined) updateData.preferred_scenes = request.preferredScenes;
  if (request.walkSpeed !== undefined) updateData.walk_speed = request.walkSpeed;
  if (request.idleAnimation !== undefined) updateData.idle_animation = request.idleAnimation;
  if (request.isActive !== undefined) updateData.is_active = request.isActive;
  if (request.sortOrder !== undefined) updateData.sort_order = request.sortOrder;

  const { data, error } = await supabase
    .from('homepage_characters')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update character: ${error.message}`);
  }

  return transformCharacter(data);
}

/**
 * Delete a character
 */
export async function deleteCharacter(id: string): Promise<void> {
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from('homepage_characters')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete character: ${error.message}`);
  }
}

/**
 * Reorder characters
 */
export async function reorderCharacters(orderedIds: string[]): Promise<void> {
  const supabase = getAdminSupabase();

  const updates = orderedIds.map((id, index) => ({
    id,
    sort_order: index,
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from('homepage_characters')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id);

    if (error) {
      throw new Error(`Failed to reorder characters: ${error.message}`);
    }
  }
}

/**
 * Toggle character active status
 */
export async function toggleCharacterActive(id: string, isActive: boolean): Promise<HomepageCharacter> {
  return updateCharacter(id, { isActive });
}
