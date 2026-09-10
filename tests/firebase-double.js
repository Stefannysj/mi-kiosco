/* Offline test double. This does NOT execute Firebase Security Rules. */
(() => {
  const copy = value => value == null ? value : structuredClone(value);
  const records = new Map(Object.entries(window.__seed || {}));
  const subscriptions = new Set(), authListeners = new Set();
  let serial = 100, mode = window.__testRole || 'guest';
  function user(role) {
    return { uid: role === 'admin' ? 'admin-test' : 'client-test', phoneNumber: role === 'admin' ? '+51999999999' : null,
      isAnonymous: role !== 'admin', getIdToken: async () => 'test-token',
      getIdTokenResult: async () => ({ claims: { admin: role === 'admin' } }) };
  }
  const auth = { currentUser: mode === 'guest' ? null : user(mode),
    onAuthStateChanged(callback) { authListeners.add(callback); setTimeout(() => callback(auth.currentUser), 0); return () => authListeners.delete(callback); },
    async signInAnonymously() { auth.currentUser = user('client'); for (const callback of authListeners) await callback(auth.currentUser); return { user: auth.currentUser }; },
    async signOut() { auth.currentUser = null; for (const callback of authListeners) await callback(null); },
    async signInWithEmailAndPassword() { auth.currentUser = user('admin'); for (const callback of authListeners) await callback(auth.currentUser); return { user: auth.currentUser }; },
    async signInWithPhoneNumber() { return { confirm: async () => { auth.currentUser = user('admin'); for (const callback of authListeners) await callback(auth.currentUser); return { user: auth.currentUser }; } }; }
  };
  const denied = () => Object.assign(new Error('Missing or insufficient permissions (test double)'), { code: 'permission-denied' });
  function check(path, filters = []) {
    const admin = auth.currentUser?.uid === 'admin-test';
    if (['config/admin', 'config/staff', 'config/media'].includes(path) && !admin) throw denied();
    if (/^(audit_log|expenses|session_log)(\/|$)/.test(path) && !admin) throw denied();
    if (path === 'orders' && !admin && !filters.some(([key, , val]) => key === 'ownerId' && val === auth.currentUser?.uid)) throw denied();
    if (path.startsWith('orders/') && records.has(path) && !admin && records.get(path).ownerId !== auth.currentUser?.uid) throw denied();
  }
  function snap(path) { return { id: path.split('/').pop(), exists: records.has(path), ref: new Doc(path), data: () => copy(records.get(path)) }; }
  function material(value, old) {
    if (value?.__op === 'timestamp') return { seconds: Math.floor(Date.now() / 1000) };
    if (value?.__op === 'union') return [...new Set([...(old || []), ...value.values])];
    if (value?.__op === 'increment') return (Number(old) || 0) + value.value;
    if (Array.isArray(value)) return value.map(item => material(item));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, material(val, old?.[key])]));
    return value;
  }
  function broadcast() { for (const subscription of subscriptions) setTimeout(subscription, 0); }
  class Doc {
    constructor(path) { this.path = path; this.id = path.split('/').pop(); this.parent = new Query(path.split('/').slice(0, -1).join('/')); }
    async get() { check(this.path); return snap(this.path); }
    async set(data, options = {}) { if (window.__failProductName && this.path.startsWith('products/') && data.name === window.__failProductName) throw new Error('Error simulado en esta fila'); const old = records.get(this.path) || {}; records.set(this.path, { ...(options.merge ? old : {}), ...material(data, old) }); broadcast(); }
    async update(data) { if (!records.has(this.path)) throw new Error('not-found'); await this.set(data, { merge: true }); }
    async delete() { records.delete(this.path); broadcast(); }
    collection(name) { return new Query(this.path + '/' + name); }
    onSnapshot(callback, error) { let last = ''; const run = () => { try { check(this.path); const current = JSON.stringify(records.get(this.path)); if (current === last) return; last = current; callback(snap(this.path)); } catch (e) { error?.(e); } }; subscriptions.add(run); setTimeout(run, 0); return () => subscriptions.delete(run); }
  }
  class Query {
    constructor(path, filters = [], maximum = Infinity) { this.path = path; this.filters = filters; this.maximum = maximum; this.id = path.split('/').pop(); }
    doc(id = `auto-${++serial}`) { return new Doc(this.path + '/' + id); }
    where(key, op, value) { return new Query(this.path, [...this.filters, [key, op, value]], this.maximum); }
    orderBy() { throw new Error('Server-side sorting is prohibited by this project.'); }
    limit(maximum) { return new Query(this.path, this.filters, maximum); }
    async add(data) { const ref = this.doc(); await ref.set(data); return ref; }
    result() {
      check(this.path, this.filters);
      const docs = [...records.keys()].filter(path => path.startsWith(this.path + '/') && path.split('/').length === this.path.split('/').length + 1)
        .map(snap).filter(doc => this.filters.every(([key, op, value]) => op === '==' ? doc.data()[key] === value : true)).slice(0, this.maximum);
      return { docs, size: docs.length, empty: !docs.length, forEach: callback => docs.forEach(callback),
        docChanges: () => docs.map(doc => ({ type: 'added', doc })) };
    }
    async get(options) { window.__reads.push({path:this.path,source:options?.source}); return this.result(); }
    onSnapshot(callback, error) { let last = ''; const run = () => { try { const result = this.result(); const current = JSON.stringify(result.docs.map(d => [d.id, d.data()])); if (current === last) return; last = current; callback(result); } catch (e) { error?.(e); } }; subscriptions.add(run); setTimeout(run, 0); return () => subscriptions.delete(run); }
  }
  const db = { collection: name => new Query(name), doc: path => new Doc(path), enablePersistence: async () => {},
    async runTransaction(callback) {
      const writes = [];
      const result = await callback({ get: ref => ref.get(), set: (ref, data, options) => writes.push(() => ref.set(data, options)),
        update: (ref, data) => writes.push(() => ref.update(data)), delete: ref => writes.push(() => ref.delete()) });
      for (const write of writes) await write();
      return result;
    },
    batch() { const writes = []; return { set: (ref, data, options) => writes.push(() => ref.set(data, options)), update: (ref, data) => writes.push(() => ref.update(data)), delete: ref => writes.push(() => ref.delete()), commit: () => Promise.all(writes.map(fn => fn())) }; }
  };
  const FieldValue = { serverTimestamp: () => ({ __op: 'timestamp' }), arrayUnion: (...values) => ({ __op: 'union', values }),
    arrayRemove: (...values) => values, increment: value => ({ __op: 'increment', value }), delete: () => null };
  const firestore = Object.assign(() => db, { FieldValue, DocumentReference: Doc, CollectionReference: Query, Query,
    Timestamp: { fromDate: date => ({ seconds: +date / 1000 }), now: () => ({ seconds: Date.now() / 1000 }) } });
  const storage = { ref: path => ({ fullPath: path, delete: async () => { window.__deletedImages.push(path); },
    getDownloadURL: async () => 'https://firebasestorage.googleapis.com/v0/b/test/o/' + encodeURIComponent(path),
    put: () => ({ on: (event, progress, error, complete) => { progress({ bytesTransferred: 50, totalBytes: 100 }); progress({ bytesTransferred: 100, totalBytes: 100 }); complete(); } }) }) };
  const firebaseAuth = Object.assign(() => auth, { RecaptchaVerifier: class { clear() {} render() { return Promise.resolve(1); } } });
  const app = { firestore: () => db, auth: () => auth, storage: () => storage };
  window.firebase = { apps: [], initializeApp: () => { window.firebase.apps.push(app); return app; }, app: () => app, firestore, auth: firebaseAuth, storage: () => storage };
  window.__records = records; window.__reads = []; window.__deletedImages = []; window.__downloads = [];
  window.Chart = class { constructor(ctx, options) { this.data = options.data; this.options = options.options; this.canvas = ctx?.canvas; } destroy() {} update() {} resize() {} };
  window.Chart.defaults = { font: {}, color: '' };
  window.QRCode = { toCanvas: async () => {}, toDataURL: async () => 'data:image/png;base64,' };
  window.jsQR = () => null;
  window.XLSX = { read: () => ({ SheetNames: ['Productos'], Sheets: { Productos: {} } }),
    utils: { sheet_to_json: () => window.__importRows || [], aoa_to_sheet: rows => ({ rows }), json_to_sheet: rows => ({ rows }),
      book_new: () => ({ sheets: [] }), book_append_sheet: (book, sheet, name) => book.sheets.push({ sheet, name }) },
    writeFile: (book, name) => window.__downloads.push({ type: 'xlsx', book, name }) };
  class Pdf { constructor() { this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } }; this.images = []; this.texts = []; }
    setFont() {} setFontSize() {} setTextColor() {} setDrawColor() {} line() {} text(value) { this.texts.push(value); }
    roundedRect() {} setFillColor() {} addPage() {} setPage() {} addImage(value) { this.images.push(value); }
    splitTextToSize(text) { return [text]; } getNumberOfPages() { return 1; } save(name) { window.__downloads.push({ type: 'pdf', name, texts: this.texts, images: this.images }); } }
  window.jspdf = { jsPDF: Pdf };
})();
