import { describe, expect, it } from 'vitest';
import { createApiStatusStore } from '../src/lib/api-status';

function manualTimers() {
  const timers = new Map<number, () => void>();
  let next = 0;
  return {
    setTimer: (fn: () => void) => {
      timers.set(++next, fn);
      return next;
    },
    clearTimer: (h: unknown) => void timers.delete(h as number),
    fireAll: () => {
      for (const [id, fn] of [...timers]) {
        timers.delete(id);
        fn();
      }
    },
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe('api status store', () => {
  it('flags waking only after a request outlives the threshold', async () => {
    const t = manualTimers();
    const store = createApiStatusStore({ setTimer: t.setTimer, clearTimer: t.clearTimer });
    const seen: boolean[] = [];
    store.subscribe(() => seen.push(store.getSnapshot().waking));

    const d = deferred();
    const req = store.track(() => d.promise);
    expect(store.getSnapshot()).toEqual({ waking: false, inFlight: 1 });

    t.fireAll(); // slow threshold passes
    expect(store.getSnapshot().waking).toBe(true);

    d.resolve();
    await req;
    expect(store.getSnapshot()).toEqual({ waking: false, inFlight: 0 });
    expect(seen).toEqual([false, true, false]);
  });

  it('fast requests never show the banner', async () => {
    const t = manualTimers();
    const store = createApiStatusStore({ setTimer: t.setTimer, clearTimer: t.clearTimer });
    await store.track(async () => 'ok');
    t.fireAll(); // timer was cleared, nothing fires
    expect(store.getSnapshot()).toEqual({ waking: false, inFlight: 0 });
  });

  it('stays waking until every slow request settles, and clears on failure', async () => {
    const t = manualTimers();
    const store = createApiStatusStore({ setTimer: t.setTimer, clearTimer: t.clearTimer });
    const a = deferred();
    const b = deferred();
    const ra = store.track(() => a.promise);
    const rb = store.track(() => b.promise.then(() => Promise.reject(new Error('boom'))));
    t.fireAll();
    a.resolve();
    await ra;
    expect(store.getSnapshot()).toEqual({ waking: true, inFlight: 1 });
    b.resolve();
    await expect(rb).rejects.toThrow('boom');
    expect(store.getSnapshot()).toEqual({ waking: false, inFlight: 0 });
  });
});
