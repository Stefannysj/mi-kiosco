'use strict';
// Clients use Firebase anonymous identity. Administrative access is authorized by Firebase UID.
// Firebase has no native phone+password provider, so the UI maps the phone to an internal email alias
// and authenticates it with Firebase Email/Password. The alias is never shown to the user.
const Auth = (() => {
  const K = { name: 'kk_name', phone: 'kk_phone', role: 'kk_role' };
  let anonymousPromise = null, administrativeUid = '';
  const read = key => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
  const write = (key, value) => { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* private browser */ } };

  function normalizePeruvianPhone(value) {
    const national = String(value || '').replace(/\D/g, '');
    if (!/^9\d{8}$/.test(national)) throw new Error('Ingresa un celular peruano valido de 9 digitos.');
    return national;
  }

  function phoneCredentialEmail(value) {
    const national = normalizePeruvianPhone(value);
    const projectId = String(window.FIREBASE_CONFIG?.projectId || 'mi-kiosco-c7313')
      .trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!projectId) throw new Error('La configuracion de Firebase no es valida.');
    return `phone.51${national}@${projectId}.firebaseapp.com`;
  }

  function phoneFromCredentialUser(user) {
    if (user?.phoneNumber) return String(user.phoneNumber);
    const match = String(user?.email || '').toLowerCase().match(/^phone\.51(9\d{8})@/);
    return match ? `+51${match[1]}` : '';
  }

  async function loadAdminPhones() {
    if (!window.auth?.currentUser || auth.currentUser.isAnonymous) return [];
    const snapshot = await db.collection(COLL.config).doc('admin').get();
    const data = snapshot.exists ? snapshot.data() : {};
    return Array.isArray(data.phones) ? data.phones : data.phone ? [data.phone] : [];
  }

  async function signInPhonePassword(phone, password) {
    if (!window.auth) throw new Error('El servicio de acceso no esta disponible.');
    const secret = String(password || '');
    if (!secret) throw new Error('Ingresa tu numero de celular y contrasena.');
    const credentialEmail = phoneCredentialEmail(phone);
    try {
      return (await auth.signInWithEmailAndPassword(credentialEmail, secret)).user;
    } catch (error) {
      const messages = {
        'auth/invalid-credential': 'Numero de celular o contrasena incorrectos.',
        'auth/user-not-found': 'Numero de celular o contrasena incorrectos.',
        'auth/wrong-password': 'Numero de celular o contrasena incorrectos.',
        'auth/invalid-email': 'No se pudo validar el numero de celular.',
        'auth/too-many-requests': 'Espera unos minutos antes de volver a intentar.',
        'auth/operation-not-allowed': 'Activa Correo/contrasena en Firebase Authentication para habilitar este acceso.',
        'auth/network-request-failed': 'Revisa tu conexion a Internet.'
      };
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
      const userPhone = phoneFromCredentialUser(user);
      return (Array.isArray(data.uids) && data.uids.includes(user.uid)) ||
        Boolean(user.phoneNumber && userPhone && (Array.isArray(data.phones) ? data.phones : [data.phone]).includes(userPhone));
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

  function hasAdministrativeAccess() {
    return Boolean(administrativeUid && administrativeUid === window.auth?.currentUser?.uid);
  }
  function getRole() {
    return hasAdministrativeAccess() ? 'admin' : (read(K.role) === 'client' && window.auth?.currentUser ? 'client' : '');
  }

  return {
    loadAdminPhones,
    signInPhonePassword,
    phoneCredentialEmail,
    phoneFromCredentialUser,
    checkIsAdmin,
    checkMainAdmin: checkIsAdmin,
    setAdministrativeAccess,
    hasAdministrativeAccess,
    ensureClient,
    loginClient,
    logout,
    getRole,
    getClientName: () => read(K.name),
    getClientPhone: () => read(K.phone),
    isClient: () => getRole() === 'client',
    isLoggedIn: () => Boolean(window.auth?.currentUser),
    onAuthChange: cb => auth.onAuthStateChanged(cb)
  };
})();
window.Auth = Auth;
