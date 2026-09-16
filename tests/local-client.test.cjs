'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { transformFeatures, MARKER, prepare } = require('../scripts/prepare-local-client.cjs');
const ROOT = path.resolve(__dirname, '..');
const source = filename => fs.readFileSync(path.join(ROOT, filename), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function context(initial = {}) {
  const data = new Map(Object.entries(initial)), writes = [], events = [], listeners = new Map();
  const state = {
    console: { log() {}, info() {}, warn() {}, error() {} }, crypto: webcrypto, Uint8Array,
    setTimeout, clearTimeout, URL, Promise, Date, navigator: { onLine: true },
    localStorage: { getItem: key => data.get(key) ?? null,
      setItem(key, value) { writes.push([key, String(value)]); data.set(key, String(value)); },
      removeItem: key => data.delete(key) },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    dispatchEvent(event) { events.push(event.type); (listeners.get(event.type) || []).forEach(fn => fn(event)); },
    addEventListener(type, fn) { listeners.set(type, [...(listeners.get(type) || []), fn]); },
    document: { getElementById: () => null, querySelectorAll: () => [], querySelector: () => null,
      addEventListener() {}, readyState: 'loading' },
    APP_CONFIG: { currency: 'S/', phoneCountry: '+51' },
    COLL: { orders: 'orders', products: 'products', config: 'config' },
    data, writes, events, listeners
  };
  state.window = state;
  const sandbox = vm.createContext(state);
  vm.runInContext(source('web/js/auth.js'), sandbox);
  return sandbox;
}
function trapAuthentication(c) {
  Object.defineProperty(c, 'auth', { configurable: true, get() { throw new Error('Customer accessed Firebase Auth'); } });
  Object.defineProperty(c, 'firebase', { configurable: true, get() { throw new Error('Customer accessed Firebase SDK'); } });
}
test('customer login writes exactly the three requested keys without Firebase', () => {
  const c = context(); trapAuthentication(c);
  c.Auth.loginClient('  Ana  ', '999111222');
  assert.deepEqual(c.writes, [['kk_name', 'Ana'], ['kk_phone', '999111222'], ['kk_role', 'client']]);
  assert.equal(c.Auth.getRole(), 'client'); assert.equal(c.Auth.isLoggedIn(), true);
  assert.equal(c.Auth.hasAdministrativeAccess(), false);
});
test('customer profile survives reload without any Firebase user', () => {
  const c = context({ kk_name: 'Ana', kk_phone: '999111222', kk_role: 'client' }); trapAuthentication(c);
  assert.equal(c.Auth.getRole(), 'client'); assert.equal(c.Auth.getClientName(), 'Ana');
});
test('empty name and invalid phone never create a profile', () => {
  const c = context(); trapAuthentication(c);
  assert.throws(() => c.Auth.loginClient(' ', '999111222'));
  assert.throws(() => c.Auth.loginClient('Ana', '12345678'));
  assert.throws(() => c.Auth.loginClient('A'.repeat(121), '999111222'));
  assert.equal(c.writes.length, 0);
});
test('blocked localStorage reports failure instead of pretending to log in', () => {
  const c = context(); c.localStorage.setItem = () => { throw new Error('Storage denied'); };
  assert.throws(() => c.Auth.loginClient('Ana', '999111222'), /almacenamiento local/);
  assert.equal(c.Auth.isClient(), false);
});
test('customer logout never signs out Firebase and preserves the cart', () => {
  const c = context({ kk_name: 'Ana', kk_phone: '999111222', kk_role: 'client', kk_cart: '[1]' }); trapAuthentication(c);
  c.Auth.logoutClient(); assert.equal(c.Auth.getRole(), ''); assert.equal(c.data.get('kk_cart'), '[1]');
});
test('generic logout also stays local for customers', () => {
  const c = context({ kk_name: 'Ana', kk_phone: '', kk_role: 'client' }); trapAuthentication(c);
  c.Auth.logout(); assert.equal(c.data.has('kk_name'), false);
});
test('forged local admin role alone does not grant administrative access', () => {
  const c = context({ kk_role: 'admin' }); trapAuthentication(c);
  assert.equal(c.Auth.getRole(), ''); assert.equal(c.Auth.hasAdministrativeAccess(), false);
});
test('chat identifier is random, persistent and separate from public order grouping', () => {
  const c = context(); trapAuthentication(c);
  const chat = c.Auth.getChatId(), owner = c.Auth.getClientId();
  assert.match(chat, /^chat-[a-f0-9]{32}$/); assert.notEqual(chat, owner);
  assert.equal(chat, c.Auth.getChatId());
});
test('customer history uses unverified contact fields, not an Auth UID', () => {
  const c = context({ kk_name: 'Ana', kk_phone: '999111222', kk_role: 'client' }); trapAuthentication(c);
  c.clientDb = { collection: name => ({ where: (...args) => [name, ...args] }) };
  assert.deepEqual(plain(c.Auth.clientOrdersQuery()), ['orders', 'customerPhone', '==', '999111222']);
  c.data.set('kk_phone', ''); assert.deepEqual(plain(c.Auth.clientOrdersQuery()), ['orders', 'customer', '==', 'Ana']);
});
function adminFixture(c) {
  const calls = [];
  const user = { uid: 'admin-uid', phoneNumber: '+51999111222', isAnonymous: false,
    getIdTokenResult: async () => ({ claims: { admin: true } }) };
  c.auth = { currentUser: null, signOut: async () => { calls.push('signOut'); c.auth.currentUser = null; },
    signInWithPhoneNumber: async (phone, verifier) => {
      calls.push(['phone', phone, verifier.options.size]);
      return { confirm: async code => { calls.push(['confirm', code]); c.auth.currentUser = user; return { user }; } };
    }, onAuthStateChanged: callback => { c.adminObserver = callback; return () => {}; } };
  c.firebase = { auth: { RecaptchaVerifier: class {
    constructor(id, options) { this.options = options; calls.push(['recaptcha', id]); }
    clear() { calls.push('clear'); }
  } } };
  return { user, calls };
}
test('administrator still uses reCAPTCHA, Phone Auth and six-digit confirmation', async () => {
  const c = context(), f = adminFixture(c);
  const user = await c.Auth.signInPhonePassword('999111222', '123456');
  assert.equal(await c.Auth.checkIsAdmin(user), true); c.Auth.setAdministrativeAccess(user, true);
  assert.equal(c.Auth.getRole(), 'admin');
  assert.ok(f.calls.some(call => Array.isArray(call) && call.join('|') === 'phone|+51999111222|invisible'));
  assert.ok(f.calls.some(call => Array.isArray(call) && call.join('|') === 'confirm|123456'));
  await c.Auth.logoutAdmin(); assert.ok(f.calls.includes('signOut'));
});
test('invalid administrator code never sends an SMS request', async () => {
  const c = context(), f = adminFixture(c);
  await assert.rejects(c.Auth.signInPhonePassword('999111222', '123'), /6 digitos/);
  assert.equal(f.calls.length, 0);
});
test('email-only accounts and anonymous accounts are not administrators', async () => {
  const c = context();
  assert.equal(await c.Auth.checkIsAdmin({ email: 'phone.51999111222@example.test' }), false);
  assert.equal(await c.Auth.checkIsAdmin({ isAnonymous: true, phoneNumber: '+51999111222' }), false);
});
test('late admin result cannot replace a selected local customer', () => {
  const c = context(), f = adminFixture(c);
  c.Auth.loginClient('Ana', '999111222');
  assert.equal(c.Auth.setAdministrativeAccess(f.user, true), false);
  assert.equal(c.Auth.getRole(), 'client');
});
test('administrative auth observer ignores persisted admin sessions for local customers', async () => {
  const c = context({ kk_name: 'Ana', kk_phone: '999111222', kk_role: 'client' }), f = adminFixture(c);
  c.auth.currentUser = f.user;
  vm.runInContext(source('web/js/app.js'), c); c.initAuthModal();
  await c.adminObserver(f.user); assert.equal(c.Auth.getRole(), 'client'); assert.equal(c.App.currentPage, 'store');
});
function cartFixture(options = {}) {
  const c = context();
  Object.defineProperty(c, 'auth', { get() { throw new Error('Cart accessed Firebase Auth'); } });
  c.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'server-timestamp' } } };
  c.KioscoCore = { cartKey: (id, variants) => id + (variants.length ? '::' + variants.join('|') : ''),
    productImage: item => item.imageUrl || '', cents: value => Math.round(Number(value) * 100), priceFor: product => Number(product.price) };
  const products = new Map([['p1', { name: 'Pan', active: true, stock: options.stock ?? 10, price: 2.5 }]]);
  const orders = new Map(); let transactions = 0;
  c.clientDb = { collection: name => ({ doc: id => ({ id: id || 'order-000001', collection: name }) }),
    async runTransaction(callback) {
      transactions++; const operations = []; let hasWritten = false;
      if (options.barrier) await options.barrier;
      const transaction = {
        get: async ref => {
          assert.equal(hasWritten, false, 'all transaction reads must precede writes');
          const value = ref.collection === 'products' ? products.get(ref.id) : null;
          return { exists: Boolean(value), data: () => value };
        },
        update: (ref, value) => { hasWritten = true; operations.push(['update', ref, plain(value)]); },
        set: (ref, value) => { hasWritten = true; operations.push(['set', ref, plain(value)]); }
      };
      await callback(transaction);
      if (options.failCommit) throw new Error('Simulated commit failure');
      for (const [type, ref, value] of operations) {
        if (type === 'update') products.set(ref.id, { ...products.get(ref.id), ...value });
        else orders.set(ref.id, value);
      }
    } };
  c.db = { collection() { throw new Error('Customer used the administrative database'); } };
  vm.runInContext(source('web/js/cart.js'), c); c.Cart.init();
  c.Cart.add({ id: 'p1', name: 'Pan', price: 9, stock: 10 }, 2);
  const checkout = () => c.Cart.checkout('Ana', '999111222', '', 'pickup', '', '2026-09-13', '18:00', null);
  return { c, products, orders, checkout, transactions: () => transactions };
}
test('unauthenticated checkout uses current prices and atomically reserves stock', async () => {
  const f = cartFixture(), id = await f.checkout();
  assert.equal(id, 'order-000001'); assert.equal(f.orders.get(id).total, 5);
  assert.equal(f.products.get('p1').stock, 8); assert.equal(f.c.Cart.count(), 0);
  assert.match(f.orders.get(id).ownerId, /^local-/); assert.equal(f.orders.get(id).customerPhone, '999111222');
});
test('failed commit keeps the cart and leaves product stock unchanged', async () => {
  const f = cartFixture({ failCommit: true }); await assert.rejects(f.checkout(), /commit failure/);
  assert.equal(f.orders.size, 0); assert.equal(f.products.get('p1').stock, 10); assert.equal(f.c.Cart.count(), 2);
});
test('insufficient stock creates no order and permits retry after stock is restored', async () => {
  const f = cartFixture({ stock: 1 }); await assert.rejects(f.checkout(), /Stock insuficiente/);
  assert.equal(f.orders.size, 0); assert.equal(f.c.Cart.count(), 2);
  f.products.get('p1').stock = 10; await f.checkout(); assert.equal(f.orders.size, 1);
});
test('double submit does not create a second order', async () => {
  let release; const barrier = new Promise(resolve => { release = resolve; });
  const f = cartFixture({ barrier }), first = f.checkout();
  await assert.rejects(f.checkout(), /procesando/); release(); await first;
  assert.equal(f.orders.size, 1); assert.equal(f.transactions(), 1);
});
test('offline checkout preserves cart without starting a transaction', async () => {
  const f = cartFixture(); f.c.navigator.onLine = false;
  await assert.rejects(f.checkout(), /Sin conexion/); assert.equal(f.transactions(), 0); assert.equal(f.c.Cart.count(), 2);
});
test('private blocklist lookup cannot reinstate an authentication requirement', async () => {
  const f = cartFixture(); f.c.KioscoSystem = { isBlockedClient: async () => { throw new Error('permission-denied'); } };
  await f.checkout(); assert.equal(f.orders.size, 1);
});
test('public Firestore app never initializes Authentication', () => {
  const c = context({ kk_name: 'Ana', kk_phone: '', kk_role: 'client' });
  const privateDb = { kind: 'admin' }, publicDb = { kind: 'client' }, auth = { currentUser: { phoneNumber: '+51999111222' } };
  const apps = []; c.FIREBASE_CONFIG = { projectId: 'test' };
  c.firebase = { apps, initializeApp: (config, name = '[DEFAULT]') => {
    const app = { name, firestore: () => name === '[DEFAULT]' ? privateDb : publicDb,
      auth: () => { assert.equal(name, '[DEFAULT]'); return auth; } };
    apps.push(app); return app;
  }, storage: () => ({}), firestore: {} };
  vm.runInContext(source('web/js/firebase.js'), c);
  assert.equal(c.db, publicDb); assert.equal(c.clientDb, publicDb); assert.equal(c.adminDb, privateDb);
});
const featureFixture = `
async function historyA() { return db.collection(COLL.orders).where('ownerId', '==', (await Auth.ensureClient()).uid); }
async function historyB() { return db.collection(COLL.orders).where('ownerId', '==', (await Auth.ensureClient()).uid); }
function startPublicReceipts() {
    if (!window.auth?.currentUser) return;
    const query = db.collection(COLL.orders).where('ownerId', '==', auth.currentUser.uid);
}
async function getSessionId() {
    const user = await Auth.ensureClient();
    sessionId = user.uid;
}
  async function resolveAdministrativeAccess(user) {
    if (!user || user.isAnonymous) { return false; }
  }
function administrativeExtras(user) {
if (user && !user.isAnonymous) startOrderNotifications(); else stopOrderNotifications();
if (user && !user.isAnonymous && document.getElementById('sec-receipts')?.classList.contains('active')) startAdminReceipts();
const authenticatedAdmin = Boolean(window.auth?.currentUser && (state.access.mainAdmin || state.access.member));
}
`;
test('legacy feature integration removes customer Auth gates and preserves syntax', () => {
  const output = transformFeatures(featureFixture);
  assert.ok(output.includes(MARKER)); assert.ok(output.includes('Auth.clientOrdersQuery()'));
  assert.ok(output.includes('Auth.getChatId()')); assert.ok(!output.includes('Auth.ensureClient'));
  assert.ok(!output.includes("where('ownerId', '==', auth.currentUser.uid)"));
  new vm.Script(output);
});
test('feature integration is idempotent', () => {
  const output = transformFeatures(featureFixture); assert.equal(transformFeatures(output), output);
});
test('unexpected feature source fails rather than making a partial edit', () => {
  assert.throws(() => transformFeatures(featureFixture.replace('async function historyB', 'async function historyB').replace('sessionId = user.uid;', 'sessionId = 0;')), /ningun cambio/);
});
test('orders rule is exactly the requested block, without a hidden global allow', () => {
  const rules = source('firestore.rules');
  assert.match(rules, /match \/orders\/\{id\} \{\s*allow create: if true;\s*allow read: if true;\s*allow update, delete: if request.auth != null;\s*\}/);
  assert.match(rules, /match \/\{document=\*\*\} \{ allow read, write: if false; \}/);
});
test('stock reservation condition no longer depends on a Firebase user', () => {
  const fn = source('firestore.rules').split('function linkedStockDecrease(productId) {')[1].split('function orderInventoryTransition')[0];
  assert.ok(!/signedIn\(|ownsOrder\(|request\.auth/.test(fn));
  assert.ok(fn.includes('!exists(orderPath) && existsAfter(orderPath)')); assert.ok(fn.includes('validReservationOrder'));
});
test('Hosting deployment does not run the old configuration generator', () => {
  const config = JSON.parse(source('firebase.json'));
  assert.deepEqual(config.hosting.predeploy, ['node scripts/prepare-local-client.cjs', 'node scripts/verify-local-client.cjs']);
  assert.equal(config.hosting.public, 'web');
});
test('delivered web sources contain no anonymous/email sign-in method calls', () => {
  for (const file of ['auth', 'app', 'cart', 'firebase']) {
    assert.ok(!/(?:signInAnonymously|signInWithEmailAndPassword|createUserWithEmailAndPassword)\s*\(/.test(source(`web/js/${file}.js`)), file);
  }
});

function lazyFirebaseFixture(role = '') {
  const c = context(role ? { kk_name: 'Ana', kk_phone: '999111222', kk_role: role } : {});
  const calls = [], sdkObservers = new Set(), apps = [];
  const actualAuth = { currentUser: null,
    onAuthStateChanged(callback) { sdkObservers.add(callback); return () => sdkObservers.delete(callback); },
    async signInWithPhoneNumber(phone) { calls.push(['phone', phone]); return { confirm: async code => ({ user: { uid: code } }) }; },
    async signOut() { calls.push(['signOut']); }
  };
  c.FIREBASE_CONFIG = { projectId: 'test' };
  c.firebase = { apps, initializeApp(config, name = '[DEFAULT]') {
    const app = { name, firestore: () => ({ name }), auth: () => { calls.push(['auth', name]); return actualAuth; } };
    apps.push(app); return app;
  }, storage: () => ({}), firestore: {} };
  vm.runInContext(source('web/js/firebase.js'), c);
  return { c, calls, actualAuth, sdkObservers };
}
test('customer startup and administrative observer registration make zero SDK Auth calls', async () => {
  const f = lazyFirebaseFixture('client'), values = [];
  f.c.auth.onAuthStateChanged(user => values.push(user));
  await Promise.resolve();
  assert.equal(f.calls.length, 0); assert.deepEqual(values, [null]); assert.equal(f.c.auth.currentUser, null);
});
test('administrative Auth initializes only when Phone login starts', async () => {
  const f = lazyFirebaseFixture(), callback = () => {};
  f.c.auth.onAuthStateChanged(callback);
  await f.c.auth.signInWithPhoneNumber('+51999111222', {});
  assert.deepEqual(f.calls, [['auth', '[DEFAULT]'], ['phone', '+51999111222']]);
  assert.ok(f.sdkObservers.has(callback));
});
test('previously saved administrator role restores only the administrative Auth instance', () => {
  const f = lazyFirebaseFixture('admin');
  assert.deepEqual(f.calls, [['auth', '[DEFAULT]']]);
});
test('initial null Auth notification cannot cancel an in-progress administrator login', async () => {
  const c = context(), f = adminFixture(c);
  c.Auth.loginClient('Ana', '999111222');
  vm.runInContext(source('web/js/app.js'), c); c.initAuthModal();
  await c.Auth.signInPhonePassword('999111222', '123456');
  assert.equal(c.Auth.isAdminLoginPending(), true);
  await c.adminObserver(null);
  assert.equal(c.Auth.isAdminLoginPending(), true);
  c.Auth.setAdministrativeAccess(f.user, true); assert.equal(c.Auth.getRole(), 'admin');
});

test('legacy customer history escapes publicly supplied item names and status', () => {
  const legacy = [
    'const CustomerProfile = (() => {',
    'function render(o) { const icon = { pending: "" };',
    "const items = (o.items || []).map(i => `${i.name} \u00d7${i.qty}`).join(', ');",
    "return `<span>${icon[o.status] || ''} ${o.status}</span>",
    '<p style="font-size:.82rem;color:var(--text-2);margin:.25rem 0">${items}</p>',
    '<p>${(o.total || 0).toFixed(2)}</p>`;',
    '} return { render };',
    '})();'
  ].join('\n');
  const output = transformFeatures(featureFixture + '\n' + legacy);
  const c = context(); vm.runInContext(source('web/js/app.js'), c); vm.runInContext(output, c);
  const result = vm.runInContext('CustomerProfile.render({items:[{name:"<img src=x onerror=evil()>",qty:1}],status:"<svg onload=evil()>",total:"invalid"})', c);
  assert.ok(result.includes('&lt;img')); assert.ok(result.includes('&lt;svg')); assert.ok(!result.includes('<img'));
});
