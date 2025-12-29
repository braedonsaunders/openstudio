/**
 * Shared animation coordinator for all waveform components.
 * Uses a single requestAnimationFrame loop to batch updates,
 * throttled to 30 FPS for performance.
 */

type DrawCallback = (timestamp: number, deltaTime: number) => void;

const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

class WaveformAnimationCoordinator {
  private callbacks: Map<string, DrawCallback> = new Map();
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private isRunning: boolean = false;

  /**
   * Register a waveform's draw callback
   */
  register(id: string, callback: DrawCallback): void {
    this.callbacks.set(id, callback);

    // Start the loop if this is the first registration
    if (!this.isRunning && this.callbacks.size > 0) {
      this.start();
    }
  }

  /**
   * Unregister a waveform's draw callback
   */
  unregister(id: string): void {
    this.callbacks.delete(id);

    // Stop the loop if no more callbacks
    if (this.callbacks.size === 0) {
      this.stop();
    }
  }

  private start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.tick(this.lastFrameTime);
  }

  private stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isRunning = false;
  }

  private tick = (timestamp: number): void => {
    if (!this.isRunning) return;

    const elapsed = timestamp - this.lastFrameTime;

    // Throttle to target FPS
    if (elapsed >= FRAME_INTERVAL) {
      const deltaTime = elapsed;
      this.lastFrameTime = timestamp - (elapsed % FRAME_INTERVAL);

      // Call all registered draw callbacks
      this.callbacks.forEach((callback) => {
        try {
          callback(timestamp, deltaTime);
        } catch (e) {
          // Silently ignore errors in individual callbacks
          console.error('Waveform draw error:', e);
        }
      });
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  };
}

// Singleton instance
export const waveformAnimationCoordinator = new WaveformAnimationCoordinator();
