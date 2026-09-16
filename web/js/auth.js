'use strict';
// Customer profile: localStorage only. Firebase Authentication: administrators only.
const Auth = (() => {
  const K = { name: 'kk_name', phone: 'kk_phone', role: 'kk_role' };
  const CLIENT_ID_KEY = 'kk_client_id';
  let recaptcha = null, administrativeUid = '', adminLoginPending = false;
  let revision = 0, memoryClientId = '', memoryChatId = '';
  const read = key => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
  const remove = key => { try { localStorage.removeItem(key); } catch { /* Storage may be disabled. */ } };

  function normalizePeruvianPhone(value) {
    const national = String(value || '').replace(/\D/g, '');
    if (!/^9\d{8}$/.test(national)) throw new Error('Ingresa un celular peruano valido de 9 digitos.');
    return national;
  }
  function e164Phone(value) {
    return `${String(window.APP_CONFIG?.phoneCountry || '+51').trim() || '+51'}${normalizePeruvianPhone(value)}`;
  }

  // CLIENT FLOW. None of these functions reads or calls Firebase Auth.
  function isClient() { return read(K.role) === 'client' && Boolean(read(K.name)); }
  function loginClient(name, phone) {
    const cleanName = String(name || '').trim();
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!cleanName || cleanName.length > 120) throw new Error('Ingresa un nombre de hasta 120 caracteres.');
    if (cleanPhone && !/^\d{9}$/.test(cleanPhone)) throw new Error('El telefono debe tener 9 digitos.');
    const previous = Object.fromEntries(Object.values(K).map(key => [key, read(key)]));
    try {
      localStorage.setItem(K.name, cleanName);
      localStorage.setItem(K.phone, cleanPhone);
      localStorage.setItem(K.role, 'client');
    } catch {
      for (const [key, value] of Object.entries(previous)) {
        try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key); } catch { /* Best effort rollback. */ }
      }
      throw new Error('El navegador no permite guardar tu perfil. Habilita el almacenamiento local e intenta de nuevo.');
    }
    administrativeUid = '';
    adminLoginPending = false;
    revision += 1;
    window.dispatchEvent(new CustomEvent('auth:logout'));
    window.dispatchEvent(new CustomEvent('auth:client-updated'));
  }
  function logoutClient() {
    administrativeUid = '';
    adminLoginPending = false;
    revision += 1;
    Object.values(K).forEach(remove);
    remove(CLIENT_ID_KEY);
    remove('kk_chat_id');
    memoryClientId = '';
    memoryChatId = '';
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }
  function getClientId() {
    // Local grouping key for existing cart/history/chat integrations, NOT an Auth UID.
    // Created lazily, never by loginClient; it is not an authorization credential.
    const saved = read(CLIENT_ID_KEY);
    if (/^local-[a-f0-9-]{32,36}$/.test(saved)) return saved;
    if (!memoryClientId) {
      const random = window.crypto?.randomUUID?.() || Array.from(
        window.crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')
      ).join('');
      memoryClientId = `local-${random}`;
    }
    try { localStorage.setItem(CLIENT_ID_KEY, memoryClientId); } catch { /* Keep this tab's grouping key. */ }
    return memoryClientId;
  }
  function getChatId() {
    const saved = read('kk_chat_id');
    if (/^chat-[a-f0-9]{32}$/.test(saved)) return saved;
    if (!memoryChatId) {
      const bytes = window.crypto.getRandomValues(new Uint8Array(16));
      memoryChatId = 'chat-' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    try { localStorage.setItem('kk_chat_id', memoryChatId); } catch { /* Keep this tab's conversation. */ }
    return memoryChatId;
  }
  function clientOrdersQuery() {
    // Convenience filter, NOT identity verification or an access-control boundary.
    const database = window.clientDb || window.db;
    const phone = read(K.phone), name = read(K.name);
    if (!name) throw new Error('Ingresa tu nombre para consultar tus pedidos.');
    return database.collection(COLL.orders).where(phone ? 'customerPhone' : 'customer', '==', phone || name);
  }

  // ADMIN FLOW. The phone provider, reCAPTCHA and six-digit confirmation are preserved.
  function phoneFromCredentialUser(user) { return String(user?.phoneNumber || ''); }
  function adminDatabase() { return window.adminDb || window.db; }
  async function loadAdminPhones() {
    if (!phoneFromCredentialUser(window.auth?.currentUser)) return [];
    const snapshot = await adminDatabase().collection(COLL.config).doc('admin').get();
    const data = snapshot.exists ? snapshot.data() : {};
    return Array.isArray(data.phones) ? data.phones : data.phone ? [data.phone] : [];
  }
  function resetRecaptcha() {
    try { recaptcha?.clear(); } catch { /* Widget may already have been removed. */ }
    recaptcha = null;
    document.getElementById('adminRecaptchaContainer')?.replaceChildren();
  }
  async function signInPhonePassword(phone, password, containerId = 'adminRecaptchaContainer') {
    if (!window.auth || !window.firebase?.auth?.RecaptchaVerifier) throw new Error('El servicio de acceso no esta disponible.');
    const phoneNumber = e164Phone(phone);
    const secret = String(password || '').replace(/\D/g, '');
    if (!/^\d{6}$/.test(secret)) throw new Error('La contrasena debe tener 6 digitos.');
    adminLoginPending = true;
    revision += 1;
    const attemptRevision = revision;
    resetRecaptcha();
    try {
      recaptcha = new firebase.auth.RecaptchaVerifier(containerId, {
        size: 'invisible', 'expired-callback': resetRecaptcha
      });
      const confirmation = await auth.signInWithPhoneNumber(phoneNumber, recaptcha);
      if (revision !== attemptRevision) throw new Error('Acceso administrativo cancelado.');
      const result = await confirmation.confirm(secret);
      if (revision !== attemptRevision) throw new Error('Acceso administrativo cancelado.');
      resetRecaptcha();
      return result.user;
    } catch (error) {
      adminLoginPending = false;
      resetRecaptcha();
      const messages = {
        'auth/invalid-verification-code': 'Numero de celular o contrasena incorrectos.',
        'auth/code-expired': 'La contrasena temporal vencio. Intenta nuevamente.',
        'auth/session-expired': 'La sesion de verificacion vencio. Intenta nuevamente.',
        'auth/captcha-check-failed': 'No se pudo validar reCAPTCHA. Recarga la pagina e intenta nuevamente.',
        'auth/missing-app-credential': 'No se pudo validar reCAPTCHA. Recarga la pagina e intenta nuevamente.',
        'auth/unauthorized-domain': 'Autoriza este dominio en Firebase Authentication.',
        'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos antes de volver a intentar.',
        'auth/operation-not-allowed': 'Activa el proveedor Telefono en Firebase Authentication.',
        'auth/billing-not-enabled': 'Este acceso en Spark requiere un numero configurado como numero de prueba en Firebase Authentication.',
        'auth/quota-exceeded': 'Este acceso en Spark requiere un numero configurado como numero de prueba en Firebase Authentication.',
        'auth/network-request-failed': 'Revisa tu conexion a Internet.'
      };
      throw new Error(messages[error?.code] || 'No se pudo iniciar sesion. Revisa el celular, la contrasena y reCAPTCHA.');
    }
  }
  async function checkIsAdmin(user) {
    if (!user || user.isAnonymous || !phoneFromCredentialUser(user)) return false;
    const token = await user.getIdTokenResult();
    if (token.claims?.admin === true) return true;
    try {
      const snapshot = await adminDatabase().collection(COLL.config).doc('admin').get();
      const data = snapshot.exists ? snapshot.data() : {};
      const phones = Array.isArray(data.phones) ? data.phones : data.phone ? [data.phone] : [];
      return (Array.isArray(data.uids) && data.uids.includes(user.uid)) || phones.includes(phoneFromCredentialUser(user));
    } catch (error) {
      if (error.code === 'permission-denied') return false;
      throw error;
    }
  }
  function setAdministrativeAccess(user, allowed) {
    if (allowed && isClient() && !adminLoginPending) return false;
    administrativeUid = allowed && user ? user.uid : '';
    if (allowed) {
      try { localStorage.setItem(K.role, 'admin'); } catch { /* No persisted administrative role. */ }
    } else if (read(K.role) === 'admin') remove(K.role);
    adminLoginPending = false;
    return Boolean(administrativeUid);
  }
  function hasAdministrativeAccess() {
    if (isClient() || !administrativeUid) return false;
    return administrativeUid === window.auth?.currentUser?.uid;
  }
  async function logoutAdmin() {
    administrativeUid = '';
    adminLoginPending = false;
    revision += 1;
    resetRecaptcha();
    Object.values(K).forEach(remove);
    for (const module of [window.Admin, window.Dashboard, window.Orders]) module?.destroy?.();
    window.dispatchEvent(new CustomEvent('auth:logout'));
    if (window.auth?.currentUser) await auth.signOut();
  }
  function logout() { return isClient() ? logoutClient() : logoutAdmin(); }
  function getRole() { return isClient() ? 'client' : hasAdministrativeAccess() ? 'admin' : ''; }

  return {
    loginClient, logoutClient, getClientId, getChatId, clientOrdersQuery,
    getClientName: () => read(K.name), getClientPhone: () => read(K.phone),
    getUserName: () => read(K.name), isClient, getRole,
    isLoggedIn: () => isClient() || hasAdministrativeAccess(),
    loadAdminPhones, phoneFromCredentialUser, signInPhonePassword, checkIsAdmin,
    checkMainAdmin: checkIsAdmin, setAdministrativeAccess, hasAdministrativeAccess,
    logoutAdmin, logout, isAdminLoginPending: () => adminLoginPending,
    getSessionRevision: () => revision,
    onAuthChange: cb => auth.onAuthStateChanged(cb)
  };
})();
window.Auth = Auth;
