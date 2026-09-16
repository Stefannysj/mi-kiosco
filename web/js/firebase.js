'use strict';
(function initializeFirebase() {
  if (!window.FIREBASE_CONFIG) { console.error('FIREBASE_CONFIG no esta definido'); return; }
  try {
    const app = firebase.apps.some(item => item.name === '[DEFAULT]')
      ? firebase.app() : firebase.initializeApp(window.FIREBASE_CONFIG);
    const publicName = 'kiosco-public-local-v1';
    const publicApp = firebase.apps.find(item => item.name === publicName)
      || firebase.initializeApp(window.FIREBASE_CONFIG, publicName);
    window.adminDb = app.firestore();
    window.clientDb = publicApp.firestore();
    window.storage = firebase.storage();

    // A local facade queues administrative observers. Opening the store as a customer
    // does not call app.auth(), restore an old Auth session or create a Firebase user.
    let administrativeAuth = null;
    const observers = new Set();
    function initializeAdministrativeAuth() {
      if (!administrativeAuth) {
        administrativeAuth = app.auth();
        for (const record of observers) {
          record.stop = administrativeAuth.onAuthStateChanged(record.callback, record.error, record.complete);
        }
      }
      return administrativeAuth;
    }
    window.auth = {
      get currentUser() { return administrativeAuth?.currentUser || null; },
      onAuthStateChanged(callback, error, complete) {
        const record = { callback, error, complete, stop: null };
        observers.add(record);
        if (administrativeAuth) record.stop = administrativeAuth.onAuthStateChanged(callback, error, complete);
        else Promise.resolve().then(() => {
          if (!administrativeAuth && observers.has(record)) return callback(null);
        }).catch(problem => console.error('Observador administrativo:', problem));
        return () => { observers.delete(record); record.stop?.(); };
      },
      signInWithPhoneNumber(phone, verifier) {
        return initializeAdministrativeAuth().signInWithPhoneNumber(phone, verifier);
      },
      async signOut() { if (administrativeAuth) await administrativeAuth.signOut(); }
    };
    Object.defineProperty(window, 'db', {
      configurable: true,
      get() {
        if (window.Auth?.isClient() && !window.Auth?.isAdminLoginPending()) return window.clientDb;
        if (window.Auth?.isAdminLoginPending() || window.Auth?.hasAdministrativeAccess()
          || window.auth.currentUser?.phoneNumber) return window.adminDb;
        return window.clientDb;
      }
    });
    window.COLL = {
      products: 'products', categories: 'categories', orders: 'orders', config: 'config',
      chats: 'chats', audit: 'audit_log', expenses: 'expenses'
    };
    window.FS = firebase.firestore;
    // Restore only an explicitly saved administrative session, never a customer profile.
    let savedRole = '';
    try { savedRole = localStorage.getItem('kk_role') || ''; } catch { /* No persisted role. */ }
    if (savedRole === 'admin') initializeAdministrativeAuth();
    // Firestore uses an in-memory cache, without persisting administrative data.
  } catch (error) { console.error('Error al iniciar Firebase:', error?.message || error); }
})();
