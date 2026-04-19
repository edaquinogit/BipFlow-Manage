/**
 * ========================================
 * ⏱️ DEBOUNCE & THROTTLE UTILITIES
 * ========================================
 *
 * High-performance debouncing utility optimized for Vue 3 reactive systems.
 * Prevents excessive API calls during rapid user input (e.g., search typing).
 */

/**
 * Debounce configuration options
 */
export interface DebounceOptions {
  /** Delay before execution in milliseconds */
  delay: number;

  /** Maximum time to wait before forcing execution */
  maxWait?: number;

  /** Execute on leading edge instead of trailing edge */
  leading?: boolean;

  /** Execute on trailing edge (default: true) */
  trailing?: boolean;
}

/**
 * Debounced function result type
 */
export interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
  /** Call the debounced function */
  (...args: Parameters<T>): void;

  /** Cancel any pending execution */
  cancel(): void;

  /** Flush any pending execution immediately */
  flush(): void;

  /** Check if execution is pending */
  isPending(): boolean;
}

/**
 * Creates a debounced version of a function.
 *
 * Delays function execution until after the specified delay has elapsed
 * since the last invocation. Useful for search/filter inputs.
 *
 * @param func - Function to debounce
 * @param options - Debounce configuration
 * @returns Debounced function with cancel/flush methods
 *
 * @example
 * ```ts
 * const debouncedSearch = debounce(
 *   async (term: string) => {
 *     const results = await searchAPI(term);
 *   },
 *   { delay: 400, maxWait: 1000 }
 * );
 *
 * // In component
 * watch(searchTerm, () => debouncedSearch(searchTerm.value));
 *
 * // Clean up on unmount
 * onBeforeUnmount(() => debouncedSearch.cancel());
 * ```
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  options: DebounceOptions
): DebouncedFunction<T> {
  const {
    delay,
    maxWait,
    leading = false,
    trailing = true,
  } = options;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let maxTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastCallTime: number | undefined;
  let lastInvokeTime = 0;
  let lastArgs: unknown[] = [];

  function invokeFunc(args: unknown[]): void {
    lastInvokeTime = Date.now();
    func(...args);
    lastArgs = [];
  }

  function shouldInvoke(time: number): boolean {
    const timeSinceLastCall = time - (lastCallTime ?? 0);
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === undefined ||
      timeSinceLastCall >= delay ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  }

  function timerExpired(): void {
    const time = Date.now();
    if (shouldInvoke(time)) {
      trailingEdge();
    } else {
      const timeSinceLastCall = Date.now() - (lastCallTime ?? 0);
      const timeWaitingForMaxWait = maxWait
        ? Math.min(delay - timeSinceLastCall, maxWait - (time - lastInvokeTime))
        : delay - timeSinceLastCall;

      timeoutId = setTimeout(timerExpired, timeWaitingForMaxWait);
    }
  }

  function trailingEdge(): void {
    timeoutId = null;

    if (trailing && lastArgs.length) {
      invokeFunc(lastArgs);
    }
    lastArgs = [];
  }

  function cancel(): void {
    if (timeoutId !== null) clearTimeout(timeoutId);
    if (maxTimeoutId !== null) clearTimeout(maxTimeoutId);
    lastCallTime = undefined;
    lastArgs = [];
  }

  function flush(): void {
    if (timeoutId === null) {
      invokeFunc(lastArgs);
    } else {
      trailingEdge();
    }
  }

  function isPending(): boolean {
    return timeoutId !== null;
  }

  function debounced(...args: unknown[]): void {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastCallTime = time;
    lastArgs = args;

    if (isInvoking) {
      if (timeoutId === null && leading) {
        invokeFunc(args);
      }
      if (timeoutId !== null) clearTimeout(timeoutId);

      if (maxWait !== undefined && maxTimeoutId === null) {
        const timeWaitingForMaxWait = maxWait - (time - lastInvokeTime);
        maxTimeoutId = setTimeout(() => {
          const time = Date.now();
          if (shouldInvoke(time)) {
            trailingEdge();
          }
          maxTimeoutId = null;
        }, timeWaitingForMaxWait);
      }

      timeoutId = setTimeout(timerExpired, delay);
    }
  }

  debounced.cancel = cancel;
  debounced.flush = flush;
  debounced.isPending = isPending;

  return debounced as DebouncedFunction<T>;
}

/**
 * Vue 3 composable-friendly debounce wrapper.
 *
 * Automatically handles cleanup on component unmount.
 * Returns the debounced function and a cleanup function.
 *
 * @param func - Function to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns Tuple of [debouncedFunction, cleanupFunction]
 */
export function useDebounceFn<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): [DebouncedFunction<T>, () => void] {
  const debouncedFunc = debounce(func, {
    delay,
    maxWait: delay * 2.5,
    trailing: true,
  });

  const cleanup = () => {
    debouncedFunc.cancel();
  };

  return [debouncedFunc, cleanup];
}
