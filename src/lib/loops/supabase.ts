// Supabase service layer for System Loops & Instruments
// Provides CRUD operations for admin management

import { createClient } from '@supabase/supabase-js';
import type { LoopDefinition, LoopCategoryInfo, LoopSubcategory, InstantBandPreset, MidiNote } from '@/types/loops';
import type { InstrumentDefinition, InstrumentCategory } from '@/lib/audio/instrument-registry';

// =============================================================================
// Database Types (snake_case from Postgres)
// =============================================================================

interface DbLoopCategory {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface DbLoopSubcategory {
  id: string;
  category_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface DbLoop {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  bpm: number;
  bars: number;
  time_signature_numerator: number;
  time_signature_denominator: number;
  key: string | null;
  midi_data: MidiNote[];
  sound_preset: string;
  tags: string[];
  intensity: 1 | 2 | 3 | 4 | 5;
  complexity: 1 | 2 | 3 | 4 | 5;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface DbInstantBandPreset {
  id: string;
  name: string;
  description: string | null;
  loop_ids: string[];
  bpm_range_min: number;
  bpm_range_max: number;
  genre: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DbInstrumentCategory {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface DbInstrument {
  id: string;
  name: string;
  category_id: string;
  type: 'synth' | 'drums' | 'sampler';
  icon: string;
  description: string | null;
  tags: string[];
  layout: 'piano' | 'drums' | 'pads';
  note_range_min: number | null;
  note_range_max: number | null;
  synth_config: Record<string, unknown> | null;
  drum_map: Record<number, { name: string; shortName: string }> | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Supabase Client
// =============================================================================

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(url, key);
}

// =============================================================================
// LOOP CATEGORIES
// =============================================================================

export async function getAllLoopCategories(): Promise<LoopCategoryInfo[]> {
  const supabase = getSupabaseClient();

  // Fetch categories
  const { data: categories, error: catError } = await supabase
    .from('system_loop_categories')
    .select('*')
    .order('sort_order');

  if (catError) throw catError;

  // Fetch subcategories
  const { data: subcategories, error: subError } = await supabase
    .from('system_loop_subcategories')
    .select('*')
    .order('sort_order');

  if (subError) throw subError;

  // Fetch loop counts per subcategory
  const { data: loops } = await supabase
    .from('system_loops')
    .select('subcategory')
    .eq('is_active', true);

  const loopCounts = new Map<string, number>();
  loops?.forEach(loop => {
    if (loop.subcategory) {
      loopCounts.set(loop.subcategory, (loopCounts.get(loop.subcategory) || 0) + 1);
    }
  });

  // Map to LoopCategoryInfo format
  return (categories as DbLoopCategory[]).map(cat => ({
    id: cat.id as LoopCategoryInfo['id'],
    name: cat.name,
    icon: cat.icon,
    subcategories: (subcategories as DbLoopSubcategory[])
      .filter(sub => sub.category_id === cat.id)
      .map(sub => ({
        id: sub.id,
        name: sub.name,
        loopCount: loopCounts.get(sub.id) || 0,
      })),
  }));
}

export async function createLoopCategory(data: {
  id: string;
  name: string;
  icon: string;
  sort_order?: number;
}): Promise<DbLoopCategory> {
  const supabase = getSupabaseClient();

  const { data: category, error } = await supabase
    .from('system_loop_categories')
    .insert({
      id: data.id,
      name: data.name,
      icon: data.icon,
      sort_order: data.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) throw error;
  return category;
}

export async function updateLoopCategory(id: string, data: Partial<{
  name: string;
  icon: string;
  sort_order: number;
}>): Promise<DbLoopCategory> {
  const supabase = getSupabaseClient();

  const { data: category, error } = await supabase
    .from('system_loop_categories')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return category;
}

export async function deleteLoopCategory(id: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('system_loop_categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// =============================================================================
// LOOP SUBCATEGORIES
// =============================================================================

export async function getAllLoopSubcategories(categoryId?: string): Promise<DbLoopSubcategory[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('system_loop_subcategories')
    .select('*')
    .order('sort_order');

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createLoopSubcategory(data: {
  id: string;
  category_id: string;
  name: string;
  sort_order?: number;
}): Promise<DbLoopSubcategory> {
  const supabase = getSupabaseClient();

  const { data: subcategory, error } = await supabase
    .from('system_loop_subcategories')
    .insert({
      id: data.id,
      category_id: data.category_id,
      name: data.name,
      sort_order: data.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) throw error;
  return subcategory;
}

export async function updateLoopSubcategory(id: string, data: Partial<{
  name: string;
  category_id: string;
  sort_order: number;
}>): Promise<DbLoopSubcategory> {
  const supabase = getSupabaseClient();

  const { data: subcategory, error } = await supabase
    .from('system_loop_subcategories')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return subcategory;
}

export async function deleteLoopSubcategory(id: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('system_loop_subcategories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// =============================================================================
// SYSTEM LOOPS
// =============================================================================

export async function getAllSystemLoops(options?: {
  categoryId?: string;
  subcategoryId?: string;
  activeOnly?: boolean;
}): Promise<LoopDefinition[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('system_loops')
    .select('*')
    .order('name');

  if (options?.categoryId) {
    query = query.eq('category', options.categoryId);
  }
  if (options?.subcategoryId) {
    query = query.eq('subcategory', options.subcategoryId);
  }
  if (options?.activeOnly !== false) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data as DbLoop[]).map(dbLoopToDefinition);
}

export async function getSystemLoopById(id: string): Promise<LoopDefinition | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('system_loops')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return dbLoopToDefinition(data);
}

export async function createSystemLoop(loop: {
  id: string;
  name: string;
  category_id: string;
  subcategory_id?: string;
  bpm: number;
  bars: number;
  time_signature: [number, number];
  key?: string;
  midi_data: MidiNote[];
  sound_preset: string;
  tags: string[];
  intensity: 1 | 2 | 3 | 4 | 5;
  complexity: 1 | 2 | 3 | 4 | 5;
  description?: string;
  created_by?: string;
}): Promise<LoopDefinition> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('system_loops')
    .insert({
      id: loop.id,
      name: loop.name,
      category: loop.category_id,
      subcategory: loop.subcategory_id || null,
      bpm: loop.bpm,
      bars: loop.bars,
      time_signature_numerator: loop.time_signature[0],
      time_signature_denominator: loop.time_signature[1],
      key: loop.key || null,
      midi_data: loop.midi_data,
      sound_preset: loop.sound_preset,
      tags: loop.tags,
      intensity: loop.intensity,
      complexity: loop.complexity,
      description: loop.description || null,
      created_by: loop.created_by || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return dbLoopToDefinition(data);
}

export async function updateSystemLoop(id: string, updates: Partial<{
  name: string;
  category_id: string;
  subcategory_id: string | null;
  bpm: number;
  bars: number;
  time_signature: [number, number];
  key: string | null;
  midi_data: MidiNote[];
  sound_preset: string;
  tags: string[];
  intensity: 1 | 2 | 3 | 4 | 5;
  complexity: 1 | 2 | 3 | 4 | 5;
  description: string | null;
  is_active: boolean;
}>): Promise<LoopDefinition> {
  const supabase = getSupabaseClient();

  // Transform field names to match database columns
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.category_id !== undefined) dbUpdates.category = updates.category_id;
  if (updates.subcategory_id !== undefined) dbUpdates.subcategory = updates.subcategory_id;
  if (updates.bpm !== undefined) dbUpdates.bpm = updates.bpm;
  if (updates.bars !== undefined) dbUpdates.bars = updates.bars;
  if (updates.time_signature !== undefined) {
    dbUpdates.time_signature_numerator = updates.time_signature[0];
    dbUpdates.time_signature_denominator = updates.time_signature[1];
  }
  if (updates.key !== undefined) dbUpdates.key = updates.key;
  if (updates.midi_data !== undefined) dbUpdates.midi_data = updates.midi_data;
  if (updates.sound_preset !== undefined) dbUpdates.sound_preset = updates.sound_preset;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
  if (updates.intensity !== undefined) dbUpdates.intensity = updates.intensity;
  if (updates.complexity !== undefined) dbUpdates.complexity = updates.complexity;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.is_active !== undefined) dbUpdates.is_active = updates.is_active;

  const { data, error } = await supabase
    .from('system_loops')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return dbLoopToDefinition(data);
}

export async function deleteSystemLoop(id: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('system_loops')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function duplicateSystemLoop(id: string, newId: string): Promise<LoopDefinition> {
  const original = await getSystemLoopById(id);
  if (!original) throw new Error('Loop not found');

  return createSystemLoop({
    id: newId,
    name: `${original.name} (Copy)`,
    category_id: original.category,
    subcategory_id: original.subcategory,
    bpm: original.bpm,
    bars: original.bars,
    time_signature: original.timeSignature,
    key: original.key,
    midi_data: original.midiData,
    sound_preset: original.soundPreset,
    tags: original.tags,
    intensity: original.intensity,
    complexity: original.complexity,
  });
}

// Convert DB format to LoopDefinition
function dbLoopToDefinition(db: DbLoop): LoopDefinition {
  return {
    id: db.id,
    name: db.name,
    category: db.category as LoopDefinition['category'],
    subcategory: db.subcategory || '',
    bpm: db.bpm,
    bars: db.bars,
    timeSignature: [db.time_signature_numerator, db.time_signature_denominator] as [number, number],
    key: db.key || undefined,
    midiData: db.midi_data || [],
    soundPreset: db.sound_preset,
    tags: db.tags || [],
    intensity: db.intensity,
    complexity: db.complexity,
  };
}

// =============================================================================
// INSTANT BAND PRESETS
// =============================================================================

export async function getAllInstantBandPresets(activeOnly = true): Promise<InstantBandPreset[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('system_instant_band_presets')
    .select('*')
    .order('sort_order');

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data as DbInstantBandPreset[]).map(preset => ({
    id: preset.id,
    name: preset.name,
    description: preset.description || '',
    loops: preset.loop_ids || [],
    bpmRange: [preset.bpm_range_min, preset.bpm_range_max] as [number, number],
    genre: preset.genre || '',
  }));
}

export async function createInstantBandPreset(preset: {
  id: string;
  name: string;
  description?: string;
  loop_ids: string[];
  bpm_range_min: number;
  bpm_range_max: number;
  genre: string;
  sort_order?: number;
}): Promise<InstantBandPreset> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('system_instant_band_presets')
    .insert({
      id: preset.id,
      name: preset.name,
      description: preset.description || null,
      loop_ids: preset.loop_ids,
      bpm_range_min: preset.bpm_range_min,
      bpm_range_max: preset.bpm_range_max,
      genre: preset.genre,
      sort_order: preset.sort_order ?? 0,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;

  const dbPreset = data as DbInstantBandPreset;
  return {
    id: dbPreset.id,
    name: dbPreset.name,
    description: dbPreset.description || '',
    loops: dbPreset.loop_ids || [],
    bpmRange: [dbPreset.bpm_range_min, dbPreset.bpm_range_max] as [number, number],
    genre: dbPreset.genre || '',
  };
}

export async function updateInstantBandPreset(id: string, updates: Partial<{
  name: string;
  description: string | null;
  loop_ids: string[];
  bpm_range_min: number;
  bpm_range_max: number;
  genre: string;
  sort_order: number;
  is_active: boolean;
}>): Promise<InstantBandPreset> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('system_instant_band_presets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  const dbPreset = data as DbInstantBandPreset;
  return {
    id: dbPreset.id,
    name: dbPreset.name,
    description: dbPreset.description || '',
    loops: dbPreset.loop_ids || [],
    bpmRange: [dbPreset.bpm_range_min, dbPreset.bpm_range_max] as [number, number],
    genre: dbPreset.genre || '',
  };
}

export async function deleteInstantBandPreset(id: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('system_instant_band_presets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// =============================================================================
// INSTRUMENT CATEGORIES
// =============================================================================

export async function getAllInstrumentCategories(): Promise<InstrumentCategory[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('system_instrument_categories')
    .select('*')
    .order('sort_order');

  if (error) throw error;

  return (data as DbInstrumentCategory[]).map(cat => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    order: cat.sort_order,
  }));
}

export async function createInstrumentCategory(data: {
  id: string;
  name: string;
  icon: string;
  sort_order?: number;
}): Promise<InstrumentCategory> {
  const supabase = getSupabaseClient();

  const { data: category, error } = await supabase
    .from('system_instrument_categories')
    .insert({
      id: data.id,
      name: data.name,
      icon: data.icon,
      sort_order: data.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    order: category.sort_order,
  };
}

export async function updateInstrumentCategory(id: string, data: Partial<{
  name: string;
  icon: string;
  sort_order: number;
}>): Promise<InstrumentCategory> {
  const supabase = getSupabaseClient();

  const { data: category, error } = await supabase
    .from('system_instrument_categories')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    order: category.sort_order,
  };
}

export async function deleteInstrumentCategory(id: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('system_instrument_categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// =============================================================================
// SYSTEM INSTRUMENTS
// =============================================================================

export async function getAllSystemInstruments(options?: {
  categoryId?: string;
  type?: 'synth' | 'drums' | 'sampler';
  activeOnly?: boolean;
}): Promise<InstrumentDefinition[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('system_instruments')
    .select('*')
    .order('name');

  if (options?.categoryId) {
    query = query.eq('category_id', options.categoryId);
  }
  if (options?.type) {
    query = query.eq('type', options.type);
  }
  if (options?.activeOnly !== false) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data as DbInstrument[]).map(dbInstrumentToDefinition);
}

export async function getSystemInstrumentById(id: string): Promise<InstrumentDefinition | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('system_instruments')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return dbInstrumentToDefinition(data);
}

export async function createSystemInstrument(instrument: {
  id: string;
  name: string;
  category_id: string;
  type: 'synth' | 'drums' | 'sampler';
  icon: string;
  description?: string;
  tags: string[];
  layout: 'piano' | 'drums' | 'pads';
  note_range_min?: number;
  note_range_max?: number;
  synth_config?: Record<string, unknown>;
  drum_map?: Record<number, { name: string; shortName: string }>;
  created_by?: string;
}): Promise<InstrumentDefinition> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('system_instruments')
    .insert({
      id: instrument.id,
      name: instrument.name,
      category_id: instrument.category_id,
      type: instrument.type,
      icon: instrument.icon,
      description: instrument.description || null,
      tags: instrument.tags,
      layout: instrument.layout,
      note_range_min: instrument.note_range_min || null,
      note_range_max: instrument.note_range_max || null,
      synth_config: instrument.synth_config || null,
      drum_map: instrument.drum_map || null,
      created_by: instrument.created_by || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return dbInstrumentToDefinition(data);
}

export async function updateSystemInstrument(id: string, updates: Partial<{
  name: string;
  category_id: string;
  type: 'synth' | 'drums' | 'sampler';
  icon: string;
  description: string | null;
  tags: string[];
  layout: 'piano' | 'drums' | 'pads';
  note_range_min: number | null;
  note_range_max: number | null;
  synth_config: Record<string, unknown> | null;
  drum_map: Record<number, { name: string; shortName: string }> | null;
  is_active: boolean;
}>): Promise<InstrumentDefinition> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('system_instruments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return dbInstrumentToDefinition(data);
}

export async function deleteSystemInstrument(id: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('system_instruments')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function duplicateSystemInstrument(id: string, newId: string): Promise<InstrumentDefinition> {
  const original = await getSystemInstrumentById(id);
  if (!original) throw new Error('Instrument not found');

  return createSystemInstrument({
    id: newId,
    name: `${original.name} (Copy)`,
    category_id: original.category,
    type: original.type,
    icon: original.icon,
    description: original.description,
    tags: original.tags,
    layout: original.layout,
    note_range_min: original.noteRange?.min,
    note_range_max: original.noteRange?.max,
    synth_config: original.synthConfig as Record<string, unknown> | undefined,
    drum_map: original.drumMap,
  });
}

// Convert DB format to InstrumentDefinition
function dbInstrumentToDefinition(db: DbInstrument): InstrumentDefinition {
  return {
    id: db.id,
    name: db.name,
    category: db.category_id,
    type: db.type,
    icon: db.icon,
    description: db.description || undefined,
    tags: db.tags,
    layout: db.layout,
    noteRange: db.note_range_min && db.note_range_max
      ? { min: db.note_range_min, max: db.note_range_max }
      : undefined,
    synthConfig: db.synth_config as unknown as InstrumentDefinition['synthConfig'],
    drumMap: db.drum_map as unknown as InstrumentDefinition['drumMap'],
  };
}

// =============================================================================
// PROMOTE USER LOOP TO SYSTEM
// =============================================================================

export async function promoteUserLoopToSystem(
  userLoopId: string,
  adminId: string,
  overrides?: Partial<{
    id: string;
    subcategory_id: string;
  }>
): Promise<LoopDefinition> {
  const supabase = getSupabaseClient();

  // Fetch the user loop
  const { data: userLoop, error: fetchError } = await supabase
    .from('user_custom_loops')
    .select('*')
    .eq('id', userLoopId)
    .single();

  if (fetchError) throw fetchError;
  if (!userLoop) throw new Error('User loop not found');

  // Create system loop from user loop
  const systemLoop = await createSystemLoop({
    id: overrides?.id || `promoted-${userLoopId}`,
    name: userLoop.name,
    category_id: userLoop.category,
    subcategory_id: overrides?.subcategory_id || userLoop.subcategory,
    bpm: userLoop.bpm,
    bars: userLoop.bars,
    time_signature: userLoop.time_signature,
    key: userLoop.key,
    midi_data: userLoop.midi_data,
    sound_preset: userLoop.sound_preset,
    tags: userLoop.tags,
    intensity: userLoop.intensity,
    complexity: userLoop.complexity,
    description: userLoop.description,
    created_by: adminId,
  });

  // Mark user loop as promoted
  await supabase
    .from('user_custom_loops')
    .update({
      is_promoted: true,
      promoted_at: new Date().toISOString(),
      promoted_by: adminId,
    })
    .eq('id', userLoopId);

  return systemLoop;
}

// =============================================================================
// FULL LIBRARY FETCH (for client-side caching)
// =============================================================================

export interface FullLoopLibrary {
  categories: LoopCategoryInfo[];
  loops: LoopDefinition[];
  presets: InstantBandPreset[];
}

export async function getFullLoopLibrary(): Promise<FullLoopLibrary> {
  const [categories, loops, presets] = await Promise.all([
    getAllLoopCategories(),
    getAllSystemLoops({ activeOnly: true }),
    getAllInstantBandPresets(true),
  ]);

  return { categories, loops, presets };
}

export interface FullInstrumentLibrary {
  categories: InstrumentCategory[];
  instruments: InstrumentDefinition[];
}

export async function getFullInstrumentLibrary(): Promise<FullInstrumentLibrary> {
  const [categories, instruments] = await Promise.all([
    getAllInstrumentCategories(),
    getAllSystemInstruments({ activeOnly: true }),
  ]);

  return { categories, instruments };
}
