/**
 * Observable audio level — bypasses React reconciliation for real-time meters.
 *
 * Instead of: bridge → Zustand store → React render → DOM update (16ms+)
 * This does:  bridge → ObservableLevel → direct DOM write (0ms overhead)
 *
 * Components attach DOM elements via subscribe(). Level updates write directly
 * to element styles/transforms using requestAnimationFrame batching. React
 * never re-renders for meter updates.
 *
 * Inspired by OpenDAW's ObservableValue<T> / Inject.Value<T> pattern.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LevelData {
  level: number; // 0-1 RMS
  peak: number;  // 0-1 peak
}

type LevelCallback = (data: LevelData) => void;

// ---------------------------------------------------------------------------
// ObservableLevel — one per metering source
// ---------------------------------------------------------------------------

export class ObservableLevel {
  private current: LevelData = { level: 0, peak: 0 };
  private subscribers = new Set<LevelCallback>();
  private rafId: number | null = null;
  private dirty = false;

  /** Update level data. Batches notifications to next animation frame. */
  set(level: number, peak: number): void {
    this.current.level = level;
    this.current.peak = peak;
    this.dirty = true;

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.flush);
    }
  }

  /** Subscribe to level updates. Returns unsubscribe function. */
  subscribe(callback: LevelCallback): () => void {
    this.subscribers.add(callback);
    // Immediate catchup with current value
    callback(this.current);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /** Get current level without subscribing. */
  get(): LevelData {
    return this.current;
  }

  /** Clean up. */
  dispose(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.subscribers.clear();
  }

  private flush = (): void => {
    this.rafId = null;
    if (!this.dirty) return;
    this.dirty = false;

    const data = this.current;
    for (const cb of this.subscribers) {
      cb(data);
    }
  };
}

// ---------------------------------------------------------------------------
// ObservableLevelMap — manages multiple sources (users, tracks)
// ---------------------------------------------------------------------------

export class ObservableLevelMap {
  private levels = new Map<string, ObservableLevel>();

  /** Get or create an observable for a source ID. */
  get(id: string): ObservableLevel {
    let obs = this.levels.get(id);
    if (!obs) {
      obs = new ObservableLevel();
      this.levels.set(id, obs);
    }
    return obs;
  }

  /** Update a source's level. */
  set(id: string, level: number, peak: number): void {
    this.get(id).set(level, peak);
  }

  /** Remove a source. */
  remove(id: string): void {
    this.levels.get(id)?.dispose();
    this.levels.delete(id);
  }

  /** Check if a source exists. */
  has(id: string): boolean {
    return this.levels.has(id);
  }

  /** Clean up all sources. */
  dispose(): void {
    for (const obs of this.levels.values()) {
      obs.dispose();
    }
    this.levels.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton instance for the app
// ---------------------------------------------------------------------------

/** Global observable level map for all audio sources. */
export const audioLevels = new ObservableLevelMap();
