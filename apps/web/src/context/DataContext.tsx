import {
  addMonths,
  monthBounds,
  monthOf,
  toLocalIsoDate,
  type Budget,
  type Item,
  type Rule,
  type Transaction,
  type UserProfile,
} from '@budgetwise/core';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  type FirestoreError,
} from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { db } from '@/lib/firebase';

/** How many months of history the app streams (charts show the last six). */
export const HISTORY_MONTHS = 6;

interface DataState {
  profile: UserProfile | null;
  items: Item[];
  transactions: Transaction[];
  rules: Rule[];
  budgets: Budget[];
}

interface DataContextValue extends DataState {
  loading: boolean;
  error: string | null;
  /** YYYY-MM-DD in the user's timezone. */
  today: string;
  currentMonth: string;
  /** Month selected in the month pickers (shared across tabs). */
  month: string;
  setMonth(month: string): void;
  /** Months available in the pickers, oldest first. */
  months: string[];
  retry(): void;
}

const DataContext = createContext<DataContextValue | null>(null);

type Key = keyof DataState;
const KEYS: Key[] = ['profile', 'items', 'transactions', 'rules', 'budgets'];

interface Store {
  session: string;
  data: DataState;
  loaded: Set<Key>;
  error: string | null;
}

const emptyStore = (session: string): Store => ({
  session,
  data: { profile: null, items: [], transactions: [], rules: [], budgets: [] },
  loaded: new Set(),
  error: null,
});

/**
 * Streams the signed-in user's data from Firestore. Clients only ever read;
 * every write goes through the API and comes back here through the listeners.
 */
export function DataProvider({ uid, children }: { uid: string | null; children: ReactNode }) {
  const today = toLocalIsoDate(new Date());
  const currentMonth = monthOf(today);
  const [month, setMonth] = useState(currentMonth);
  const [attempt, setAttempt] = useState(0);

  // One "session" per user/retry/month-window. When it changes, state resets
  // during render (React's "adjust state when a prop changes" pattern) and the
  // effect below resubscribes; late snapshots from an old session are ignored.
  const session = `${uid ?? ''}:${attempt}:${currentMonth}`;
  const [store, setStore] = useState<Store>(() => emptyStore(session));
  if (store.session !== session) setStore(emptyStore(session));

  useEffect(() => {
    if (!uid) return;
    const since = monthBounds(addMonths(currentMonth, -(HISTORY_MONTHS - 1))).start;
    const user = doc(db, 'users', uid);
    const update = (fn: (s: Store) => Store) =>
      setStore((s) => (s.session === session ? fn(s) : s));

    const onError = (err: FirestoreError) => {
      console.warn('firestore listener failed', err);
      const error =
        err.code === 'permission-denied'
          ? 'You do not have access to this data. Try signing out and in again.'
          : 'We could not load your data. Check your connection and try again.';
      update((s) => ({ ...s, error }));
    };
    const receive = <K extends Key>(key: K, value: DataState[K]) =>
      update((s) => ({
        ...s,
        data: { ...s.data, [key]: value },
        loaded: s.loaded.has(key) ? s.loaded : new Set(s.loaded).add(key),
      }));

    const unsubs = [
      onSnapshot(
        user,
        (snap) => receive('profile', snap.exists() ? (snap.data() as UserProfile) : null),
        onError,
      ),
      onSnapshot(
        collection(user, 'items'),
        (snap) =>
          receive(
            'items',
            snap.docs
              .map((d) => d.data() as Item)
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
          ),
        onError,
      ),
      onSnapshot(
        query(
          collection(user, 'transactions'),
          where('date', '>=', since),
          orderBy('date', 'desc'),
        ),
        (snap) =>
          receive(
            'transactions',
            snap.docs.map((d) => d.data() as Transaction),
          ),
        onError,
      ),
      onSnapshot(
        collection(user, 'rules'),
        (snap) =>
          receive(
            'rules',
            snap.docs.map((d) => d.data() as Rule),
          ),
        onError,
      ),
      onSnapshot(
        collection(user, 'budgets'),
        (snap) =>
          receive(
            'budgets',
            snap.docs.map((d) => d.data() as Budget),
          ),
        onError,
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid, currentMonth, session]);

  const value = useMemo<DataContextValue>(() => {
    const months = Array.from({ length: HISTORY_MONTHS }, (_, i) =>
      addMonths(currentMonth, i - HISTORY_MONTHS + 1),
    );
    return {
      ...store.data,
      loading: KEYS.some((k) => !store.loaded.has(k)) && !store.error,
      error: store.error,
      today,
      currentMonth,
      month,
      setMonth,
      months,
      retry: () => setAttempt((a) => a + 1),
    };
  }, [store, today, currentMonth, month]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
