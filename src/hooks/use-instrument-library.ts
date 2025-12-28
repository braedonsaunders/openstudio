'use client';

import { useState, useEffect, useCallback } from 'react';
import type { InstrumentDefinition, InstrumentCategory } from '@/lib/audio/instrument-registry';
import {
  getAllInstruments,
  getAllCategories,
  registerInstruments,
  registerCategory,
} from '@/lib/audio/instrument-registry';

interface InstrumentLibrary {
  categories: InstrumentCategory[];
  instruments: InstrumentDefinition[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// Cache the data
let cachedData: {
  categories: InstrumentCategory[];
  instruments: InstrumentDefinition[];
} | null = null;

let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useInstrumentLibrary(): InstrumentLibrary {
  const [data, setData] = useState<{
    categories: InstrumentCategory[];
    instruments: InstrumentDefinition[];
  }>({
    categories: cachedData?.categories || getAllCategories(),
    instruments: cachedData?.instruments || getAllInstruments(),
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
      const response = await fetch('/api/instruments/library');

      if (!response.ok) {
        throw new Error('Failed to fetch instrument library');
      }

      const libraryData = await response.json();

      // Validate the response has expected structure
      if (libraryData.instruments && libraryData.instruments.length > 0) {
        cachedData = libraryData;
        cacheTimestamp = Date.now();
        setData(libraryData);

        // Also update the in-memory registry for components that use it directly
        libraryData.categories.forEach((cat: InstrumentCategory) => {
          registerCategory(cat);
        });
        registerInstruments(libraryData.instruments);
      } else {
        // If database is empty, use fallback data
        cachedData = {
          categories: getAllCategories(),
          instruments: getAllInstruments(),
        };
        cacheTimestamp = Date.now();
        setData(cachedData);
      }
    } catch (err) {
      console.error('Failed to fetch instrument library, using fallback:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));

      // Use fallback data
      setData({
        categories: getAllCategories(),
        instruments: getAllInstruments(),
      });
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
    instruments: data.instruments,
    isLoading,
    error,
    refresh,
  };
}

// Helper functions
export function getInstrumentById(
  instruments: InstrumentDefinition[],
  id: string
): InstrumentDefinition | undefined {
  return instruments.find((inst) => inst.id === id);
}

export function getInstrumentsByCategory(
  instruments: InstrumentDefinition[],
  category: string
): InstrumentDefinition[] {
  return instruments.filter((inst) => inst.category === category);
}

export function getInstrumentsByType(
  instruments: InstrumentDefinition[],
  type: 'synth' | 'drums' | 'sampler'
): InstrumentDefinition[] {
  return instruments.filter((inst) => inst.type === type);
}

// Invalidate cache (call this after admin updates)
export function invalidateInstrumentLibraryCache(): void {
  cachedData = null;
  cacheTimestamp = 0;
}
