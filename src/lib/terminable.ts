/**
 * Terminable / Terminator — deterministic resource cleanup pattern.
 *
 * Inspired by OpenDAW's Terminable/Terminator RAII pattern. Every resource
 * that needs cleanup (subscriptions, event listeners, intervals, audio nodes,
 * WebRTC connections) is owned by a Terminator. When terminate() is called,
 * resources are torn down in LIFO order (last acquired = first released).
 *
 * Usage:
 *   const session = new Terminator();
 *
 *   // Own a resource — returns the resource for immediate use
 *   const realtime = session.own(createRealtimeConnection());
 *
 *   // Own a cleanup function directly
 *   session.add(() => clearInterval(timerId));
 *
 *   // Own an interval — auto-cleared on terminate
 *   session.interval(() => broadcastPosition(), 5000);
 *
 *   // Tear down everything in reverse order
 *   session.terminate();
 */

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Any resource that can be cleaned up. */
export interface Terminable {
  terminate(): void;
}

/** Wraps any async disconnect/leave/close into a Terminable. */
export function terminable(fn: () => void | Promise<void>): Terminable {
  return {
    terminate() {
      try {
        const result = fn();
        if (result instanceof Promise) {
          result.catch((err) =>
            console.warn('[Terminable] Async cleanup error:', err)
          );
        }
      } catch (err) {
        console.warn('[Terminable] Sync cleanup error:', err);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Terminator — owns resources, tears them down LIFO
// ---------------------------------------------------------------------------

export class Terminator implements Terminable {
  private resources: Terminable[] = [];
  private terminated = false;

  /** Take ownership of a Terminable resource. Returns the resource. */
  own<T extends Terminable>(resource: T): T {
    if (this.terminated) {
      console.warn('[Terminator] Owning resource after termination — terminating immediately');
      resource.terminate();
      return resource;
    }
    this.resources.push(resource);
    return resource;
  }

  /** Register a cleanup function. */
  add(fn: () => void | Promise<void>): void {
    this.own(terminable(fn));
  }

  /** Create and own a setInterval, auto-cleared on terminate. */
  interval(fn: () => void, ms: number): NodeJS.Timeout {
    const id = setInterval(fn, ms);
    this.add(() => clearInterval(id));
    return id;
  }

  /** Create and own a setTimeout, auto-cleared on terminate. */
  timeout(fn: () => void, ms: number): NodeJS.Timeout {
    const id = setTimeout(fn, ms);
    this.add(() => clearTimeout(id));
    return id;
  }

  /** Register an event listener with automatic removal. */
  listener<T extends EventTarget>(
    target: T,
    event: string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions
  ): void {
    target.addEventListener(event, handler, options);
    this.add(() => target.removeEventListener(event, handler, options));
  }

  /** Own an emitter-style listener (e.g. NativeBridge's on/removeListener). */
  subscribe<T>(
    subscribe: (handler: (data: T) => void) => void,
    unsubscribe: (handler: (data: T) => void) => void,
    handler: (data: T) => void
  ): void {
    subscribe(handler);
    this.add(() => unsubscribe(handler));
  }

  /** Returns true if terminate() has been called. */
  get isTerminated(): boolean {
    return this.terminated;
  }

  /** Number of owned resources. */
  get size(): number {
    return this.resources.length;
  }

  /** Tear down all owned resources in LIFO order. */
  terminate(): void {
    if (this.terminated) return;
    this.terminated = true;

    // LIFO teardown — most recently acquired resource first
    for (let i = this.resources.length - 1; i >= 0; i--) {
      this.resources[i].terminate();
    }
    this.resources.length = 0;
  }
}
