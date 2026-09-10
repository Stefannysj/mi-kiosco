'use strict';

(function initializeFirebase() {
  if (!window.FIREBASE_CONFIG) {
    console.error('FIREBASE_CONFIG no está definido');
    return;
  }
  try {
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.FIREBASE_CONFIG);
    window.db = app.firestore();
    window.auth = app.auth();
    window.storage = firebase.storage();
    window.COLL = {
      products: 'products',
      categories: 'categories',
      orders: 'orders',
      config: 'config',
      chats: 'chats',
      audit: 'audit_log',
      expenses: 'expenses' // KIOSCO_NINE:EXPENSES_COLLECTION
    };
    window.FS = firebase.firestore;
    // Memory-only Firestore cache avoids retaining private admin orders on shared devices.
    // Cart persistence is handled explicitly by cart.js; offline writes are not queued.

  } catch (error) {
    console.error('Error al iniciar Firebase:', error?.message || error);
  }
})();
