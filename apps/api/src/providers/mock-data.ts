/**
 * Deterministic generator for realistic sandbox transactions. The same
 * (seed, date) always yields the same transactions, so repeated syncs are
 * idempotent and tests are stable.
 */
import { toCents, type Account, type PlaidCategory } from '@budgetwise/core';
import type { ProviderTransaction } from './types';

export const MOCK_ACCOUNTS: Account[] = [
  {
    id: 'checking',
    name: 'Platypus Everyday Checking',
    mask: '0000',
    type: 'depository',
    subtype: 'checking',
  },
  {
    id: 'credit',
    name: 'Platypus Rewards Card',
    mask: '3333',
    type: 'credit',
    subtype: 'credit card',
  },
];

interface Template {
  merchant: string | null;
  name: string;
  pfc: PlaidCategory | null;
  min: number;
  max: number;
  account: 'checking' | 'credit';
}

const pfc = (primary: string, detailed: string): PlaidCategory => ({ primary, detailed });

/** Bills and income on fixed days of the month. */
const MONTHLY: Array<{ day: number } & Template> = [
  {
    day: 1,
    merchant: null,
    name: 'GREENVIEW APARTMENTS RENT',
    pfc: pfc('RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_RENT'),
    min: 1850,
    max: 1850,
    account: 'checking',
  },
  {
    day: 1,
    merchant: 'Acme Corp',
    name: 'ACME CORP PAYROLL',
    pfc: pfc('INCOME', 'INCOME_WAGES'),
    min: -2650,
    max: -2650,
    account: 'checking',
  },
  {
    day: 15,
    merchant: 'Acme Corp',
    name: 'ACME CORP PAYROLL',
    pfc: pfc('INCOME', 'INCOME_WAGES'),
    min: -2650,
    max: -2650,
    account: 'checking',
  },
  {
    day: 3,
    merchant: 'Planet Fitness',
    name: 'PLANET FITNESS CLUB FEE',
    pfc: pfc('PERSONAL_CARE', 'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS'),
    min: 24.99,
    max: 24.99,
    account: 'credit',
  },
  {
    day: 6,
    merchant: 'PG&E',
    name: 'PG&E WEB ONLINE',
    pfc: pfc('RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY'),
    min: 58,
    max: 112,
    account: 'checking',
  },
  {
    day: 9,
    merchant: 'Netflix',
    name: 'NETFLIX.COM',
    pfc: pfc('ENTERTAINMENT', 'ENTERTAINMENT_TV_AND_MOVIES'),
    min: 15.49,
    max: 15.49,
    account: 'credit',
  },
  {
    day: 12,
    merchant: 'Comcast',
    name: 'COMCAST XFINITY INTERNET',
    pfc: pfc('RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_INTERNET_AND_CABLE'),
    min: 79.99,
    max: 79.99,
    account: 'checking',
  },
  {
    day: 18,
    merchant: 'Verizon',
    name: 'VERIZON WIRELESS PAYMENT',
    pfc: pfc('RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_TELEPHONE'),
    min: 65,
    max: 65,
    account: 'checking',
  },
  {
    day: 21,
    merchant: 'Spotify',
    name: 'SPOTIFY USA',
    pfc: pfc('ENTERTAINMENT', 'ENTERTAINMENT_MUSIC_AND_AUDIO'),
    min: 11.99,
    max: 11.99,
    account: 'credit',
  },
  {
    day: 25,
    merchant: null,
    name: 'PLATYPUS CARD AUTOPAY',
    pfc: pfc('LOAN_PAYMENTS', 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT'),
    min: 900,
    max: 1400,
    account: 'checking',
  },
];

/** Day-to-day spending with a daily probability. */
const DAILY: Array<{ p: number; options: Template[] }> = [
  {
    p: 0.42,
    options: [
      {
        merchant: 'Starbucks',
        name: 'STARBUCKS STORE 10234',
        pfc: pfc('FOOD_AND_DRINK', 'FOOD_AND_DRINK_COFFEE'),
        min: 4.25,
        max: 7.8,
        account: 'credit',
      },
      {
        merchant: 'Blue Bottle Coffee',
        name: 'BLUE BOTTLE COFFEE',
        pfc: pfc('FOOD_AND_DRINK', 'FOOD_AND_DRINK_COFFEE'),
        min: 5,
        max: 9.5,
        account: 'credit',
      },
    ],
  },
  {
    p: 0.24,
    options: [
      {
        merchant: 'Chipotle',
        name: 'CHIPOTLE 2291',
        pfc: pfc('FOOD_AND_DRINK', 'FOOD_AND_DRINK_FAST_FOOD'),
        min: 11,
        max: 18,
        account: 'credit',
      },
      {
        merchant: 'Sweetgreen',
        name: 'SWEETGREEN MISSION',
        pfc: pfc('FOOD_AND_DRINK', 'FOOD_AND_DRINK_RESTAURANT'),
        min: 13,
        max: 19,
        account: 'credit',
      },
      {
        merchant: 'Golden Dragon',
        name: 'GOLDEN DRAGON RESTAURANT',
        pfc: pfc('FOOD_AND_DRINK', 'FOOD_AND_DRINK_RESTAURANT'),
        min: 24,
        max: 68,
        account: 'credit',
      },
      {
        merchant: 'Uber Eats',
        name: 'UBER EATS *ORDER',
        pfc: pfc('FOOD_AND_DRINK', 'FOOD_AND_DRINK_RESTAURANT'),
        min: 18,
        max: 42,
        account: 'credit',
      },
    ],
  },
  {
    p: 0.2,
    options: [
      {
        merchant: 'Uber',
        name: 'UBER *TRIP',
        pfc: pfc('TRANSPORTATION', 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES'),
        min: 9,
        max: 34,
        account: 'credit',
      },
      {
        merchant: 'Lyft',
        name: 'LYFT *RIDE',
        pfc: pfc('TRANSPORTATION', 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES'),
        min: 8,
        max: 29,
        account: 'credit',
      },
      {
        merchant: 'Bay Wheels',
        name: 'BAY WHEELS BIKE SHARE',
        pfc: pfc('TRANSPORTATION', 'TRANSPORTATION_BIKES_AND_SCOOTERS'),
        min: 3.5,
        max: 8,
        account: 'credit',
      },
      {
        merchant: 'Shell',
        name: 'SHELL OIL 5774',
        pfc: pfc('TRANSPORTATION', 'TRANSPORTATION_GAS'),
        min: 38,
        max: 64,
        account: 'credit',
      },
    ],
  },
  {
    p: 0.2,
    options: [
      {
        merchant: "Trader Joe's",
        name: "TRADER JOE'S #552",
        pfc: pfc('FOOD_AND_DRINK', 'FOOD_AND_DRINK_GROCERIES'),
        min: 38,
        max: 96,
        account: 'credit',
      },
      {
        merchant: 'Whole Foods Market',
        name: 'WHOLEFDS MKT 10155',
        pfc: pfc('FOOD_AND_DRINK', 'FOOD_AND_DRINK_GROCERIES'),
        min: 45,
        max: 160,
        account: 'credit',
      },
      {
        merchant: 'Safeway',
        name: 'SAFEWAY #1711',
        pfc: pfc('FOOD_AND_DRINK', 'FOOD_AND_DRINK_GROCERIES'),
        min: 25,
        max: 110,
        account: 'credit',
      },
      // Plaid files this corner shop under general merchandise; the demo has a rule fixing it.
      {
        merchant: 'Corner Bodega',
        name: 'CORNER BODEGA LLC',
        pfc: pfc('GENERAL_MERCHANDISE', 'GENERAL_MERCHANDISE_CONVENIENCE_STORES'),
        min: 6,
        max: 28,
        account: 'credit',
      },
    ],
  },
  {
    p: 0.12,
    options: [
      {
        merchant: 'Amazon',
        name: 'AMAZON MKTPL*2K4L',
        pfc: pfc('GENERAL_MERCHANDISE', 'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES'),
        min: 14,
        max: 129,
        account: 'credit',
      },
      {
        merchant: 'Target',
        name: 'TARGET 00012',
        pfc: pfc('GENERAL_MERCHANDISE', 'GENERAL_MERCHANDISE_SUPERSTORES'),
        min: 18,
        max: 95,
        account: 'credit',
      },
      {
        merchant: 'Uniqlo',
        name: 'UNIQLO SAN FRANCISCO',
        pfc: pfc('GENERAL_MERCHANDISE', 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES'),
        min: 29,
        max: 110,
        account: 'credit',
      },
    ],
  },
  {
    p: 0.05,
    options: [
      {
        merchant: 'AMC Theatres',
        name: 'AMC METREON 16',
        pfc: pfc('ENTERTAINMENT', 'ENTERTAINMENT_TV_AND_MOVIES'),
        min: 16,
        max: 38,
        account: 'credit',
      },
      {
        merchant: 'Steam',
        name: 'STEAMGAMES.COM',
        pfc: pfc('ENTERTAINMENT', 'ENTERTAINMENT_VIDEO_GAMES'),
        min: 9.99,
        max: 59.99,
        account: 'credit',
      },
    ],
  },
  {
    p: 0.04,
    options: [
      {
        merchant: 'CVS',
        name: 'CVS/PHARMACY #0921',
        pfc: pfc('MEDICAL', 'MEDICAL_PHARMACIES_AND_SUPPLEMENTS'),
        min: 8,
        max: 46,
        account: 'credit',
      },
      {
        merchant: 'Supercuts',
        name: 'SUPERCUTS 4410',
        pfc: pfc('PERSONAL_CARE', 'PERSONAL_CARE_HAIR_AND_BEAUTY'),
        min: 28,
        max: 45,
        account: 'credit',
      },
    ],
  },
  {
    p: 0.015,
    options: [
      {
        merchant: 'Airbnb',
        name: 'AIRBNB HMQ2X8',
        pfc: pfc('TRAVEL', 'TRAVEL_LODGING'),
        min: 180,
        max: 420,
        account: 'credit',
      },
      {
        merchant: 'United Airlines',
        name: 'UNITED 0162345',
        pfc: pfc('TRAVEL', 'TRAVEL_FLIGHTS'),
        min: 160,
        max: 380,
        account: 'credit',
      },
    ],
  },
  {
    p: 0.02,
    options: [
      {
        merchant: 'Amazon',
        name: 'AMAZON MKTPL REFUND',
        pfc: pfc('GENERAL_MERCHANDISE', 'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES'),
        min: -60,
        max: -12,
        account: 'credit',
      },
    ],
  },
];

/** cyrb53 string hash → 53-bit integer. */
function hash(input: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** mulberry32 PRNG: fast, seedable, good enough for fake bank data. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function amountBetween(rand: () => number, min: number, max: number): number {
  return toCents(min + (max - min) * rand());
}

/** Transactions for one calendar day. `pending` marks the last two days as unposted. */
export function generateDay(
  seed: string,
  date: string,
  opts: { pending?: boolean } = {},
): ProviderTransaction[] {
  const rand = prng(hash(`${seed}:${date}`));
  const day = Number(date.slice(8, 10));
  const prefix = `mock_${hash(seed).toString(36)}_${date.replaceAll('-', '')}`;
  const out: ProviderTransaction[] = [];

  const push = (t: Template, amountCents: number, pending: boolean) => {
    out.push({
      id: `${prefix}_${out.length}`,
      accountId: t.account,
      name: t.name,
      merchantName: t.merchant,
      amountCents,
      currency: 'USD',
      date,
      pending,
      plaidCategory: t.pfc,
      logoUrl: null,
    });
  };

  for (const m of MONTHLY) {
    if (m.day === day) push(m, amountBetween(rand, m.min, m.max), false);
  }
  for (const group of DAILY) {
    if (rand() < group.p) {
      const t = group.options[Math.floor(rand() * group.options.length)];
      if (t) push(t, amountBetween(rand, t.min, t.max), !!opts.pending);
    }
  }
  return out;
}
