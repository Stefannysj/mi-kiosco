'use strict';
// Clients use Firebase anonymous identity; a local label never grants permissions.
const Auth = (() => {
  const K = { name: 'kk_name', phone: 'kk_phone', role: 'kk_role' };
  let recaptcha = null, confirmResult = null, anonymousPromise = null, administrativeUid = '';
  const read = key => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
  const write = (key, value) => { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* private browser */ } };

  async function loadAdminPhones() {
    if (!window.auth?.currentUser || auth.currentUser.isAnonymous) return [];
    const snapshot = await db.collection(COLL.config).doc('admin').get();
    const data = snapshot.exists ? snapshot.data() : {};
    return Array.isArray(data.phones) ? data.phones : data.phone ? [data.phone] : [];
  }
  function resetRecaptcha() {
    try { recaptcha?.clear(); } catch { /* widget may already have been removed */ }
    recaptcha = null;
    const container = document.getElementById('recaptchaContainer');
    if (container) container.replaceChildren();
  }
  async function sendCode(digits, containerId = 'recaptchaContainer') {
    const national = String(digits || '').replace(/\D/g, '');
    if (!/^9\d{8}$/.test(national)) throw new Error('Ingresa un celular peruano valido de 9 digitos.');
    if (!window.auth) throw new Error('El servicio de acceso no esta disponible.');
    confirmResult = null;
    resetRecaptcha();
    try {
      recaptcha = new firebase.auth.RecaptchaVerifier(containerId, { size: 'invisible', 'expired-callback': resetRecaptcha });
      const phone = (window.APP_CONFIG?.phoneCountry || '+51') + national;
      confirmResult = await auth.signInWithPhoneNumber(phone, recaptcha);
      return phone;
    } catch (error) {
      resetRecaptcha();
      if (['auth/billing-not-enabled', 'auth/quota-exceeded', 'auth/operation-not-allowed'].includes(error.code)) {
        throw new Error('Firebase Spark no permite SMS reales. Revisa los numeros de prueba y el proveedor Telefono en Firebase.');
      }
      if (error.code === 'auth/unauthorized-domain') throw new Error('Autoriza el dominio de esta tienda en Firebase Authentication.');
      if (error.code === 'auth/too-many-requests') throw new Error('Demasiados intentos. Intenta de nuevo mas tarde.');
      throw error;
    }
  }
  async function verifyCode(code) {
    if (!confirmResult) throw new Error('Solicita primero un codigo.');
    if (!/^\d{6}$/.test(String(code))) throw new Error('El codigo debe tener 6 digitos.');
    const { user } = await confirmResult.confirm(String(code));
    confirmResult = null;
    resetRecaptcha();
    return user;
  }
  async function signInEmail(email, password) {
    const address = String(email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || !password) throw new Error('Ingresa tu correo y contrasena.');
    try { return (await auth.signInWithEmailAndPassword(address, String(password))).user; }
    catch (error) {
      const messages = { 'auth/invalid-credential': 'Correo o contrasena incorrectos.', 'auth/user-not-found': 'Correo o contrasena incorrectos.',
        'auth/wrong-password': 'Correo o contrasena incorrectos.', 'auth/too-many-requests': 'Espera unos minutos antes de volver a intentar.',
        'auth/operation-not-allowed': 'Activa Correo/contrasena en Firebase Authentication.', 'auth/network-request-failed': 'Revisa tu conexion a Internet.' };
      throw new Error(messages[error.code] || 'No se pudo iniciar sesion. Revisa los datos de acceso.');
    }
  }
  async function checkIsAdmin(user) {
    if (!user || user.isAnonymous) return false;
    const token = await user.getIdTokenResult();
    if (token.claims?.admin === true) return true;
    try {
      const snapshot = await db.collection(COLL.config).doc('admin').get();
      const data = snapshot.exists ? snapshot.data() : {};
      return (Array.isArray(data.uids) && data.uids.includes(user.uid)) ||
        Boolean(user.phoneNumber && (Array.isArray(data.phones) ? data.phones : [data.phone]).includes(user.phoneNumber));
    } catch (error) {
      if (error.code === 'permission-denied') return false;
      throw error;
    }
  }
  function setAdministrativeAccess(user, allowed) {
    administrativeUid = allowed && user ? user.uid : '';
    if (allowed) write(K.role, 'admin');
    else if (read(K.role) === 'admin') write(K.role, null);
  }
  async function ensureClient() {
    if (!window.auth) throw new Error('Firebase Authentication no esta disponible.');
    if (auth.currentUser) return auth.currentUser;
    if (!anonymousPromise) {
      anonymousPromise = auth.signInAnonymously().then(result => result.user).catch(error => {
        if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
          throw new Error('Activa el acceso Anonimo en Firebase Authentication para recibir pedidos en Spark.');
        }
        throw error;
      }).finally(() => { anonymousPromise = null; });
    }
    return anonymousPromise;
  }
  async function loginClient(name, phone) {
    const cleanName = String(name || '').trim();
    if (!cleanName || cleanName.length > 120) throw new Error('Ingresa un nombre de hasta 120 caracteres.');
    if (auth.currentUser && !auth.currentUser.isAnonymous) await logout();
    await ensureClient();
    write(K.name, cleanName);
    write(K.phone, String(phone || '').trim());
    write(K.role, 'client');
    window.dispatchEvent(new CustomEvent('auth:client-updated'));
  }
  async function logout() {
    administrativeUid = '';
    Object.values(K).forEach(key => write(key, null));
    for (const module of [window.Admin, window.Dashboard, window.Orders]) module?.destroy?.();
    window.dispatchEvent(new CustomEvent('auth:logout'));
    if (window.auth?.currentUser) await auth.signOut();
  }
  function hasAdministrativeAccess() { return Boolean(administrativeUid && administrativeUid === window.auth?.currentUser?.uid); }
  function getRole() { return hasAdministrativeAccess() ? 'admin' : (read(K.role) === 'client' && window.auth?.currentUser ? 'client' : ''); }
  return { loadAdminPhones, sendCode, verifyCode, signInEmail, checkIsAdmin, checkMainAdmin: checkIsAdmin, setAdministrativeAccess, hasAdministrativeAccess,
    ensureClient, loginClient, logout, getRole, getClientName: () => read(K.name), getClientPhone: () => read(K.phone),
    isClient: () => getRole() === 'client', isLoggedIn: () => Boolean(window.auth?.currentUser),
    onAuthChange: cb => auth.onAuthStateChanged(cb) };
})();
window.Auth = Auth;
