import { getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../config.generated';

// Customer application only. No Firebase Authentication initialization or persisted Auth session.
const name = 'kiosco-mobile-public-local-v1';
export const firebaseApp = getApps().find(app => app.name === name) || initializeApp(firebaseConfig, name);
export const db = getFirestore(firebaseApp);
