import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  User as FirebaseUser 
} from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured } from './firebase';
import { requestApi } from '../api/client';

export interface AuthUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  isDevAuth: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  ready: false,
  isDevAuth: !isFirebaseConfigured,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('raahat_auth_token'));
  const [ready, setReady] = useState<boolean>(false);

  const isDevAuth = !isFirebaseConfigured || !firebaseAuth;

  const syncBackendUser = async (authToken: string) => {
    try {
      localStorage.setItem('raahat_auth_token', authToken);
      const res = await requestApi<any>('/users/me', 'GET');
      console.log('[AUTH SYNC] Backend synced user:', res);
    } catch (err) {
      console.warn('[AUTH SYNC] Backend sync note (AUTH_DISABLED or offline):', err);
    }
  };

  useEffect(() => {
    if (!isDevAuth && firebaseAuth) {
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser: FirebaseUser | null) => {
        if (fbUser) {
          try {
            const idToken = await fbUser.getIdToken();
            setToken(idToken);
            const u: AuthUser = {
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'RAAHAT User'
            };
            setUser(u);
            syncBackendUser(idToken);
          } catch (e) {
            console.error('[AUTH] Failed to retrieve IdToken:', e);
            setUser(null);
            setToken(null);
          }
        } else {
          setUser(null);
          setToken(null);
          localStorage.removeItem('raahat_auth_token');
        }
        setReady(true);
      });
      return () => unsubscribe();
    } else {
      // Dev auth fallback initialization
      const savedToken = localStorage.getItem('raahat_auth_token');
      if (savedToken) {
        setToken(savedToken);
        setUser({
          uid: 'dev_user_999',
          email: 'santosh@raahat.dev',
          displayName: 'Santosh Ray (Dev Mode)'
        });
      } else {
        // Auto sign-in in dev mode if nothing saved
        const devToken = 'dev_token_bypass';
        setToken(devToken);
        setUser({
          uid: 'dev_user_999',
          email: 'santosh@raahat.dev',
          displayName: 'Santosh Ray (Dev Mode)'
        });
        localStorage.setItem('raahat_auth_token', devToken);
      }
      setReady(true);
    }
  }, [isDevAuth]);

  const signIn = async (email: string, pass: string) => {
    if (!isDevAuth && firebaseAuth) {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, pass);
      const idToken = await credential.user.getIdToken();
      setToken(idToken);
      setUser({
        uid: credential.user.uid,
        email: credential.user.email,
        displayName: credential.user.displayName || credential.user.email?.split('@')[0] || 'User'
      });
      await syncBackendUser(idToken);
    } else {
      // Dev auth mode: accept any credentials
      console.log('[DEV AUTH] Signed in with email:', email);
      const devToken = `dev_token_${Date.now()}`;
      setToken(devToken);
      const u: AuthUser = {
        uid: `dev_${Date.now()}`,
        email: email || 'dev@raahat.app',
        displayName: email ? email.split('@')[0] : 'Dev User'
      };
      setUser(u);
      localStorage.setItem('raahat_auth_token', devToken);
      await syncBackendUser(devToken);
    }
  };

  const signUp = async (email: string, pass: string) => {
    if (!isDevAuth && firebaseAuth) {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email, pass);
      const idToken = await credential.user.getIdToken();
      setToken(idToken);
      setUser({
        uid: credential.user.uid,
        email: credential.user.email,
        displayName: credential.user.displayName || credential.user.email?.split('@')[0] || 'User'
      });
      await syncBackendUser(idToken);
    } else {
      console.log('[DEV AUTH] Signed up with email:', email);
      const devToken = `dev_token_${Date.now()}`;
      setToken(devToken);
      const u: AuthUser = {
        uid: `dev_${Date.now()}`,
        email: email || 'dev@raahat.app',
        displayName: email ? email.split('@')[0] : 'Dev User'
      };
      setUser(u);
      localStorage.setItem('raahat_auth_token', devToken);
      await syncBackendUser(devToken);
    }
  };

  const signOut = async () => {
    if (!isDevAuth && firebaseAuth) {
      await fbSignOut(firebaseAuth);
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('raahat_auth_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, ready, isDevAuth, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
