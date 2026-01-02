'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

/**
 * Hook to track world view visibility and pause all expensive operations when not visible.
 * Returns isVisible boolean and a ref to attach to the container element.
 *
 * When isVisible is false:
 * - Animation loops should stop
 * - Position broadcasting should pause
 * - Audio processing for visuals should skip
 * - Spring animations should pause
 *
 * This ensures near-zero CPU usage when the world view is collapsed, tabbed away, or scrolled out of view.
 */
export function useWorldVisibility() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isTabActive, setIsTabActive] = useState(true);

  // Track element visibility with IntersectionObserver
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsVisible(entry.isIntersecting && entry.intersectionRatio > 0);
        }
      },
      {
        threshold: [0, 0.1], // Trigger when any part becomes visible/invisible
        rootMargin: '50px', // Small buffer to start animations slightly before visible
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Track tab/window visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Combined: only active if both element is visible AND tab is active
  const isActive = isVisible && isTabActive;

  return { containerRef, isVisible: isActive, isTabActive, isElementVisible: isVisible };
}

/**
 * Hook to pause/resume an animation frame loop based on visibility.
 * Automatically stops the loop when not visible.
 */
export function useVisibilityAwareAnimationFrame(
  callback: (deltaTime: number, time: number) => void,
  isVisible: boolean,
  deps: React.DependencyList = []
) {
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!isVisible) {
      // Pause: cancel any pending frame
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    // Resume: start animation loop
    lastTimeRef.current = 0;

    const animate = (time: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = time;
      }
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;

      callbackRef.current(deltaTime, time);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, ...deps]);
}

/**
 * Hook to throttle a callback and pause it when not visible.
 * Useful for position broadcasting.
 */
export function useVisibilityAwareThrottle<T extends (...args: Parameters<T>) => void>(
  callback: T,
  throttleMs: number,
  isVisible: boolean
): T {
  const lastCallRef = useRef<number>(0);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (!isVisible) return; // Skip when not visible

      const now = Date.now();
      if (now - lastCallRef.current >= throttleMs) {
        lastCallRef.current = now;
        callbackRef.current(...args);
      }
    }) as T,
    [isVisible, throttleMs]
  );
}

/**
 * Hook to manage a value that updates frequently but pauses when not visible.
 * Returns current value and setter. Updates are ignored when not visible.
 */
export function useVisibilityAwareValue<T>(
  initialValue: T,
  isVisible: boolean
): [T, (value: T) => void] {
  const [value, setValue] = useState(initialValue);
  const pendingValueRef = useRef<T | null>(null);

  const setValueIfVisible = useCallback(
    (newValue: T) => {
      if (isVisible) {
        setValue(newValue);
        pendingValueRef.current = null;
      } else {
        // Store pending value to apply when becoming visible
        pendingValueRef.current = newValue;
      }
    },
    [isVisible]
  );

  // Apply pending value when becoming visible
  useEffect(() => {
    if (isVisible && pendingValueRef.current !== null) {
      setValue(pendingValueRef.current);
      pendingValueRef.current = null;
    }
  }, [isVisible]);

  return [value, setValueIfVisible];
}
