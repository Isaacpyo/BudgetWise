import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, initializeFirestore } from 'firebase/firestore';
import { createAuth } from './auth-init';
import { config } from './config';

const firstInit = getApps().length === 0;
export const firebaseApp = firstInit ? initializeApp(config.firebase) : getApp();

export const auth = createAuth(firebaseApp);

export const db = firstInit
  ? // Long-polling auto-detection keeps the realtime channel working on React Native.
    initializeFirestore(firebaseApp, { experimentalAutoDetectLongPolling: true })
  : getFirestore(firebaseApp);

if (firstInit && config.useEmulators) {
  connectAuthEmulator(auth, `http://${config.emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, config.emulatorHost, 8080);
}
