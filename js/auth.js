// ===== js/auth.js =====
// Autenticación dual: Admin (número + código) y Usuario (solo número)

const Auth = (() => {
  let confirmationResult = null;
  let adminPhones = [];
  let recaptchaVerifier = null;
  let currentUser = null;
  let currentRole = null; // 'admin' | 'user' | null

  // ── Cargar números admin desde Firestore ───────────────────────────────────
  async function loadAdminPhones() {
    if (adminPhones.length) return adminPhones;
    try {
      const doc = await db.collection(COLL.config).doc('admin').get();
      if (doc.exists) {
        const d = doc.data();
        adminPhones = Array.isArray(d.phones) ? d.phones : (d.phone ? [d.phone] : []);
      }
    } catch (e) { console.error('loadAdminPhones', e); }
    return adminPhones;
  }

  function initRecaptcha() {
    if (recaptchaVerifier) return;
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      size: 'invisible', callback: () => { }
    });
  }

  async function sendCode(digits) {
    initRecaptcha();
    const full = APP_CONFIG.phoneCountry + digits.replace(/\D/g, '');
    confirmationResult = await auth.signInWithPhoneNumber(full, recaptchaVerifier);
    return full;
  }

  async function verifyCode(code) {
    if (!confirmationResult) throw new Error('Sin código pendiente');
    const { user } = await confirmationResult.confirm(code);
    return user;
  }

  async function checkIsAdmin(user) {
    await loadAdminPhones();
    console.log('📱 Número del usuario:', user.phoneNumber);
    console.log('📋 Admins en Firestore:', adminPhones);
    return user && adminPhones.includes(user.phoneNumber);
  }

  // Login de usuario sin código (anónimo con nombre)
  async function loginAsUser(name, phone) {
    // Guardar en localStorage (no requiere Firebase Auth)
    localStorage.setItem('kiosco_user_name', name || 'Cliente');
    localStorage.setItem('kiosco_user_phone', phone || '');
    currentRole = 'user';
    return { name, phone };
  }

  function getCurrentUser() { return currentUser; }
  function getCurrentRole() { return currentRole; }
  function isAdmin() { return currentRole === 'admin'; }
  function isLoggedIn() { return currentRole !== null; }

  function getUserName() { return localStorage.getItem('kiosco_user_name') || ''; }
  function getUserPhone() { return localStorage.getItem('kiosco_user_phone') || ''; }

  function signOut() {
    currentRole = null;
    currentUser = null;
    localStorage.removeItem('kiosco_user_name');
    localStorage.removeItem('kiosco_user_phone');
    return auth.signOut();
  }

  function onAuthChange(cb) { return auth.onAuthStateChanged(cb); }

  return {
    loadAdminPhones, sendCode, verifyCode, checkIsAdmin,
    loginAsUser, signOut, onAuthChange,
    getCurrentRole, isAdmin, isLoggedIn,
    getUserName, getUserPhone
  };
})();

// ══════════════════════════════════════════════════════════════════════════════
//  UI DEL LOGIN
// ══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const loginModal = document.getElementById('loginModal');
  const loginBtn = document.getElementById('loginBtn');
  const closeBtn = document.getElementById('closeLoginModal');
  const loginError = document.getElementById('loginError');

  // ── Tabs: Admin / Usuario ─────────────────────────────────────────────────
  const tabAdmin = document.getElementById('loginTabAdmin');
  const tabUser = document.getElementById('loginTabUser');
  const panelAdmin = document.getElementById('loginPanelAdmin');
  const panelUser = document.getElementById('loginPanelUser');

  function switchTab(tab) {
    tabAdmin?.classList.toggle('active', tab === 'admin');
    tabUser?.classList.toggle('active', tab === 'user');
    if (panelAdmin) panelAdmin.style.display = tab === 'admin' ? '' : 'none';
    if (panelUser) panelUser.style.display = tab === 'user' ? '' : 'none';
    if (loginError) loginError.textContent = '';
  }

  tabAdmin?.addEventListener('click', () => switchTab('admin'));
  tabUser?.addEventListener('click', () => switchTab('user'));

  // ── Abrir / cerrar modal ───────────────────────────────────────────────────
  loginBtn?.addEventListener('click', () => {
    if (Auth.isAdmin()) {
      // Admin: toggle tienda/panel
      const onAdmin = document.getElementById('pageAdmin')?.classList.contains('active');
      App.showPage(onAdmin ? 'store' : 'admin');
    } else if (Auth.isLoggedIn()) {
      // Usuario logueado: cerrar sesión
      if (confirm('¿Cerrar sesión?')) {
        Auth.signOut();
        updateHeaderBtn();
        App.showPage('store');
        showToast('Sesión cerrada', 'info');
      }
    } else {
      resetModal();
      openModal(loginModal);
    }
  });

  closeBtn?.addEventListener('click', () => closeModal(loginModal));
  loginModal?.addEventListener('click', e => { if (e.target === loginModal) closeModal(loginModal); });

  function resetModal() {
    // Admin fields
    const phoneInput = document.getElementById('phoneInput');
    const codeInput = document.getElementById('codeInput');
    const step1 = document.getElementById('loginStep1');
    const step2 = document.getElementById('loginStep2');
    if (phoneInput) phoneInput.value = '';
    if (codeInput) codeInput.value = '';
    if (step1) step1.style.display = '';
    if (step2) step2.style.display = 'none';
    // User fields
    const userName = document.getElementById('userNameInput');
    const userPhone = document.getElementById('userPhoneInput');
    if (userName) userName.value = Auth.getUserName();
    if (userPhone) userPhone.value = Auth.getUserPhone();
    if (loginError) loginError.textContent = '';
    switchTab('user'); // default: usuario
  }

  // ── ADMIN: enviar código ───────────────────────────────────────────────────
  const sendBtn = document.getElementById('sendCodeBtn');
  const verifyBtn = document.getElementById('verifyCodeBtn');
  const step1 = document.getElementById('loginStep1');
  const step2 = document.getElementById('loginStep2');

  sendBtn?.addEventListener('click', async () => {
    const digits = document.getElementById('phoneInput')?.value.trim();
    if (!digits || digits.replace(/\D/g, '').length < 9) {
      loginError.textContent = 'Número inválido'; return;
    }
    loginError.textContent = '';
    sendBtn.textContent = 'Enviando…'; sendBtn.disabled = true;
    try {
      await Auth.sendCode(digits);
      step1.style.display = 'none';
      step2.style.display = '';
      showToast('Código enviado 📱', 'success');
      setTimeout(() => document.getElementById('codeInput')?.focus(), 100);
    } catch (e) {
      loginError.textContent = e.message || 'Error al enviar código';
    } finally {
      sendBtn.textContent = 'Enviar código'; sendBtn.disabled = false;
    }
  });

  verifyBtn?.addEventListener('click', async () => {
    const code = document.getElementById('codeInput')?.value.trim();
    if (code?.length !== 6) { loginError.textContent = 'El código tiene 6 dígitos'; return; }
    verifyBtn.textContent = 'Verificando…'; verifyBtn.disabled = true;
    try {
      const user = await Auth.verifyCode(code);
      const isAdm = await Auth.checkIsAdmin(user);
      if (isAdm) {
        closeModal(loginModal);
        App.showPage('admin');
        showToast('Bienvenido, administrador 👋', 'success');
        Admin.init();
        updateHeaderBtn('admin');
      } else {
        await Auth.signOut();
        loginError.textContent = 'Acceso denegado. Solo administradores.';
      }
    } catch {
      loginError.textContent = 'Código incorrecto o expirado';
    } finally {
      verifyBtn.textContent = 'Verificar'; verifyBtn.disabled = false;
    }
  });

  // ── USUARIO: login simple ──────────────────────────────────────────────────
  document.getElementById('userLoginBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('userNameInput')?.value.trim();
    const phone = document.getElementById('userPhoneInput')?.value.trim();
    if (!name) { loginError.textContent = 'Ingresa tu nombre'; return; }
    await Auth.loginAsUser(name, phone);
    closeModal(loginModal);
    updateHeaderBtn('user');
    showToast(`¡Hola, ${name}! 👋`, 'success');
    // Pre-fill cart name
    ['customerName', 'customerNameMobile'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = name;
    });
  });

  // ── Cerrar sesión ──────────────────────────────────────────────────────────
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    Auth.signOut();
    updateHeaderBtn();
    App.showPage('store');
    showToast('Sesión cerrada', 'info');
  });

  // ── Actualizar botón header ────────────────────────────────────────────────
  function updateHeaderBtn(role) {
    if (!loginBtn) return;
    if (role === 'admin') {
      loginBtn.innerHTML = '🔧';
      loginBtn.title = 'Panel / Tienda';
    } else if (role === 'user') {
      const name = Auth.getUserName();
      loginBtn.innerHTML = '👤';
      loginBtn.title = `${name} · Cerrar sesión`;
    } else {
      loginBtn.innerHTML = '👤';
      loginBtn.title = 'Ingresar';
    }
  }

  // ── Observer Firebase Auth ─────────────────────────────────────────────────
  Auth.onAuthChange(async user => {
    if (user) {
      const isAdm = await Auth.checkIsAdmin(user);
      if (isAdm) updateHeaderBtn('admin');
      else { await Auth.signOut(); updateHeaderBtn(); }
    } else {
      // Check if user-mode login persists
      if (Auth.getUserName()) updateHeaderBtn('user');
      else updateHeaderBtn();
    }
  });

  Auth.loadAdminPhones();

  // ── Botón "Volver" en páginas ──────────────────────────────────────────────
  document.getElementById('backToStoreBtn')?.addEventListener('click', () => App.showPage('store'));
});
