/** Convert a provider's decimal amount (e.g. 12.3) to integer cents without float drift. */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) throw new Error(`Invalid amount: ${amount}`);
  return Math.round(amount * 100);
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}:${compact}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      ...(compact
        ? { notation: 'compact', maximumFractionDigits: 1 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
    formatters.set(key, f);
  }
  return f;
}

/** 123456 → "$1,234.56". `compact` → "$1.2K" for chart axes. */
export function formatMoney(
  cents: number,
  currency = 'USD',
  opts: { compact?: boolean; signed?: boolean } = {},
): string {
  const text = formatter(currency, !!opts.compact).format(Math.abs(cents) / 100);
  if (cents < 0) return `-${text}`;
  if (opts.signed && cents > 0) return `+${text}`;
  return text;
}

/**
 * Display a transaction amount the way a bank statement does: purchases are
 * negative, money in is positive. (Stored amounts use Plaid's opposite sign.)
 */
export function formatTransactionAmount(amountCents: number, currency = 'USD'): string {
  return formatMoney(-amountCents, currency, { signed: true });
}

/** Parse user input like "1,250.5" or "$300" into cents; null when invalid. */
export function parseMoneyInput(input: string): number | null {
  const cleaned = input.replace(/[\s,$£€]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return toCents(Number(cleaned));
}
