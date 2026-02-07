import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Terminator, terminable } from './terminable';

describe('terminable()', () => {
  it('wraps a sync cleanup function', () => {
    const fn = vi.fn();
    const t = terminable(fn);
    t.terminate();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('wraps an async cleanup function without throwing', () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const t = terminable(fn);
    expect(() => t.terminate()).not.toThrow();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('catches sync errors without propagating', () => {
    const fn = vi.fn().mockImplementation(() => { throw new Error('boom'); });
    const t = terminable(fn);
    expect(() => t.terminate()).not.toThrow();
  });

  it('catches async errors without propagating', () => {
    const fn = vi.fn().mockRejectedValue(new Error('async boom'));
    const t = terminable(fn);
    expect(() => t.terminate()).not.toThrow();
  });
});

describe('Terminator', () => {
  let term: Terminator;

  beforeEach(() => {
    term = new Terminator();
  });

  describe('own()', () => {
    it('returns the owned resource', () => {
      const resource = { terminate: vi.fn() };
      const result = term.own(resource);
      expect(result).toBe(resource);
    });

    it('terminates owned resources on terminate()', () => {
      const r1 = { terminate: vi.fn() };
      const r2 = { terminate: vi.fn() };
      term.own(r1);
      term.own(r2);

      term.terminate();

      expect(r1.terminate).toHaveBeenCalledOnce();
      expect(r2.terminate).toHaveBeenCalledOnce();
    });

    it('terminates in LIFO order', () => {
      const order: number[] = [];
      const r1 = { terminate: () => order.push(1) };
      const r2 = { terminate: () => order.push(2) };
      const r3 = { terminate: () => order.push(3) };

      term.own(r1);
      term.own(r2);
      term.own(r3);
      term.terminate();

      expect(order).toEqual([3, 2, 1]);
    });

    it('immediately terminates resources owned after termination', () => {
      term.terminate();

      const resource = { terminate: vi.fn() };
      term.own(resource);

      expect(resource.terminate).toHaveBeenCalledOnce();
    });
  });

  describe('add()', () => {
    it('registers a cleanup function', () => {
      const fn = vi.fn();
      term.add(fn);
      term.terminate();
      expect(fn).toHaveBeenCalledOnce();
    });
  });

  describe('interval()', () => {
    it('creates an interval that gets cleared on terminate', () => {
      vi.useFakeTimers();
      const fn = vi.fn();

      term.interval(fn, 100);

      vi.advanceTimersByTime(350);
      expect(fn).toHaveBeenCalledTimes(3);

      term.terminate();

      vi.advanceTimersByTime(500);
      expect(fn).toHaveBeenCalledTimes(3); // No more calls after terminate
      vi.useRealTimers();
    });
  });

  describe('timeout()', () => {
    it('creates a timeout that gets cleared on terminate', () => {
      vi.useFakeTimers();
      const fn = vi.fn();

      term.timeout(fn, 100);
      term.terminate();

      vi.advanceTimersByTime(200);
      expect(fn).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('isTerminated', () => {
    it('is false before terminate()', () => {
      expect(term.isTerminated).toBe(false);
    });

    it('is true after terminate()', () => {
      term.terminate();
      expect(term.isTerminated).toBe(true);
    });
  });

  describe('size', () => {
    it('tracks owned resource count', () => {
      expect(term.size).toBe(0);

      term.add(() => {});
      expect(term.size).toBe(1);

      term.own({ terminate: () => {} });
      expect(term.size).toBe(2);
    });

    it('is zero after terminate', () => {
      term.add(() => {});
      term.add(() => {});
      term.terminate();
      expect(term.size).toBe(0);
    });
  });

  describe('double terminate', () => {
    it('is a no-op on second call', () => {
      const fn = vi.fn();
      term.add(fn);
      term.terminate();
      term.terminate();
      expect(fn).toHaveBeenCalledOnce();
    });
  });
});
