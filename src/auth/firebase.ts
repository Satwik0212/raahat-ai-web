import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const metaEnv = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || '',
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: metaEnv.VITE_FIREBASE_APP_ID || ''
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey.trim().length > 0 &&
  !firebaseConfig.apiKey.includes('YOUR_')
);

let authInstance: Auth | null = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    console.log('[FIREBASE AUTH] Initialized successfully with project:', firebaseConfig.projectId);
  } catch (err) {
    console.warn('[FIREBASE AUTH] Initialization error:', err);
    authInstance = null;
  }
} else {
  console.info('[DEV AUTH MODE] Firebase web config empty in .env — Dev Auth Mode active. Any credentials accepted.');
}

export const firebaseAuth = authInstance;
