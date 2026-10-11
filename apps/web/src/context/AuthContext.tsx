import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { auth } from '@/lib/firebase';

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signInDemo(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [initializing, setInitializing] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, (next) => {
        setUser(next);
        setInitializing(false);
        // Ensure the profile exists (and wake the API) without blocking the UI.
        if (next) api.session().catch((err) => console.warn('session bootstrap failed', err));
      }),
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      async signIn(email, password) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      async signUp(email, password) {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      },
      async signInDemo() {
        const { customToken } = await api.demoSession();
        await signInWithCustomToken(auth, customToken);
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(auth, email.trim());
      },
      async signOut() {
        await firebaseSignOut(auth);
      },
    }),
    [user, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
