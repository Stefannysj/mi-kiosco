import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { firebaseConfig } from '../config.generated';

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
function initializeClientAuth() {
  if (Platform.OS === 'web') return FirebaseAuth.getAuth(firebaseApp);
  try {
    return FirebaseAuth.initializeAuth(firebaseApp, {
      persistence: FirebaseAuth.getReactNativePersistence(AsyncStorage)
    });
  } catch (error) {
    if (error.code === 'auth/already-initialized') return FirebaseAuth.getAuth(firebaseApp);
    throw error;
  }
}
export const auth = initializeClientAuth();
const ready = new Promise(resolve => {
  const unsubscribe = FirebaseAuth.onAuthStateChanged(auth, () => { unsubscribe(); resolve(); });
});
let pending = null;
export async function ensureClient() {
  await ready;
  if (auth.currentUser) return auth.currentUser;
  if (!pending) pending = FirebaseAuth.signInAnonymously(auth).then(result => result.user).finally(() => { pending = null; });
  return pending;
}
