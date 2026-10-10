import { describe, expect, it } from 'vitest';
import { generateDay } from '../src/providers/mock-data';
import { MockProvider } from '../src/providers/mock';

const at = (iso: string) => () => new Date(`${iso}T12:00:00.000Z`);

describe('mock data generator', () => {
  it('is deterministic per seed and day', () => {
    expect(generateDay('seed-a', '2026-10-01')).toEqual(generateDay('seed-a', '2026-10-01'));
    expect(generateDay('seed-a', '2026-10-02')).not.toEqual(generateDay('seed-b', '2026-10-02'));
  });

  it('posts rent and salary on the 1st', () => {
    const names = generateDay('seed', '2026-10-01').map((t) => t.name);
    expect(names).toContain('GREENVIEW APARTMENTS RENT');
    expect(names).toContain('ACME CORP PAYROLL');
  });

  it('produces Plaid-shaped data with unique ids', () => {
    const days = Array.from(
      { length: 60 },
      (_, i) => `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
    );
    const all = [...new Set(days)].flatMap((d) => generateDay('seed', d));
    expect(new Set(all.map((t) => t.id)).size).toBe(all.length);
    for (const t of all) {
      expect(Number.isInteger(t.amountCents)).toBe(true);
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(t.plaidCategory?.primary).toBeTruthy();
    }
  });
});

describe('MockProvider', () => {
  it('only exchanges its own public tokens', async () => {
    const p = new MockProvider();
    await expect(p.exchangePublicToken('public-sandbox-xyz')).rejects.toThrow('sandbox bank');
    const { accessToken, itemId } = await p.exchangePublicToken('public-mock-platypus-1');
    expect(accessToken).toMatch(/^access-mock-/);
    expect(itemId).toMatch(/^item-mock-/);
  });

  it('syncs history first, then only new days, re-sending the pending window', async () => {
    const first = await new MockProvider({
      now: at('2026-10-10'),
      historyDays: 30,
    }).syncTransactions('access-mock-x', null);
    expect(first.added.length).toBeGreaterThan(30);
    expect(first.added.every((t) => t.date >= '2026-09-11' && t.date <= '2026-10-10')).toBe(true);
    expect(first.nextCursor).toBe('2026-10-10');
    expect(first.added.filter((t) => t.pending).every((t) => t.date >= '2026-10-09')).toBe(true);

    const later = await new MockProvider({
      now: at('2026-10-13'),
      historyDays: 30,
    }).syncTransactions('access-mock-x', first.nextCursor);
    expect(later.added.every((t) => t.date >= '2026-10-11')).toBe(true);
    expect(later.modified.every((t) => t.date === '2026-10-09' || t.date === '2026-10-10')).toBe(
      true,
    );
    // Yesterday's pending purchases have now posted.
    expect(later.modified.some((t) => t.pending)).toBe(false);
  });

  it('is idempotent within a day', async () => {
    const p = new MockProvider({ now: at('2026-10-10'), historyDays: 10 });
    const first = await p.syncTransactions('access-mock-x', null);
    const again = await p.syncTransactions('access-mock-x', first.nextCursor);
    expect(again.added).toEqual([]);
    expect(again.modified.map((t) => t.id)).toEqual(
      first.added.filter((t) => t.date >= '2026-10-09').map((t) => t.id),
    );
  });
});
