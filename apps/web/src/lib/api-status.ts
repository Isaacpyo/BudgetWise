/**
 * Tracks in-flight API requests so the UI can say "Waking server…" when the
 * free Render instance is cold-starting (first request can take ~30–60s).
 * Framework-free so it is unit-testable; React reads it via useSyncExternalStore.
 */
export interface ApiStatusSnapshot {
  /** At least one request has been running longer than the slow threshold. */
  waking: boolean;
  inFlight: number;
}

export interface ApiStatusStore {
  getSnapshot(): ApiStatusSnapshot;
  subscribe(listener: () => void): () => void;
  /** Wrap a request; flags `waking` if it outlives `slowAfterMs`. */
  track<T>(run: () => Promise<T>): Promise<T>;
}

export function createApiStatusStore(
  opts: {
    slowAfterMs?: number;
    setTimer?: (fn: () => void, ms: number) => unknown;
    clearTimer?: (handle: unknown) => void;
  } = {},
): ApiStatusStore {
  const slowAfterMs = opts.slowAfterMs ?? 2500;
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let snapshot: ApiStatusSnapshot = { waking: false, inFlight: 0 };
  let slowCount = 0;
  const listeners = new Set<() => void>();

  const publish = (next: ApiStatusSnapshot) => {
    if (next.waking === snapshot.waking && next.inFlight === snapshot.inFlight) return;
    snapshot = next;
    listeners.forEach((l) => l());
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async track(run) {
      let slow = false;
      publish({ waking: slowCount > 0, inFlight: snapshot.inFlight + 1 });
      const timer = setTimer(() => {
        slow = true;
        slowCount += 1;
        publish({ waking: true, inFlight: snapshot.inFlight });
      }, slowAfterMs);
      try {
        return await run();
      } finally {
        clearTimer(timer);
        if (slow) slowCount -= 1;
        publish({ waking: slowCount > 0, inFlight: snapshot.inFlight - 1 });
      }
    },
  };
}
