'use strict';
const AppDom = {
  byId(id) { return document.getElementById(id); },
  bind(element, eventName, handler, options) {
    if (!element) return;
    const key = `bound${eventName.replace(/[^a-z0-9]/gi, '')}`;
    if (element.dataset[key] === 'true') return;
    element.addEventListener(eventName, handler, options); element.dataset[key] = 'true';
  },
  modal(id) { const element = this.byId(id); return element && typeof bootstrap !== 'undefined' ? bootstrap.Modal.getOrCreateInstance(element) : null; },
  offcanvas(id) { const element = this.byId(id); return element && typeof bootstrap !== 'undefined' ? bootstrap.Offcanvas.getOrCreateInstance(element) : null; }
};
function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function showToast(message, type = 'info') {
  const container = AppDom.byId('toastContainer'); if (!container) return;
  const toastSignature = `${type}:${String(message ?? '')}`;
  const duplicatedToast = Array.from(container.querySelectorAll('.toast')).find(item => item.dataset.toastSignature === toastSignature);
  if (duplicatedToast) {
    const instance = typeof bootstrap !== 'undefined' ? bootstrap.Toast.getOrCreateInstance(duplicatedToast, { delay: 3500 }) : null;
    instance?.show(); return;
  }
  while (container.children.length >= 4) container.firstElementChild?.remove();
  const iconByType = { success: 'check-circle-fill', danger: 'exclamation-triangle-fill', info: 'info-circle-fill', warning: 'exclamation-circle-fill' };
  const classByType = { success: 'text-bg-success', danger: 'text-bg-danger', info: 'text-bg-info', warning: 'text-bg-warning' };
  const toast = document.createElement('div'); toast.className = `toast align-items-center ${classByType[type] || 'text-bg-secondary'} border-0`;
  toast.setAttribute('role', 'alert'); toast.setAttribute('aria-live', 'assertive'); toast.setAttribute('aria-atomic', 'true'); toast.dataset.toastSignature = toastSignature;
  const wrapper = document.createElement('div'); wrapper.className = 'd-flex';
  const body = document.createElement('div'); body.className = 'toast-body';
  const icon = document.createElement('i'); icon.className = `bi bi-${iconByType[type] || 'info-circle-fill'} me-2`;
  const text = document.createElement('span'); text.textContent = String(message ?? '');
  const close = document.createElement('button'); close.type = 'button'; close.className = 'btn-close btn-close-white me-2 m-auto';
  close.setAttribute('data-bs-dismiss', 'toast'); close.setAttribute('aria-label', 'Cerrar');
  body.append(icon, text); wrapper.append(body, close); toast.append(wrapper); container.append(toast);
  if (typeof bootstrap === 'undefined') { toast.classList.add('show'); window.setTimeout(() => toast.remove(), 3500); return; }
  const instance = bootstrap.Toast.getOrCreateInstance(toast, { delay: 3500 });
  toast.addEventListener('hidden.bs.toast', () => toast.remove(), { once: true }); instance.show();
}
window.esc = esc; window.showToast = showToast;
const App = (() => {
  let currentPage = 'store';
  const initializedModules = new Set();
  function initializeModule(name, moduleObject) {
    if (!moduleObject || typeof moduleObject.init !== 'function') return;
    if (!initializedModules.has(name)) { moduleObject.init(); initializedModules.add(name); return; }
    moduleObject.init();
  }
  function showPage(page) {
    if (page === 'admin' && !window.Auth?.hasAdministrativeAccess()) page = 'store';
    const target = AppDom.byId(`page-${page}`);
    if (!target) { console.warn(`Pagina no encontrada: ${page}`); return; }
    currentPage = page;
    document.querySelectorAll('.page-view').forEach(view => {
      const isActive = view === target; view.classList.toggle('active-page', isActive); view.setAttribute('aria-hidden', String(!isActive));
    });
    document.body.dataset.page = page; closeResponsivePanels();
    if (page === 'admin') {
      initializeModule('admin', typeof Admin !== 'undefined' ? Admin : null);
      initializeModule('dashboard', typeof Dashboard !== 'undefined' ? Dashboard : null);
      initializeModule('orders', typeof Orders !== 'undefined' ? Orders : null);
      updateProfileButton(true); document.querySelector('.admin-main')?.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      updateProfileButton(false); document.querySelector('.products-main')?.scrollTo({ top: 0, behavior: 'auto' });
    }
  }
  function updateProfileButton(isAdminPage = currentPage === 'admin') {
    const button = AppDom.byId('profileBtn'); if (!button) return;
    if (isAdminPage) {
      button.innerHTML = '<i class="bi bi-tools"></i>'; button.title = 'Cambiar entre tienda y administracion'; button.setAttribute('aria-label', button.title); return;
    }
    const name = typeof Auth !== 'undefined' ? Auth.getClientName() : '';
    button.innerHTML = '<i class="bi bi-person-circle"></i>'; button.title = name ? `${name} - Mi perfil` : 'Ingresar'; button.setAttribute('aria-label', button.title);
  }
  return { showPage, updateProfileButton, get currentPage() { return currentPage; } };
})();
window.App = App;
function getCurrency() { return window.APP_CONFIG?.currency || 'S/'; }
function sanitizePhone(value) { return String(value ?? '').replace(/\D/g, '').slice(0, 9); }
function localDateValue(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function localTimeValue(date = new Date()) { return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; }
function setBusy(button, busy, busyText, normalHtml) {
  if (!button) return; button.disabled = busy; button.setAttribute('aria-busy', String(busy));
  button.innerHTML = busy ? `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${esc(busyText)}` : normalHtml;
}
function switchAuthTab(tab) {
  const clientCard = AppDom.byId('tabClient'), adminCard = AppDom.byId('tabAdmin');
  const clientPanel = AppDom.byId('panelClient'), adminPanel = AppDom.byId('panelAdmin'), clientActive = tab === 'client';
  clientCard?.classList.toggle('selected', clientActive); clientCard?.classList.toggle('active', clientActive);
  adminCard?.classList.toggle('selected', !clientActive); adminCard?.classList.toggle('active', !clientActive);
  clientCard?.setAttribute('aria-selected', String(clientActive)); adminCard?.setAttribute('aria-selected', String(!clientActive));
  if (clientPanel) clientPanel.style.display = clientActive ? 'block' : 'none';
  if (adminPanel) adminPanel.style.display = clientActive ? 'none' : 'block';
}
function showAuthChoice() {
  const stepOne = AppDom.byId('step1Admin'), stepTwo = AppDom.byId('step2Admin');
  const clientForm = AppDom.byId('clientLoginForm'), nameInput = AppDom.byId('clientName'), phoneInput = AppDom.byId('clientPhone');
  if (stepOne) stepOne.style.display = 'block'; if (stepTwo) stepTwo.style.display = 'none';
  clientForm?.reset(); switchAuthTab('client');
  if (typeof Auth !== 'undefined') { if (nameInput) nameInput.value = Auth.getClientName(); if (phoneInput) phoneInput.value = Auth.getClientPhone(); }
}
async function logoutAdmin() {
  if (typeof Auth === 'undefined') return;
  try { await Auth.logoutAdmin(); App.showPage('store'); App.updateProfileButton(false); showToast('Sesion cerrada', 'info'); }
  catch (error) { console.error('No se pudo cerrar la sesion:', error); showToast('No se pudo cerrar la sesion', 'danger'); }
}
function initAuthModal() {
  if (typeof Auth === 'undefined') return;
  AppDom.bind(AppDom.byId('profileBtn'), 'click', () => {
    const role = Auth.getRole();
    if (role === 'admin') { App.showPage(App.currentPage === 'admin' ? 'store' : 'admin'); return; }
    if (role === 'client') { openProfileModal(); return; }
    showAuthChoice(); AppDom.modal('authModal')?.show();
  });
  AppDom.bind(AppDom.byId('tabClient'), 'click', () => switchAuthTab('client'));
  AppDom.bind(AppDom.byId('tabAdmin'), 'click', () => switchAuthTab('admin'));
  AppDom.bind(AppDom.byId('clientPhone'), 'input', event => { event.target.value = sanitizePhone(event.target.value); });
  AppDom.bind(AppDom.byId('adminPhone'), 'input', event => { event.target.value = sanitizePhone(event.target.value); });
  AppDom.bind(AppDom.byId('clientLoginForm'), 'submit', event => {
    event.preventDefault();
    const name = AppDom.byId('clientName')?.value.trim() || '', phone = sanitizePhone(AppDom.byId('clientPhone')?.value);
    if (!name) { showToast('Ingresa tu nombre', 'warning'); AppDom.byId('clientName')?.focus(); return; }
    if (phone && phone.length !== 9) { showToast('El telefono debe tener 9 digitos', 'warning'); AppDom.byId('clientPhone')?.focus(); return; }
    try { Auth.loginClient(name, phone); } catch (error) { showToast(error.message, 'danger'); return; }
    AppDom.modal('authModal')?.hide(); prefillOrderCustomer(name, phone); App.updateProfileButton(false); App.showPage('store'); showToast(`Hola, ${name}`, 'success');
  });
  AppDom.bind(AppDom.byId('adminPhonePasswordForm'), 'submit', async event => {
    event.preventDefault();
    const phone = sanitizePhone(AppDom.byId('adminPhone')?.value), password = String(AppDom.byId('adminPassword')?.value || '');
    const button = AppDom.byId('adminPhonePasswordSubmit');
    if (!/^9\d{8}$/.test(phone)) { showToast('Ingresa un numero de celular valido de 9 digitos', 'warning'); AppDom.byId('adminPhone')?.focus(); return; }
    if (!/^\d{6}$/.test(password)) { showToast('La contrasena debe tener 6 digitos', 'warning'); AppDom.byId('adminPassword')?.focus(); return; }
    if (button?.disabled) return;
    setBusy(button, true, 'Ingresando...', '<i class="bi bi-shield-lock me-2"></i>Ingresar al panel');
    try {
      const user = await Auth.signInPhonePassword(phone, password, 'adminRecaptchaContainer');
      const revision = Auth.getSessionRevision();
      const allowed = await Auth.checkIsAdmin(user);
      if (revision !== Auth.getSessionRevision()) return;
      Auth.setAdministrativeAccess(user, allowed);
      if (!allowed) { await Auth.logoutAdmin(); throw new Error('Este numero no tiene acceso al panel.'); }
      if (AppDom.byId('adminPassword')) AppDom.byId('adminPassword').value = '';
      AppDom.modal('authModal')?.hide(); App.showPage('admin'); showToast('Sesion administrativa iniciada', 'success');
    } catch (error) { showToast(error?.message || 'No se pudo iniciar sesion', 'danger'); }
    finally { setBusy(button, false, '', '<i class="bi bi-shield-lock me-2"></i>Ingresar al panel'); }
  });
  ['logoutAdminBtn', 'logoutAdminBtn2', 'logoutAdminMobileBtn'].forEach(id => {
    AppDom.bind(AppDom.byId(id), 'click', event => { event.preventDefault(); logoutAdmin(); });
  });
  if (!window.__kioscoAuthObserver) {
    // Administrative observer only: never overwrites an active local customer profile.
    window.__kioscoAuthObserver = Auth.onAuthChange(async user => {
      if (!user && Auth.isAdminLoginPending()) return;
      if (Auth.isClient() && !Auth.isAdminLoginPending()) return;
      if (!user || user.isAnonymous || !Auth.phoneFromCredentialUser(user)) {
        Auth.setAdministrativeAccess(user, false); if (App.currentPage === 'admin') App.showPage('store'); return;
      }
      const revision = Auth.getSessionRevision();
      try {
        const isAdmin = await Auth.checkIsAdmin(user);
        if (revision !== Auth.getSessionRevision() || auth.currentUser?.uid !== user.uid) return;
        if (Auth.isClient() && !Auth.isAdminLoginPending()) return;
        Auth.setAdministrativeAccess(user, isAdmin);
        if (!isAdmin) { await Auth.logoutAdmin(); return; }
        if (document.readyState !== 'loading') App.showPage('admin');
      } catch (error) { console.error('No se pudo validar el rol administrativo:', error); }
    });
  }
  if (!window.__kioscoClientObserver) {
    window.__kioscoClientObserver = true;
    window.addEventListener('auth:client-updated', () => {
      for (const module of [window.Admin, window.Dashboard, window.Orders]) module?.destroy?.();
      if (App.currentPage === 'admin') App.showPage('store');
      App.updateProfileButton(false);
    });
  }
}
function openProfileModal() {
  if (typeof Auth === 'undefined') return;
  const name = AppDom.byId('profileName'), phone = AppDom.byId('profilePhone');
  if (name) name.value = Auth.getClientName(); if (phone) phone.value = Auth.getClientPhone();
  showProfileTab('info'); AppDom.modal('profileModal')?.show();
}
function showProfileTab(tabName) {
  document.querySelectorAll('[data-profile-tab]').forEach(button => {
    const active = button.dataset.profileTab === tabName;
    button.classList.toggle('active', active); button.classList.toggle('btn-primary', active); button.classList.toggle('btn-outline-secondary', !active); button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.profile-pane').forEach(pane => {
    const active = pane.id === `profilePane-${tabName}`; pane.classList.toggle('active', active); pane.style.display = active ? 'block' : 'none';
  });
  if (tabName === 'orders') loadProfileOrders();
}
function initProfileModal() {
  AppDom.bind(AppDom.byId('profilePhone'), 'input', event => { event.target.value = sanitizePhone(event.target.value); });
  AppDom.bind(AppDom.byId('saveProfileBtn'), 'click', () => {
    if (typeof Auth === 'undefined') return;
    const name = AppDom.byId('profileName')?.value.trim() || '', phone = sanitizePhone(AppDom.byId('profilePhone')?.value);
    if (!name) { showToast('El nombre es obligatorio', 'warning'); AppDom.byId('profileName')?.focus(); return; }
    if (phone && phone.length !== 9) { showToast('El telefono debe tener 9 digitos', 'warning'); AppDom.byId('profilePhone')?.focus(); return; }
    try { Auth.loginClient(name, phone); } catch (error) { showToast(error.message, 'danger'); return; }
    prefillOrderCustomer(name, phone); App.updateProfileButton(false); AppDom.modal('profileModal')?.hide(); showToast('Perfil actualizado', 'success');
  });
  AppDom.bind(AppDom.byId('logoutClientBtn'), 'click', () => {
    if (typeof Auth === 'undefined') return;
    Auth.logoutClient(); AppDom.modal('profileModal')?.hide(); App.updateProfileButton(false); showToast('Sesion cerrada', 'info');
  });
  document.querySelectorAll('[data-profile-tab]').forEach(button => AppDom.bind(button, 'click', () => showProfileTab(button.dataset.profileTab)));
}
async function loadProfileOrders() {
  const container = AppDom.byId('profileOrdersList'); if (!container || typeof Auth === 'undefined') return;
  const name = Auth.getClientName(), phone = Auth.getClientPhone();
  if (!name) { container.innerHTML = '<p class="text-muted mb-0">Ingresa tu nombre para consultar tus pedidos.</p>'; return; }
  container.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Cargando</span></div></div>';
  const revision = Auth.getSessionRevision();
  try {
    const database = window.clientDb || window.db;
    // Name/phone filtering is a convenience, not identity verification or authorization.
    const query = database.collection(COLL.orders).where(phone ? 'customerPhone' : 'customer', '==', phone || name);
    const snapshot = await query.get();
    if (revision !== Auth.getSessionRevision()) return;
    const orders = snapshot.docs.map(documentSnapshot => ({ id: documentSnapshot.id, ...documentSnapshot.data() }))
      .sort((left, right) => (right.createdAt?.toDate?.() || new Date(0)) - (left.createdAt?.toDate?.() || new Date(0))).slice(0, 20);
    if (!orders.length) { container.innerHTML = '<p class="text-muted mb-0">Aun no tienes pedidos.</p>'; return; }
    const badgeByStatus = { pending: 'warning', done: 'success', rejected: 'danger' }, labelByStatus = { pending: 'Pendiente', done: 'Completado', rejected: 'Rechazado' };
    container.innerHTML = orders.map(order => {
      const date = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Fecha pendiente';
      const items = (Array.isArray(order.items) ? order.items : []).map(item => `${item.name} x${item.qty}`).join(', ');
      const status = String(order.status || 'pending'), badge = badgeByStatus[status] || 'secondary', label = labelByStatus[status] || status;
      return `<article class="card mb-2"><div class="card-body p-3"><div class="d-flex justify-content-between align-items-center gap-2 mb-1"><small class="text-muted">${esc(date)}</small><span class="badge text-bg-${badge}">${esc(label)}</span></div><p class="mb-1 small">${esc(items || 'Sin detalle')}</p><strong class="text-primary">${esc(getCurrency())} ${Number(order.total || 0).toFixed(2)}</strong></div></article>`;
    }).join('');
  } catch (error) {
    console.error('No se pudieron cargar los pedidos del perfil:', error);
    if (revision === Auth.getSessionRevision()) container.innerHTML = `<p class="text-danger small mb-0"><i class="bi bi-exclamation-triangle me-1"></i>${esc(error?.message || 'No se pudieron cargar los pedidos')}</p>`;
  }
}
function updateDeliveryFields() {
  const delivery = document.querySelector('input[name="deliveryType"]:checked')?.value === 'delivery';
  const addressRow = AppDom.byId('addressRow'), address = AppDom.byId('orderAddress');
  if (addressRow) addressRow.style.display = delivery ? 'block' : 'none'; if (address) address.required = delivery;
}
function prefillOrderCustomer(name, phone = '') {
  const nameInput = AppDom.byId('orderCustomerName'), phoneInput = AppDom.byId('orderCustomerPhone');
  if (nameInput && name && !nameInput.value.trim()) nameInput.value = name;
  if (phoneInput && phone && !phoneInput.value.trim()) phoneInput.value = phone;
}
function renderOrderSummary() {
  const summary = AppDom.byId('orderSummary'); if (!summary || typeof Cart === 'undefined') return;
  summary.innerHTML = Cart.getItems().map(item => `<div class="d-flex justify-content-between gap-3 small mb-1"><span>${esc(item.name)} x${Number(item.qty || 0)}</span><span class="text-nowrap">${esc(getCurrency())} ${(Number(item.price || 0) * Number(item.qty || 0)).toFixed(2)}</span></div>`).join('') + `<div class="d-flex justify-content-between fw-bold border-top mt-2 pt-2"><span>Total</span><span>${esc(getCurrency())} ${Number(Cart.total()).toFixed(2)}</span></div>`;
}
function openOrderModal() {
  if (typeof Cart === 'undefined' || !Cart.count()) { showToast('Tu carrito esta vacio', 'warning'); return; }
  AppDom.offcanvas('cartOffcanvas')?.hide();
  if (typeof Auth !== 'undefined') prefillOrderCustomer(Auth.getClientName(), Auth.getClientPhone());
  const now = new Date(), maximumDate = new Date(now), suggestedTime = new Date(now.getTime() + 30 * 60 * 1000);
  maximumDate.setDate(maximumDate.getDate() + 3);
  const dateInput = AppDom.byId('orderDate'), timeInput = AppDom.byId('orderTime'), pickup = AppDom.byId('dtPickup');
  const address = AppDom.byId('orderAddress'), gpsStatus = AppDom.byId('gpsStatus');
  if (dateInput) { dateInput.value = localDateValue(now); dateInput.min = localDateValue(now); dateInput.max = localDateValue(maximumDate); }
  if (timeInput && !timeInput.value) timeInput.value = localTimeValue(suggestedTime);
  if (pickup) pickup.checked = true;
  if (address) { address.required = false; delete address.dataset.lat; delete address.dataset.lng; }
  if (gpsStatus) gpsStatus.textContent = '';
  updateDeliveryFields(); renderOrderSummary(); AppDom.modal('orderModal')?.show();
}
async function useCurrentLocation() {
  const status = AppDom.byId('gpsStatus'), address = AppDom.byId('orderAddress'), button = AppDom.byId('useGpsBtn');
  if (!navigator.geolocation) { showToast('La geolocalizacion no esta disponible', 'warning'); return; }
  if (status) status.textContent = 'Obteniendo ubicacion...'; if (button) button.disabled = true;
  navigator.geolocation.getCurrentPosition(position => {
    const latitude = position.coords.latitude.toFixed(6), longitude = position.coords.longitude.toFixed(6);
    if (address) { address.value = `GPS: ${latitude}, ${longitude}`; address.dataset.lat = latitude; address.dataset.lng = longitude; }
    if (status) status.innerHTML = `<a href="https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}" target="_blank" rel="noopener noreferrer" class="small">Ver ubicacion en Google Maps</a>`;
    if (button) button.disabled = false;
  }, error => {
    console.warn('No se pudo obtener la ubicacion:', error); if (status) status.textContent = ''; if (button) button.disabled = false; showToast('No se pudo obtener tu ubicacion', 'warning');
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
}
async function submitOrder() {
  if (typeof Cart === 'undefined') return;
  const name = AppDom.byId('orderCustomerName')?.value.trim() || '', phone = sanitizePhone(AppDom.byId('orderCustomerPhone')?.value);
  const notes = AppDom.byId('orderNotes')?.value.trim() || '', deliveryType = document.querySelector('input[name="deliveryType"]:checked')?.value || 'pickup';
  const addressElement = AppDom.byId('orderAddress'), address = addressElement?.value.trim() || '';
  const scheduledDate = AppDom.byId('orderDate')?.value || '', scheduledTime = AppDom.byId('orderTime')?.value || '', button = AppDom.byId('confirmOrderBtn');
  if (button?.disabled) return;
  if (!name) { showToast('Ingresa tu nombre', 'warning'); AppDom.byId('orderCustomerName')?.focus(); return; }
  if (phone && phone.length !== 9) { showToast('El telefono debe tener 9 digitos', 'warning'); AppDom.byId('orderCustomerPhone')?.focus(); return; }
  if (deliveryType === 'delivery' && !address) { showToast('Ingresa la direccion de entrega', 'warning'); addressElement?.focus(); return; }
  if (!scheduledDate || !scheduledTime) { showToast('Selecciona la fecha y hora del pedido', 'warning'); return; }
  const gps = addressElement?.dataset.lat ? { lat: Number(addressElement.dataset.lat), lng: Number(addressElement.dataset.lng) } : null;
  setBusy(button, true, 'Enviando...', '<i class="bi bi-send me-2"></i>Confirmar Pedido');
  try {
    const orderId = await Cart.checkout(name, phone, notes, deliveryType, address, scheduledDate, scheduledTime, gps);
    if (typeof Auth !== 'undefined' && !Auth.getClientName()) {
      try { Auth.loginClient(name, phone); } catch { showToast('Pedido registrado. El navegador no pudo guardar tu perfil local.', 'warning'); }
    }
    App.updateProfileButton(false); AppDom.modal('orderModal')?.hide(); showToast(`Pedido enviado: #${String(orderId).slice(-6).toUpperCase()}`, 'success');
  } catch (error) { console.error('No se pudo confirmar el pedido:', error); showToast(error?.message || 'No se pudo enviar el pedido', 'danger'); }
  finally { setBusy(button, false, '', '<i class="bi bi-send me-2"></i>Confirmar Pedido'); }
}
function initOrderModal() {
  ['sendOrderBtn', 'sendOrderBtnMobile'].forEach(id => AppDom.bind(AppDom.byId(id), 'click', openOrderModal));
  document.querySelectorAll('input[name="deliveryType"]').forEach(input => AppDom.bind(input, 'change', updateDeliveryFields));
  AppDom.bind(AppDom.byId('orderCustomerPhone'), 'input', event => { event.target.value = sanitizePhone(event.target.value); });
  AppDom.bind(AppDom.byId('useGpsBtn'), 'click', useCurrentLocation); AppDom.bind(AppDom.byId('confirmOrderBtn'), 'click', submitOrder);
}
function preferredTheme() {
  const saved = localStorage.getItem('kk_theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function setTheme(theme, persist = true) {
  const nextTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-bs-theme', nextTheme); document.body?.setAttribute('data-bs-theme', nextTheme);
  if (persist) localStorage.setItem('kk_theme', nextTheme);
  const iconClass = nextTheme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
  const label = nextTheme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
  document.querySelectorAll('#themeToggleBtn i, #themeToggleBtn2 i').forEach(icon => { icon.className = iconClass; });
  ['themeToggleBtn', 'themeToggleBtn2'].forEach(id => {
    const button = AppDom.byId(id); if (!button) return; button.title = label; button.setAttribute('aria-label', label);
  });
  const themeColor = document.querySelector('meta[name="theme-color"]'); if (themeColor) themeColor.content = nextTheme === 'dark' ? '#0d0d14' : '#f97316';
  window.dispatchEvent(new CustomEvent('kiosco:themechange', { detail: { theme: nextTheme } }));
}
function initTheme() {
  setTheme(preferredTheme(), false);
  ['themeToggleBtn', 'themeToggleBtn2'].forEach(id => AppDom.bind(AppDom.byId(id), 'click', () => {
    const current = document.documentElement.getAttribute('data-bs-theme') || 'dark'; setTheme(current === 'dark' ? 'light' : 'dark');
  }));
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemTheme = event => { if (localStorage.getItem('kk_theme')) return; setTheme(event.matches ? 'dark' : 'light', false); };
  if (typeof mediaQuery.addEventListener === 'function') mediaQuery.addEventListener('change', handleSystemTheme);
}
function isValidHexColor(value) { return /^#[0-9a-f]{6}$/i.test(String(value || '')); }
function applyBrandLogo(url, emoji) {
  document.querySelectorAll('.logo-icon').forEach(container => {
    container.replaceChildren();
    if (url) {
      const image = document.createElement('img');
      Object.assign(image, { src: url, alt: 'Logo de la tienda', width: 32, height: 32, loading: 'eager' });
      image.style.borderRadius = '8px'; image.style.objectFit = 'cover';
      image.addEventListener('error', () => { container.textContent = emoji || '\uD83D\uDECD\uFE0F'; }, { once: true });
      container.append(image); return;
    }
    container.textContent = emoji || '\uD83D\uDECD\uFE0F';
  });
}
async function loadGlobalBranding() {
  if (typeof db === 'undefined' || typeof COLL === 'undefined') return;
  try {
    const snapshot = await db.collection(COLL.config).doc('theme').get(); if (!snapshot.exists) return;
    const config = snapshot.data() || {};
    if (isValidHexColor(config.accentColor)) {
      const red = parseInt(config.accentColor.slice(1, 3), 16), green = parseInt(config.accentColor.slice(3, 5), 16), blue = parseInt(config.accentColor.slice(5, 7), 16);
      document.documentElement.style.setProperty('--accent', config.accentColor); document.documentElement.style.setProperty('--accent-rgb', `${red}, ${green}, ${blue}`);
      document.documentElement.style.setProperty('--bs-primary', config.accentColor); document.documentElement.style.setProperty('--bs-primary-rgb', `${red}, ${green}, ${blue}`);
    }
    if (config.storeName) {
      const storeName = String(config.storeName).trim(); document.querySelectorAll('.logo-text').forEach(element => { element.textContent = storeName; });
      document.title = storeName; if (window.APP_CONFIG) window.APP_CONFIG.storeName = storeName;
    }
    let logoUrl = '';
    if (config.storeLogoUrl) {
      try { const parsedUrl = new URL(String(config.storeLogoUrl), window.location.href); if (['http:', 'https:'].includes(parsedUrl.protocol)) logoUrl = parsedUrl.href; } catch { logoUrl = ''; }
    }
    applyBrandLogo(logoUrl, String(config.storeEmoji || '').trim());
  } catch (error) { console.warn('No se pudo cargar la apariencia global:', error?.message || error); }
}
let deferredInstallPrompt = null;
function isStandaloneMode() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
function updateInstallButton() {
  const button = AppDom.byId('installPwaBtn'); if (!button) return;
  const visible = Boolean(deferredInstallPrompt) && !isStandaloneMode();
  button.classList.toggle('d-none', !visible); button.style.display = visible ? 'inline-flex' : 'none'; button.disabled = !visible; button.setAttribute('aria-hidden', String(!visible));
}
async function promptPwaInstall() {
  if (!deferredInstallPrompt || isStandaloneMode()) { updateInstallButton(); return; }
  const button = AppDom.byId('installPwaBtn'); if (button) button.disabled = true;
  try { await deferredInstallPrompt.prompt(); const choice = await deferredInstallPrompt.userChoice; if (choice.outcome === 'accepted') showToast('Aplicacion instalada', 'success'); }
  catch (error) { console.error('No se pudo iniciar la instalacion:', error); showToast('No se pudo iniciar la instalacion', 'warning'); }
  finally { deferredInstallPrompt = null; updateInstallButton(); }
}
function initPwaInstall() {
  updateInstallButton();
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; updateInstallButton(); });
  window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; updateInstallButton(); showToast('Aplicacion instalada correctamente', 'success'); });
  AppDom.bind(AppDom.byId('installPwaBtn'), 'click', promptPwaInstall);
}
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !['http:', 'https:'].includes(window.location.protocol)) return;
  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }); registration.update().catch(() => {});
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; window.location.reload(); });
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing; if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) showToast('Nueva version disponible. Se aplicara al recargar.', 'info');
      });
    });
  } catch (error) { console.warn('No se pudo registrar el Service Worker:', error?.message || error); }
}
function ensureCategoryOffcanvas() {
  if (AppDom.byId('categoryOffcanvas')) return;
  const element = document.createElement('div'); element.className = 'offcanvas offcanvas-start'; element.id = 'categoryOffcanvas'; element.tabIndex = -1;
  element.setAttribute('aria-labelledby', 'categoryOffcanvasLabel');
  element.innerHTML = `<div class="offcanvas-header border-bottom"><h5 class="offcanvas-title fw-bold" id="categoryOffcanvasLabel"><i class="bi bi-tags me-2"></i>Categorias</h5><button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button></div><div class="offcanvas-body"><ul class="nav flex-column" id="categoryListMobile"></ul></div>`;
  document.body.append(element);
}
function ensureAdminOffcanvas() {
  const adminHeaderActions = document.querySelector('#page-admin .header-actions');
  if (!AppDom.byId('adminMenuBtn') && adminHeaderActions) {
    const button = document.createElement('button'); button.type = 'button'; button.id = 'adminMenuBtn'; button.className = 'btn-icon d-lg-none'; button.title = 'Menu administrativo';
    button.setAttribute('aria-label', button.title); button.innerHTML = '<i class="bi bi-list"></i>'; adminHeaderActions.insertBefore(button, AppDom.byId('backToStoreBtn'));
  }
  if (AppDom.byId('adminOffcanvas')) return;
  const element = document.createElement('div'); element.className = 'offcanvas offcanvas-start'; element.id = 'adminOffcanvas'; element.tabIndex = -1; element.setAttribute('aria-labelledby', 'adminOffcanvasLabel');
  element.innerHTML = `<div class="offcanvas-header border-bottom"><h5 class="offcanvas-title fw-bold" id="adminOffcanvasLabel"><i class="bi bi-grid me-2"></i>Administracion</h5><button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button></div><div class="offcanvas-body d-flex flex-column"><nav class="nav flex-column" id="adminNavMobile"></nav><button type="button" class="btn btn-outline-danger btn-sm w-100 mt-auto" id="logoutAdminMobileBtn"><i class="bi bi-box-arrow-right me-2"></i>Cerrar sesion</button></div>`;
  document.body.append(element);
}
function ensureResponsiveElements() { ensureCategoryOffcanvas(); ensureAdminOffcanvas(); }
function syncCategoryMenu() { const desktop = AppDom.byId('categoryList'), mobile = AppDom.byId('categoryListMobile'); if (desktop && mobile) mobile.innerHTML = desktop.innerHTML; }
function syncAdminMenu() {
  const desktop = document.querySelector('.admin-sidebar'), mobile = AppDom.byId('adminNavMobile'); if (!desktop || !mobile) return;
  mobile.replaceChildren(); desktop.querySelectorAll('[data-admin-section]').forEach(link => {
    const clone = link.cloneNode(true); clone.classList.toggle('active', link.classList.contains('active')); mobile.append(clone);
  });
}
function closeResponsivePanels() {
  ['categoryOffcanvas', 'adminOffcanvas', 'cartOffcanvas'].forEach(id => {
    const element = AppDom.byId(id); if (element && typeof bootstrap !== 'undefined') bootstrap.Offcanvas.getInstance(element)?.hide();
  });
}
function renderMobileCart() { if (typeof Cart !== 'undefined' && typeof Cart.render === 'function') Cart.render(); }
function shareCart() {
  if (typeof Cart === 'undefined' || !Cart.count()) { showToast('Tu carrito esta vacio', 'warning'); return; }
  const storeName = window.APP_CONFIG?.storeName || document.querySelector('.logo-text')?.textContent || 'Kiosco';
  const lines = Cart.getItems().map(item => `- ${item.name} x${item.qty} - ${getCurrency()} ${(Number(item.price || 0) * Number(item.qty || 0)).toFixed(2)}`);
  const message = [storeName, '', ...lines, '', `Total: ${getCurrency()} ${Number(Cart.total()).toFixed(2)}`].join('\n');
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
}
function findDesktopCategoryLink(mobileLink) {
  const category = mobileLink.dataset.cat || '', subcategory = mobileLink.dataset.sub || '';
  return Array.from(document.querySelectorAll('#categoryList .cat-link')).find(link => (link.dataset.cat || '') === category && (link.dataset.sub || '') === subcategory);
}
function initResponsiveUi() {
  ensureResponsiveElements(); syncCategoryMenu(); syncAdminMenu();
  AppDom.bind(AppDom.byId('sidebarToggleBtn'), 'click', () => { syncCategoryMenu(); AppDom.offcanvas('categoryOffcanvas')?.show(); });
  AppDom.bind(AppDom.byId('cartMobileBtn'), 'click', () => { renderMobileCart(); AppDom.offcanvas('cartOffcanvas')?.show(); });
  AppDom.bind(AppDom.byId('adminMenuBtn'), 'click', () => { syncAdminMenu(); AppDom.offcanvas('adminOffcanvas')?.show(); });
  ['shareWhatsappBtn', 'shareWhatsappBtnMobile'].forEach(id => AppDom.bind(AppDom.byId(id), 'click', shareCart));
  document.addEventListener('click', event => {
    const categoryLink = event.target.closest('#categoryListMobile .cat-link');
    if (categoryLink) { event.preventDefault(); findDesktopCategoryLink(categoryLink)?.click(); AppDom.offcanvas('categoryOffcanvas')?.hide(); return; }
    const adminLink = event.target.closest('#adminNavMobile [data-admin-section]');
    if (adminLink) {
      event.preventDefault(); const section = adminLink.dataset.adminSection;
      Array.from(document.querySelectorAll('.admin-sidebar [data-admin-section]')).find(link => link.dataset.adminSection === section)?.click();
      AppDom.offcanvas('adminOffcanvas')?.hide(); return;
    }
    if (event.target.closest('.logo-wrap')) { event.preventDefault(); App.showPage('store'); }
  });
  const categoryList = AppDom.byId('categoryList');
  if (categoryList && !categoryList.__appObserver) { const observer = new MutationObserver(syncCategoryMenu); observer.observe(categoryList, { childList: true, subtree: true, attributes: true }); categoryList.__appObserver = observer; }
  const adminSidebar = document.querySelector('.admin-sidebar');
  if (adminSidebar && !adminSidebar.__appObserver) { const observer = new MutationObserver(syncAdminMenu); observer.observe(adminSidebar, { childList: true, subtree: true, attributes: true }); adminSidebar.__appObserver = observer; }
}
function initAdminNavigation() { AppDom.bind(AppDom.byId('backToStoreBtn'), 'click', () => App.showPage('store')); }
function exposeModules() {
  if (typeof Auth !== 'undefined') window.Auth = Auth; if (typeof Store !== 'undefined') window.Store = Store;
  if (typeof Cart !== 'undefined') window.Cart = Cart; if (typeof Orders !== 'undefined') window.Orders = Orders;
  if (typeof Dashboard !== 'undefined') window.Dashboard = Dashboard; if (typeof Admin !== 'undefined') window.Admin = Admin;
}
async function bootstrapApplication() {
  exposeModules(); initTheme(); initPwaInstall(); ensureResponsiveElements(); initAuthModal(); initProfileModal(); initOrderModal(); initAdminNavigation(); initResponsiveUi();
  loadGlobalBranding(); registerServiceWorker();
  if (typeof Store !== 'undefined') Store.init(); if (typeof Cart !== 'undefined') Cart.init();
  App.showPage('store'); renderMobileCart(); if (Auth.hasAdministrativeAccess()) App.showPage('admin');
}
document.addEventListener('DOMContentLoaded', () => {
  bootstrapApplication().catch(error => { console.error('No se pudo iniciar la aplicacion:', error); showToast('No se pudo iniciar la aplicacion correctamente', 'danger'); });
});
