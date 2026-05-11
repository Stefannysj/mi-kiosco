// js/features.js
// Funcionalidades nuevas: productos destacados, stock bajo, perfil cliente,
// dirección de entrega, tiempo estimado, chat, horario, roles, temas, gastos

// ══════════════════════════════════════════════════════════════════════════
//  3. PRODUCTOS DESTACADOS
// ══════════════════════════════════════════════════════════════════════════
const Featured = (() => {
  let unsub = null;

  function init() {
    const section = document.getElementById('featuredSection');
    if (!section) return;

    if (unsub) unsub();
    unsub = db.collection(COLL.products)
      .where('active', '==', true)
      .where('featured', '==', true)
      .orderBy('name')
      .limit(8)
      .onSnapshot(snap => {
        const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFeatured(products);
      });
  }

  function renderFeatured(products) {
    const grid = document.getElementById('featuredGrid');
    if (!grid) return;
    const section = document.getElementById('featuredSection');

    if (!products.length) {
      if (section) section.style.display = 'none';
      return;
    }
    if (section) section.style.display = '';

    grid.innerHTML = products.map(p => `
      <div class="featured-card animate-in" data-id="${p.id}">
        <div class="featured-badge">⭐ Destacado</div>
        <div class="featured-img">
          ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}" loading="lazy"/>` : `<span>${p.emoji || '🛍️'}</span>`}
        </div>
        <div class="featured-info">
          <p class="featured-name">${p.name}</p>
          <p class="featured-price">${APP_CONFIG.currency} ${Number(p.price).toFixed(2)}</p>
        </div>
        <button class="btn-primary featured-add" data-id="${p.id}">Agregar 🛒</button>
      </div>
    `).join('');

    grid.querySelectorAll('.featured-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const snap = db.collection(COLL.products).doc(id).get().then(d => {
          if (d.exists) Cart.addItem({ id: d.id, ...d.data() });
        });
      });
    });
  }

  return { init };
})();

// ══════════════════════════════════════════════════════════════════════════
//  5. ALERTA DE STOCK BAJO (Admin)
// ══════════════════════════════════════════════════════════════════════════
const StockAlerts = (() => {
  function init() {
    db.collection(COLL.products)
      .where('active', '==', true)
      .onSnapshot(snap => {
        const low = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.stock !== null && p.stock !== undefined && p.stock <= 3);
        if (low.length) showStockAlert(low);
      });
  }

  function showStockAlert(products) {
    const existing = document.getElementById('stockAlertBanner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'stockAlertBanner';
    banner.className = 'stock-alert-banner';
    banner.innerHTML = `
      <span>⚠️ Stock bajo:</span>
      ${products.map(p => `<span class="stock-alert-item">${p.name} (${p.stock} restantes)</span>`).join('')}
      <button onclick="this.parentElement.remove()">✕</button>
    `;
    document.getElementById('adminContent')?.prepend(banner);
  }

  return { init };
})();

// ══════════════════════════════════════════════════════════════════════════
//  6. PERFIL DE CLIENTE CON HISTORIAL
// ══════════════════════════════════════════════════════════════════════════
const CustomerProfile = (() => {
  const KEY = 'kiosco_customer';

  function getProfile() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
    catch { return null; }
  }

  function saveProfile(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function init() {
    const profile = getProfile();
    if (profile) {
      ['customerName', 'customerNameMobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value) el.value = profile.name || '';
      });
    }

    // Save name when user types it
    ['customerName', 'customerNameMobile'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', e => {
        const p = getProfile() || {};
        p.name = e.target.value.trim();
        saveProfile(p);
      });
    });
  }

  async function getOrderHistory(name) {
    if (!name) return [];
    try {
      const snap = await db.collection(COLL.orders)
        .where('customer', '==', name)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch { return []; }
  }

  function showHistory(orders) {
    const modal = document.getElementById('historyModal');
    const list  = document.getElementById('historyList');
    if (!modal || !list) return;

    list.innerHTML = !orders.length
      ? '<p class="empty-state">No tienes pedidos anteriores</p>'
      : orders.map(o => {
          const date = o.createdAt?.toDate
            ? o.createdAt.toDate().toLocaleDateString('es-PE')
            : '';
          const statusIcon = { pending:'⏳', done:'✅', rejected:'❌' }[o.status] || '•';
          return `<div class="history-item">
            <div class="history-meta">
              <span>${statusIcon} ${date}</span>
              <strong>${APP_CONFIG.currency} ${(o.total||0).toFixed(2)}</strong>
            </div>
            <p class="history-items">${(o.items||[]).map(i=>`${i.name} ×${i.qty}`).join(', ')}</p>
            <button class="btn-outline btn-sm repeat-order" data-items='${JSON.stringify(o.items||[])}'>
              🔁 Repetir pedido
            </button>
          </div>`;
        }).join('');

    list.querySelectorAll('.repeat-order').forEach(btn => {
      btn.addEventListener('click', () => {
        const items = JSON.parse(btn.dataset.items);
        items.forEach(item => {
          for (let i = 0; i < item.qty; i++) {
            Cart.addItem({ id: item.productId, name: item.name, price: item.price });
          }
        });
        closeModal(modal);
        showToast('Pedido repetido 🔁', 'success');
      });
    });

    openModal(modal);
  }

  return { init, getProfile, saveProfile, getOrderHistory, showHistory };
})();

// ══════════════════════════════════════════════════════════════════════════
//  7. DIRECCIÓN DE ENTREGA
// ══════════════════════════════════════════════════════════════════════════
const Delivery = (() => {
  function getAddressHTML() {
    return `
      <div class="form-row" id="deliveryAddressRow">
        <label>📍 Dirección de entrega (opcional)</label>
        <input type="text" id="deliveryAddress" class="input-field"
          placeholder="Ej: Jr. Los Rosales 123, piso 2" />
        <input type="text" id="deliveryRef" class="input-field" style="margin-top:.4rem"
          placeholder="Referencia (color de puerta, etc.)" />
      </div>
    `;
  }

  function getDeliveryData() {
    return {
      address:   document.getElementById('deliveryAddress')?.value.trim() || null,
      reference: document.getElementById('deliveryRef')?.value.trim()     || null
    };
  }

  function injectIntoCartFooter() {
    ['cartFooter', 'cartFooterMobile'].forEach(id => {
      const footer = document.getElementById(id);
      if (!footer || footer.querySelector('#deliveryAddressRow')) return;
      const nameInput = footer.querySelector('input[type=text]');
      if (nameInput) nameInput.insertAdjacentHTML('afterend', getAddressHTML());
    });
  }

  return { getDeliveryData, injectIntoCartFooter };
})();

// ══════════════════════════════════════════════════════════════════════════
//  8. TIEMPO ESTIMADO DE ENTREGA
// ══════════════════════════════════════════════════════════════════════════
const DeliveryTime = (() => {
  let estimatedMinutes = null;

  async function load() {
    try {
      const doc = await db.collection(COLL.config).doc('delivery').get();
      if (doc.exists) estimatedMinutes = doc.data().estimatedMinutes || null;
    } catch {}
    renderBanner();
  }

  function renderBanner() {
    const banner = document.getElementById('deliveryTimeBanner');
    if (!estimatedMinutes) { if (banner) banner.style.display = 'none'; return; }
    if (banner) {
      banner.style.display = '';
      banner.textContent = `⏱️ Tiempo estimado de entrega: ${estimatedMinutes} minutos`;
    }
  }

  async function save(minutes) {
    await db.collection(COLL.config).doc('delivery').set({
      estimatedMinutes: parseInt(minutes) || null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    estimatedMinutes = minutes;
    showToast('Tiempo de entrega actualizado ✅', 'success');
  }

  return { load, save, get minutes() { return estimatedMinutes; } };
})();

// ══════════════════════════════════════════════════════════════════════════
//  9. CHAT EN TIEMPO REAL
// ══════════════════════════════════════════════════════════════════════════
const Chat = (() => {
  let orderId = null;
  let unsub   = null;

  function open(oId, customerName) {
    orderId = oId;
    const modal = document.getElementById('chatModal');
    if (!modal) return;
    document.getElementById('chatOrderTitle').textContent =
      `💬 Chat — ${customerName || 'Cliente'}`;
    document.getElementById('chatMessages').innerHTML = '';
    openModal(modal);
    subscribeMessages();
  }

  function subscribeMessages() {
    if (unsub) unsub();
    if (!orderId) return;
    unsub = db.collection(COLL.orders).doc(orderId)
      .collection('messages')
      .orderBy('createdAt')
      .onSnapshot(snap => {
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderMessages(msgs);
      });
  }

  function renderMessages(msgs) {
    const box = document.getElementById('chatMessages');
    if (!box) return;
    box.innerHTML = msgs.map(m => `
      <div class="chat-msg ${m.role === 'admin' ? 'chat-admin' : 'chat-client'}">
        <p>${m.text}</p>
        <span class="chat-time">${m.createdAt?.toDate
          ? m.createdAt.toDate().toLocaleTimeString('es-PE', {hour:'2-digit',minute:'2-digit'})
          : ''}</span>
      </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
  }

  async function send(text, role = 'admin') {
    if (!orderId || !text.trim()) return;
    await db.collection(COLL.orders).doc(orderId)
      .collection('messages').add({
        text: text.trim(),
        role,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  }

  function close() {
    if (unsub) { unsub(); unsub = null; }
    orderId = null;
    closeModal(document.getElementById('chatModal'));
  }

  return { open, send, close };
})();

// ══════════════════════════════════════════════════════════════════════════
//  12. HORARIO DE ATENCIÓN
// ══════════════════════════════════════════════════════════════════════════
const Schedule = (() => {
  const DAYS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  let schedule = null;

  async function load() {
    try {
      const doc = await db.collection(COLL.config).doc('schedule').get();
      schedule = doc.exists ? doc.data() : null;
    } catch {}
    checkOpen();
  }

  function isOpenNow() {
    if (!schedule) return true; // default: always open
    const now  = new Date();
    const day  = DAYS[now.getDay()];
    const slot = schedule[day];
    if (!slot || !slot.open) return false;
    const [oh, om] = slot.from.split(':').map(Number);
    const [ch, cm] = slot.to.split(':').map(Number);
    const nowMin   = now.getHours() * 60 + now.getMinutes();
    return nowMin >= oh * 60 + om && nowMin <= ch * 60 + cm;
  }

  function checkOpen() {
    const banner  = document.getElementById('closedBanner');
    const cartBtns = document.querySelectorAll('#sendOrderBtn, #sendOrderBtnMobile');
    const open    = isOpenNow();

    if (banner) banner.style.display = open ? 'none' : '';
    cartBtns.forEach(btn => {
      btn.disabled = !open;
      if (!open) btn.title = 'La tienda está cerrada';
    });
  }

  async function save(data) {
    await db.collection(COLL.config).doc('schedule').set({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    schedule = data;
    showToast('Horario actualizado ✅', 'success');
  }

  return { load, isOpenNow, checkOpen, save, get data() { return schedule; }, DAYS };
})();

// ══════════════════════════════════════════════════════════════════════════
//  13. ROLES: ADMIN PRINCIPAL Y EMPLEADO
// ══════════════════════════════════════════════════════════════════════════
const Roles = (() => {
  // Roles: 'owner' = acceso total, 'staff' = solo ver pedidos y cambiar estado
  let currentRole = null;

  async function getRole(phoneNumber) {
    try {
      const doc = await db.collection(COLL.config).doc('admin').get();
      if (!doc.exists) return null;
      const data = doc.data();
      // Owner phones
      const owners = Array.isArray(data.phones) ? data.phones : (data.phone ? [data.phone] : []);
      if (owners.includes(phoneNumber)) return 'owner';
      // Staff phones
      const staff = Array.isArray(data.staff) ? data.staff : [];
      if (staff.includes(phoneNumber)) return 'staff';
      return null;
    } catch { return null; }
  }

  function applyRole(role) {
    currentRole = role;
    // Hide owner-only sections for staff
    if (role === 'staff') {
      document.querySelectorAll('.owner-only').forEach(el => el.style.display = 'none');
      // Staff only sees orders
      document.querySelector('[data-section="orders"]')?.click();
    }
  }

  return { getRole, applyRole, get current() { return currentRole; } };
})();

// ══════════════════════════════════════════════════════════════════════════
//  15. PERSONALIZAR COLORES Y LOGO
// ══════════════════════════════════════════════════════════════════════════
const Branding = (() => {
  async function load() {
    try {
      const doc = await db.collection(COLL.config).doc('branding').get();
      if (doc.exists) apply(doc.data());
    } catch {}
  }

  function apply(data) {
    if (data.accentColor) {
      document.documentElement.style.setProperty('--accent', data.accentColor);
      document.querySelectorAll('.theme-dark, .theme-light').forEach(el => {
        el.style.setProperty('--accent', data.accentColor);
      });
      // Also update body directly
      document.body.style.setProperty('--accent', data.accentColor);
    }
    if (data.storeName) {
      document.querySelectorAll('.logo-text').forEach(el => el.textContent = data.storeName);
      document.title = data.storeName;
    }
    if (data.logoEmoji) {
      document.querySelectorAll('.logo-icon').forEach(el => el.textContent = data.logoEmoji);
    }
  }

  async function save(data) {
    await db.collection(COLL.config).doc('branding').set({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    apply(data);
    showToast('Apariencia actualizada ✅', 'success');
  }

  return { load, apply, save };
})();

// ══════════════════════════════════════════════════════════════════════════
//  17. REGISTRO DE GASTOS
// ══════════════════════════════════════════════════════════════════════════
const Expenses = (() => {
  let unsub = null;

  function subscribe(onUpdate) {
    if (unsub) unsub();
    const start = new Date(); start.setHours(0,0,0,0);
    unsub = db.collection('expenses')
      .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(start))
      .orderBy('createdAt', 'desc')
      .onSnapshot(snap => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (onUpdate) onUpdate(items);
      });
  }

  async function add(description, amount) {
    if (!description || !amount) return;
    await db.collection('expenses').add({
      description: description.trim(),
      amount: parseFloat(amount),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Gasto registrado ✅', 'success');
  }

  async function remove(id) {
    await db.collection('expenses').doc(id).delete();
    showToast('Gasto eliminado', 'info');
  }

  async function getByPeriod(period) {
    const start = new Date();
    if (period === 'day')   { start.setHours(0,0,0,0); }
    else if (period === 'week')  { start.setDate(start.getDate() - start.getDay()); start.setHours(0,0,0,0); }
    else if (period === 'month') { start.setDate(1); start.setHours(0,0,0,0); }
    const snap = await db.collection('expenses')
      .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(start))
      .orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  return { subscribe, add, remove, getByPeriod };
})();

// ══════════════════════════════════════════════════════════════════════════
//  18. EXPORTAR A EXCEL (.xlsx)
// ══════════════════════════════════════════════════════════════════════════
const ExcelExport = (() => {
  function loadSheetJS() {
    return new Promise(resolve => {
      if (window.XLSX) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  async function exportOrders(orders, period) {
    await loadSheetJS();
    const label = { day: 'Hoy', week: 'Semana', month: 'Mes' }[period] || period;

    const rows = orders.map(o => ({
      'ID':        o.id,
      'Cliente':   o.customer || 'N/A',
      'Productos': (o.items||[]).map(i => `${i.name} x${i.qty}`).join(' | '),
      'Total':     o.total || 0,
      'Estado':    { pending:'Pendiente', done:'Hecho', rejected:'Rechazado' }[o.status] || o.status,
      'Fecha':     o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString('es-PE') : ''
    }));

    // Summary row
    const revenue = orders.filter(o => o.status !== 'rejected').reduce((s,o) => s + (o.total||0), 0);
    rows.push({});
    rows.push({ 'ID': 'RESUMEN', 'Cliente': '', 'Productos': `Total pedidos: ${orders.length}`, 'Total': revenue, 'Estado': '', 'Fecha': '' });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Pedidos ${label}`);
    XLSX.writeFile(wb, `kiosco-${period}-${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast('Excel descargado 📊', 'success');
  }

  async function exportExpenses(expenses, period) {
    await loadSheetJS();
    const rows = expenses.map(e => ({
      'Descripción': e.description,
      'Monto':       e.amount,
      'Fecha':       e.createdAt?.toDate ? e.createdAt.toDate().toLocaleString('es-PE') : ''
    }));
    const total = expenses.reduce((s,e) => s + (e.amount||0), 0);
    rows.push({}, { 'Descripción': 'TOTAL', 'Monto': total });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
    XLSX.writeFile(wb, `kiosco-gastos-${period}-${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast('Excel de gastos descargado 📊', 'success');
  }

  return { exportOrders, exportExpenses };
})();

// ══════════════════════════════════════════════════════════════════════════
//  19. CAJA DIARIA (APERTURA Y CIERRE)
// ══════════════════════════════════════════════════════════════════════════
const CashRegister = (() => {
  const TODAY = () => new Date().toISOString().slice(0,10);

  async function getToday() {
    try {
      const doc = await db.collection('cash_register').doc(TODAY()).get();
      return doc.exists ? doc.data() : null;
    } catch { return null; }
  }

  async function open(initialAmount) {
    const today = await getToday();
    if (today?.openedAt) { showToast('La caja ya fue abierta hoy', 'info'); return; }
    await db.collection('cash_register').doc(TODAY()).set({
      initialAmount: parseFloat(initialAmount) || 0,
      openedAt: firebase.firestore.FieldValue.serverTimestamp(),
      closedAt: null,
      finalAmount: null,
      note: null
    });
    showToast('Caja abierta ✅', 'success');
  }

  async function close(finalAmount, note) {
    const today = await getToday();
    if (!today?.openedAt) { showToast('La caja no fue abierta hoy', 'error'); return; }
    await db.collection('cash_register').doc(TODAY()).update({
      finalAmount: parseFloat(finalAmount) || 0,
      note: note || null,
      closedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Caja cerrada ✅', 'success');
  }

  async function renderSummary(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const data = await getToday();

    if (!data) {
      container.innerHTML = `
        <div class="cash-card">
          <p style="color:var(--text-2);margin-bottom:1rem">La caja no ha sido abierta hoy.</p>
          <div class="form-row">
            <label>Monto inicial (S/)</label>
            <input type="number" id="cashInitial" class="input-field" placeholder="0.00" step="0.50"/>
          </div>
          <button class="btn-primary btn-block" onclick="CashRegister.open(document.getElementById('cashInitial').value)">
            💰 Abrir Caja
          </button>
        </div>`;
      return;
    }

    const opened = data.openedAt?.toDate ? data.openedAt.toDate().toLocaleTimeString('es-PE') : '';
    const closed = data.closedAt?.toDate ? data.closedAt.toDate().toLocaleTimeString('es-PE') : null;

    container.innerHTML = `
      <div class="cash-card">
        <div class="cash-row"><span>Apertura:</span><strong>${opened}</strong></div>
        <div class="cash-row"><span>Monto inicial:</span><strong>${APP_CONFIG.currency} ${(data.initialAmount||0).toFixed(2)}</strong></div>
        ${closed ? `
          <div class="cash-row"><span>Cierre:</span><strong>${closed}</strong></div>
          <div class="cash-row"><span>Monto final:</span><strong>${APP_CONFIG.currency} ${(data.finalAmount||0).toFixed(2)}</strong></div>
          ${data.note ? `<div class="cash-row"><span>Nota:</span><em>${data.note}</em></div>` : ''}
        ` : `
          <div class="form-row" style="margin-top:1rem">
            <label>Monto final (S/)</label>
            <input type="number" id="cashFinal" class="input-field" placeholder="0.00" step="0.50"/>
          </div>
          <div class="form-row">
            <label>Nota (opcional)</label>
            <input type="text" id="cashNote" class="input-field" placeholder="Observaciones..."/>
          </div>
          <button class="btn-primary btn-block" onclick="CashRegister.close(
            document.getElementById('cashFinal').value,
            document.getElementById('cashNote').value
          )">🔒 Cerrar Caja</button>
        `}
      </div>`;
  }

  return { getToday, open, close, renderSummary };
})();

// ══════════════════════════════════════════════════════════════════════════
//  20. MULTIIDIOMA
// ══════════════════════════════════════════════════════════════════════════
const I18n = (() => {
  const LANGS = {
    es: {
      allProducts: 'Todos los productos',
      categories: 'Categorías',
      myOrder: '🛒 Mi Pedido',
      clear: 'Limpiar',
      total: 'Total:',
      yourName: 'Tu nombre (opcional)',
      sendOrder: 'Enviar Pedido 🚀',
      shareWhatsapp: 'Compartir por WhatsApp 💬',
      searchPlaceholder: 'Buscar productos...',
      addToCart: 'Agregar',
      emptyCart: 'Tu carrito está vacío 🛒',
      orderSent: '¡Pedido enviado! 🎉',
      adminAccess: 'Acceso Administrador',
      enterPhone: 'Ingresa tu número de teléfono',
      sendCode: 'Enviar código',
      verify: 'Verificar',
      dashboard: '📊 Dashboard',
      orders: '📋 Pedidos',
      products: '🏷️ Productos',
      categories2: '📂 Categorías',
    },
    en: {
      allProducts: 'All products',
      categories: 'Categories',
      myOrder: '🛒 My Order',
      clear: 'Clear',
      total: 'Total:',
      yourName: 'Your name (optional)',
      sendOrder: 'Place Order 🚀',
      shareWhatsapp: 'Share on WhatsApp 💬',
      searchPlaceholder: 'Search products...',
      addToCart: 'Add',
      emptyCart: 'Your cart is empty 🛒',
      orderSent: 'Order placed! 🎉',
      adminAccess: 'Admin Access',
      enterPhone: 'Enter your phone number',
      sendCode: 'Send code',
      verify: 'Verify',
      dashboard: '📊 Dashboard',
      orders: '📋 Orders',
      products: '🏷️ Products',
      categories2: '📂 Categories',
    }
  };

  let currentLang = localStorage.getItem('kiosco_lang') || 'es';

  function t(key) { return LANGS[currentLang]?.[key] || LANGS.es[key] || key; }

  function setLang(lang) {
    if (!LANGS[lang]) return;
    currentLang = lang;
    localStorage.setItem('kiosco_lang', lang);
    applyTranslations();
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (el.placeholder !== undefined) el.placeholder = t(key);
      else el.textContent = t(key);
    });
  }

  function init() {
    applyTranslations();
    // Add lang switcher to header
    const actions = document.querySelector('.header-actions');
    if (actions && !document.getElementById('langSwitcher')) {
      const btn = document.createElement('button');
      btn.id = 'langSwitcher';
      btn.className = 'btn-icon';
      btn.title = 'Cambiar idioma / Change language';
      btn.textContent = currentLang === 'es' ? '🇵🇪' : '🇺🇸';
      btn.addEventListener('click', () => {
        const next = currentLang === 'es' ? 'en' : 'es';
        setLang(next);
        btn.textContent = next === 'es' ? '🇵🇪' : '🇺🇸';
      });
      actions.insertBefore(btn, actions.firstChild);
    }
  }

  return { init, t, setLang, get lang() { return currentLang; } };
})();
