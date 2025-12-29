'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LoopDefinition, LoopCategoryInfo, InstantBandPreset } from '@/types/loops';
import { LOOP_LIBRARY } from '@/lib/audio/loop-library';

interface LoopLibrary {
  categories: LoopCategoryInfo[];
  loops: LoopDefinition[];
  presets: InstantBandPreset[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// Cache the data so we don't refetch on every modal open
let cachedData: {
  categories: LoopCategoryInfo[];
  loops: LoopDefinition[];
  presets: InstantBandPreset[];
} | null = null;

let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useLoopLibrary(): LoopLibrary {
  const [data, setData] = useState<{
    categories: LoopCategoryInfo[];
    loops: LoopDefinition[];
    presets: InstantBandPreset[];
  }>({
    categories: cachedData?.categories || [],
    loops: cachedData?.loops || [],
    presets: cachedData?.presets || [],
  });
  const [isLoading, setIsLoading] = useState(!cachedData);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    // Check if cache is still valid
    if (cachedData && Date.now() - cacheTimestamp < CACHE_DURATION) {
      setData(cachedData);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/loops/library');

      if (!response.ok) {
        throw new Error('Failed to fetch loop library');
      }

      const libraryData = await response.json();

      cachedData = {
        categories: libraryData.categories || [],
        loops: libraryData.loops || [],
        presets: libraryData.presets || [],
      };
      cacheTimestamp = Date.now();
      setData(cachedData);
    } catch (err) {
      console.error('Failed to fetch loop library:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(async () => {
    // Force refresh by clearing cache
    cachedData = null;
    cacheTimestamp = 0;
    await fetchData();
  }, [fetchData]);

  return {
    categories: data.categories,
    loops: data.loops,
    presets: data.presets,
    isLoading,
    error,
    refresh,
  };
}

export function getLoopById(loops: LoopDefinition[], id: string): LoopDefinition | undefined {
  return loops.find((loop) => loop.id === id);
}

export function getLoopsByCategory(loops: LoopDefinition[], category: string): LoopDefinition[] {
  return loops.filter((loop) => loop.category === category);
}

export function getLoopsBySubcategory(loops: LoopDefinition[], subcategory: string): LoopDefinition[] {
  return loops.filter((loop) => loop.subcategory === subcategory);
}

/**
 * Get a loop by ID from the cached library data.
 * This searches the database-fetched loops (cached).
 * Can be called from anywhere without needing React hooks.
 */
export function getCachedLoopById(id: string): LoopDefinition | undefined {
  // Check the cached data from the API (includes database loops)
  if (cachedData?.loops) {
    return cachedData.loops.find((loop) => loop.id === id);
  }
  return undefined;
}
