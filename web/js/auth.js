'use strict';
// Clients use Firebase anonymous identity. Administrative access uses Firebase Phone Authentication.
// For Spark deployments without SMS, the visible "contrasena" is the 6-digit verification code
// configured for a Firebase test phone number. reCAPTCHA remains enabled in production.
const Auth = (() => {
  const K = { name: 'kk_name', phone: 'kk_phone', role: 'kk_role' };
  let recaptcha = null, anonymousPromise = null, administrativeUid = '';
  const read = key => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
  const write = (key, value) => { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* private browser */ } };

  function normalizePeruvianPhone(value) {
    const national = String(value || '').replace(/\D/g, '');
    if (!/^9\d{8}$/.test(national)) throw new Error('Ingresa un celular peruano valido de 9 digitos.');
    return national;
  }

  function e164Phone(value) {
    return `${String(window.APP_CONFIG?.phoneCountry || '+51').trim() || '+51'}${normalizePeruvianPhone(value)}`;
  }

  function phoneFromCredentialUser(user) {
    if (user?.phoneNumber) return String(user.phoneNumber);
    // Compatibility with accounts created by the short-lived Email/Password migration.
    const match = String(user?.email || '').toLowerCase().match(/^phone\.51(9\d{8})@/);
    return match ? `+51${match[1]}` : '';
  }

  async function loadAdminPhones() {
    if (!window.auth?.currentUser || auth.currentUser.isAnonymous) return [];
    const snapshot = await db.collection(COLL.config).doc('admin').get();
    const data = snapshot.exists ? snapshot.data() : {};
    return Array.isArray(data.phones) ? data.phones : data.phone ? [data.phone] : [];
  }

  function resetRecaptcha() {
    try { recaptcha?.clear(); } catch { /* widget may already have been removed */ }
    recaptcha = null;
    const container = document.getElementById('adminRecaptchaContainer');
    if (container) container.replaceChildren();
  }

  async function signInPhonePassword(phone, password, containerId = 'adminRecaptchaContainer') {
    if (!window.auth || !window.firebase?.auth?.RecaptchaVerifier) throw new Error('El servicio de acceso no esta disponible.');
    const phoneNumber = e164Phone(phone);
    const secret = String(password || '').replace(/\D/g, '');
    if (!/^\d{6}$/.test(secret)) throw new Error('La contrasena debe tener 6 digitos.');

    resetRecaptcha();
    try {
      recaptcha = new firebase.auth.RecaptchaVerifier(containerId, {
        size: 'invisible',
        'expired-callback': resetRecaptcha
      });
      const confirmation = await auth.signInWithPhoneNumber(phoneNumber, recaptcha);
      const result = await confirmation.confirm(secret);
      resetRecaptcha();
      return result.user;
    } catch (error) {
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
    if (!user || user.isAnonymous) return false;
    const token = await user.getIdTokenResult();
    if (token.claims?.admin === true) return true;
    try {
      const snapshot = await db.collection(COLL.config).doc('admin').get();
      const data = snapshot.exists ? snapshot.data() : {};
      const userPhone = phoneFromCredentialUser(user);
      const phones = Array.isArray(data.phones) ? data.phones : data.phone ? [data.phone] : [];
      return (Array.isArray(data.uids) && data.uids.includes(user.uid)) || Boolean(userPhone && phones.includes(userPhone));
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
    resetRecaptcha();
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
