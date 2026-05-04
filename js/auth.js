// js/auth.js — Phone authentication, admin-only access
const Auth = (() => {
  let confirmationResult = null;
  let adminPhones = [];   // soporta múltiples admins
  let recaptchaVerifier = null;

  async function loadAdminPhone() {
    if (adminPhones.length) return adminPhones;
    try {
      const doc = await db.collection(COLL.config).doc('admin').get();
      if (doc.exists) {
        const data = doc.data();
        // Soporta "phones" (array) o "phone" (string legacy)
        if (Array.isArray(data.phones)) {
          adminPhones = data.phones;
        } else if (data.phone) {
          adminPhones = [data.phone];
        }
      }
    } catch (e) { console.error('loadAdminPhone', e); }
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
    await loadAdminPhone();
    return user && adminPhones.includes(user.phoneNumber);
  }

  const signOut = () => auth.signOut();
  const onAuthChange = cb => auth.onAuthStateChanged(cb);

  return { loadAdminPhone, sendCode, verifyCode, checkIsAdmin, signOut, onAuthChange };
})();

// ── UI ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const loginModal = document.getElementById('loginModal');
  const loginBtn = document.getElementById('loginBtn');
  const closeBtn = document.getElementById('closeLoginModal');
  const sendBtn = document.getElementById('sendCodeBtn');
  const verifyBtn = document.getElementById('verifyCodeBtn');
  const phoneInput = document.getElementById('phoneInput');
  const codeInput = document.getElementById('codeInput');
  const loginError = document.getElementById('loginError');
  const step1 = document.getElementById('loginStep1');
  const step2 = document.getElementById('loginStep2');

  function resetModal() {
    step1.style.display = ''; step2.style.display = 'none';
    phoneInput.value = ''; codeInput.value = '';
    loginError.textContent = '';
    sendBtn.textContent = 'Enviar código'; sendBtn.disabled = false;
    verifyBtn.textContent = 'Verificar'; verifyBtn.disabled = false;
  }

  loginBtn.addEventListener('click', () => {
    if (auth.currentUser) {
      const onAdmin = document.getElementById('pageAdmin').classList.contains('active');
      App.showPage(onAdmin ? 'store' : 'admin');
    } else {
      resetModal(); openModal(loginModal);
    }
  });

  closeBtn.addEventListener('click', () => closeModal(loginModal));
  loginModal.addEventListener('click', e => { if (e.target === loginModal) closeModal(loginModal); });
  phoneInput.addEventListener('input', () => { loginError.textContent = ''; });

  sendBtn.addEventListener('click', async () => {
    const digits = phoneInput.value.trim();
    if (digits.replace(/\D/g, '').length < 9) { loginError.textContent = 'Número inválido'; return; }
    loginError.textContent = '';
    sendBtn.textContent = 'Enviando…'; sendBtn.disabled = true;
    try {
      await Auth.sendCode(digits);
      step1.style.display = 'none'; step2.style.display = '';
      showToast('Código enviado 📱', 'success');
      setTimeout(() => codeInput.focus(), 100);
    } catch (e) {
      loginError.textContent = e.message || 'Error al enviar código';
      sendBtn.textContent = 'Enviar código'; sendBtn.disabled = false;
    }
  });

  verifyBtn.addEventListener('click', async () => {
    const code = codeInput.value.trim();
    if (code.length !== 6) { loginError.textContent = 'El código tiene 6 dígitos'; return; }
    verifyBtn.textContent = 'Verificando…'; verifyBtn.disabled = true;
    try {
      const user = await Auth.verifyCode(code);
      const isAdm = await Auth.checkIsAdmin(user);
      if (isAdm) {
        closeModal(loginModal);
        App.showPage('admin');
        showToast('Bienvenido, administrador 👋', 'success');
        Admin.init();
      } else {
        await Auth.signOut();
        loginError.textContent = 'Acceso denegado. Solo administradores pueden ingresar.';
      }
    } catch (e) {
      loginError.textContent = 'Código incorrecto o expirado';
    } finally {
      verifyBtn.textContent = 'Verificar'; verifyBtn.disabled = false;
    }
  });

  Auth.onAuthChange(async user => {
    if (user) {
      const isAdm = await Auth.checkIsAdmin(user);
      if (isAdm) {
        loginBtn.textContent = '🏪'; loginBtn.title = 'Ir a la tienda / Panel';
      } else {
        await Auth.signOut();
      }
    } else {
      loginBtn.textContent = '👤'; loginBtn.title = 'Acceso administrador';
    }
  });

  Auth.loadAdminPhone();
});