/** "3 minutes ago" style relative time for sync timestamps. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never';
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** +12% / −8% for month-over-month deltas. */
export function formatChange(ratio: number): string {
  const pct = Math.round(Math.abs(ratio) * 100);
  return `${ratio >= 0 ? '+' : '−'}${pct}%`;
}
