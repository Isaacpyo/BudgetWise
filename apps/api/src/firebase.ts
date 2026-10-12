import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Config } from './config';
import type { AuthService } from './services/deps';

/** Accepts the service-account JSON either raw or base64-encoded (easier in dashboards). */
export function parseServiceAccount(raw: string): Record<string, string> {
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const json = JSON.parse(text) as Record<string, string>;
  if (!json.project_id || !json.client_email || !json.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing project_id, client_email or private_key');
  }
  return json;
}

export function initFirebase(config: Config): { app: App; db: Firestore; auth: AuthService } {
  // We never run on Google Cloud; skip google-auth's slow metadata-server probe.
  process.env.METADATA_SERVER_DETECTION ??= 'none';
  const existing = getApps()[0];
  let app: App;
  if (existing) {
    app = existing;
  } else if (config.firebase.serviceAccount && !config.firebase.usingEmulators) {
    const sa = parseServiceAccount(config.firebase.serviceAccount);
    app = initializeApp({ credential: cert(sa), projectId: sa.project_id });
  } else {
    // Emulators (FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST) need only a project id.
    app = initializeApp({ projectId: config.firebase.projectId });
  }

  const db = getFirestore(app);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // settings() throws if Firestore was already used (hot reload); safe to ignore.
  }

  const adminAuth = getAuth(app);
  const auth: AuthService = {
    async verifyIdToken(token) {
      const decoded = await adminAuth.verifyIdToken(token);
      return { uid: decoded.uid, email: decoded.email ?? null };
    },
    createCustomToken: (uid, claims) => adminAuth.createCustomToken(uid, claims),
  };
  return { app, db, auth };
}
