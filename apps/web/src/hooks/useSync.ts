import { useCallback, useState } from 'react';
import { api, errorMessage } from '@/lib/api';

/** "Sync now": pulls new transactions for every linked bank. */
export function useSync() {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const { items } = await api.sync();
      const failed = items.filter((i) => !i.ok);
      const added = items.reduce((n, i) => n + i.added, 0);
      if (failed.length) setError(failed.map((f) => f.error).join(' '));
      else if (items.some((i) => !i.ready))
        setMessage('Your bank is still preparing transactions. Try again in a minute.');
      else
        setMessage(
          added
            ? `Imported ${added} new transaction${added === 1 ? '' : 's'}.`
            : 'Everything is up to date.',
        );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSyncing(false);
    }
  }, []);

  return { sync, syncing, message, error };
}
