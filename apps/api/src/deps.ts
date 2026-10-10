import type { Config } from './config';
import { createSecretBox, devKey, parseKey } from './crypto';
import { initFirebase } from './firebase';
import { createProviders } from './providers';
import { FirestoreRepo } from './repo/firestore';
import { realSleep, type Deps, type Logger } from './services/deps';

/** Wire the production dependency graph from config. */
export function createDeps(config: Config, log: Logger): Deps {
  const { db, auth } = initFirebase(config);
  if (!config.tokenEncryptionKey) {
    log.warn(
      {},
      'TOKEN_ENCRYPTION_KEY not set; using a development key. Never do this in production.',
    );
  }
  const key = config.tokenEncryptionKey
    ? parseKey(config.tokenEncryptionKey)
    : devKey(config.firebase.projectId);
  return {
    config,
    repo: new FirestoreRepo(db),
    providers: createProviders(config),
    secrets: createSecretBox(key),
    auth,
    now: () => new Date(),
    sleep: realSleep,
    log,
  };
}
