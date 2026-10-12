/**
 * Calendar helpers on plain strings (YYYY-MM-DD dates, YYYY-MM month keys).
 * Bank transactions are calendar dates, not instants, so everything here is
 * timezone-free arithmetic in UTC.
 */

const MONTH_RE = /^(\d{4})-(\d{2})$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parseMonth(month: string): { year: number; month: number } {
  const m = MONTH_RE.exec(month);
  if (!m) throw new Error(`Invalid month key: ${month}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function isIsoDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

export function isMonthKey(value: string): boolean {
  const m = MONTH_RE.exec(value);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

/** Date → YYYY-MM-DD using its UTC calendar day. */
export function toIsoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Date → YYYY-MM-DD using the device's local calendar day ("today" for the user). */
export function toLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const { year, month: m } = parseMonth(month);
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

export function addDays(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return toIsoDate(new Date(Date.UTC(y, m - 1, d + delta)));
}

export function daysInMonth(month: string): number {
  const { year, month: m } = parseMonth(month);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

/** Inclusive first and last calendar day of a month. */
export function monthBounds(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: `${month}-${pad(daysInMonth(month))}` };
}

/** The `count` months ending at (and including) `endMonth`, oldest first. */
export function lastMonths(endMonth: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(endMonth, i - count + 1));
}

/** "2026-10" → "Oct 2026"; with `short`, "Oct". */
export function formatMonth(month: string, opts: { short?: boolean } = {}): string {
  const { year, month: m } = parseMonth(month);
  const name = MONTH_NAMES[m - 1] ?? '';
  return opts.short ? name : `${name} ${year}`;
}

/** "2026-10-04" → "4 Oct". */
export function formatDay(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTH_NAMES[m - 1] ?? ''}`;
}

export function dayOfMonth(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}
