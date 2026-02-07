import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ObservableLevel, ObservableLevelMap } from './observable-level';

// Mock requestAnimationFrame / cancelAnimationFrame for node test env
let rafCallbacks: Array<() => void> = [];
let rafId = 0;

beforeEach(() => {
  rafCallbacks = [];
  rafId = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    rafCallbacks.push(cb);
    return ++rafId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    // No-op for simplicity — flush won't fire for cancelled
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function flushRaf() {
  const cbs = [...rafCallbacks];
  rafCallbacks = [];
  cbs.forEach(cb => cb());
}

// ---------------------------------------------------------------------------
// ObservableLevel
// ---------------------------------------------------------------------------

describe('ObservableLevel', () => {
  it('starts at zero', () => {
    const obs = new ObservableLevel();
    expect(obs.get()).toEqual({ level: 0, peak: 0 });
  });

  it('subscriber gets immediate catchup value', () => {
    const obs = new ObservableLevel();
    obs.set(0.5, 0.8);
    flushRaf();

    const callback = vi.fn();
    obs.subscribe(callback);
    // Catchup is synchronous — called immediately with current value
    expect(callback).toHaveBeenCalledWith({ level: 0.5, peak: 0.8 });
  });

  it('notifies subscribers on next animation frame', () => {
    const obs = new ObservableLevel();
    const callback = vi.fn();
    obs.subscribe(callback);

    // Reset after catchup
    callback.mockClear();

    obs.set(0.7, 0.9);

    // Not notified yet (batched to rAF)
    expect(callback).not.toHaveBeenCalled();

    flushRaf();

    expect(callback).toHaveBeenCalledWith({ level: 0.7, peak: 0.9 });
  });

  it('batches multiple set() calls into one notification', () => {
    const obs = new ObservableLevel();
    const callback = vi.fn();
    obs.subscribe(callback);
    callback.mockClear();

    obs.set(0.1, 0.2);
    obs.set(0.3, 0.4);
    obs.set(0.5, 0.6);

    flushRaf();

    // Only one notification with the latest value
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ level: 0.5, peak: 0.6 });
  });

  it('unsubscribe stops notifications', () => {
    const obs = new ObservableLevel();
    const callback = vi.fn();
    const unsub = obs.subscribe(callback);
    callback.mockClear();

    unsub();

    obs.set(0.5, 0.5);
    flushRaf();

    expect(callback).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers', () => {
    const obs = new ObservableLevel();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    obs.subscribe(cb1);
    obs.subscribe(cb2);

    cb1.mockClear();
    cb2.mockClear();

    obs.set(0.5, 0.8);
    flushRaf();

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('dispose stops all notifications', () => {
    const obs = new ObservableLevel();
    const callback = vi.fn();
    obs.subscribe(callback);
    callback.mockClear();

    obs.dispose();
    obs.set(0.5, 0.5);
    flushRaf();

    expect(callback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ObservableLevelMap
// ---------------------------------------------------------------------------

describe('ObservableLevelMap', () => {
  it('creates observables on demand', () => {
    const map = new ObservableLevelMap();
    const obs = map.get('user1');
    expect(obs).toBeInstanceOf(ObservableLevel);
  });

  it('returns same instance for same id', () => {
    const map = new ObservableLevelMap();
    const a = map.get('user1');
    const b = map.get('user1');
    expect(a).toBe(b);
  });

  it('set() creates and updates', () => {
    const map = new ObservableLevelMap();
    map.set('user1', 0.5, 0.8);

    const data = map.get('user1').get();
    expect(data).toEqual({ level: 0.5, peak: 0.8 });
  });

  it('remove() disposes and deletes', () => {
    const map = new ObservableLevelMap();
    map.set('user1', 0.5, 0.8);

    map.remove('user1');

    expect(map.has('user1')).toBe(false);
  });

  it('dispose() cleans everything', () => {
    const map = new ObservableLevelMap();
    map.set('user1', 0.5, 0.5);
    map.set('user2', 0.3, 0.3);

    map.dispose();

    expect(map.has('user1')).toBe(false);
    expect(map.has('user2')).toBe(false);
  });
});
