/**
 * Seed (or re-seed) the demo account: `npm run seed -w @budgetwise/api`.
 * Uses the same Firestore/emulator configuration as the API.
 */
import { loadConfig } from '../config';
import { createDeps } from '../deps';
import { seedDemoUser } from '../services/demo';

const log = {
  info: (o: unknown, m?: string) => console.warn(m ?? '', o),
  warn: (o: unknown, m?: string) => console.warn(m ?? '', o),
  error: (o: unknown, m?: string) => console.error(m ?? '', o),
};

const config = loadConfig();
const deps = createDeps(config, log);
await seedDemoUser(deps);
const transactions = await deps.repo.listTransactions(config.demo.uid);
console.warn(`Seeded demo user "${config.demo.uid}" with ${transactions.length} transactions.`);
process.exit(0);
