// js/firebase.js — Firebase initialization
(function () {
  firebase.initializeApp(window.FIREBASE_CONFIG);
  window.db   = firebase.firestore();
  window.auth = firebase.auth();

  // Offline persistence (tabs-aware)
  window.db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') console.error(err);
  });

  window.COLL = {
    products:   'products',
    categories: 'categories',
    orders:     'orders',
    config:     'config'
  };
})();
