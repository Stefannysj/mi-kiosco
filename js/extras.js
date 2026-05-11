// ===== js/extras.js =====
// Mejora 17: Yape/Plin | Mejora 18: Excel | Mejora 19: Caja diaria | Mejora 20: Idioma

// ══════════════════════════════════════════════════════════════════════════════
//  YAPE / PLIN — Mejora 17
// ══════════════════════════════════════════════════════════════════════════════
const PaymentQR = (() => {
  let config = {};

  async function load() {
    try {
      const doc = await db.collection(COLL.config).doc('payments').get();
      if (doc.exists) config = doc.data();
    } catch {}
  }

  async function save(data) {
    await db.collection(COLL.config).doc('payments').set(data, { merge: true });
    config = { ...config, ...data };
    showToast('Datos de pago actualizados ✅', 'success');
  }

  // Show in cart
  function renderInCart(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!config.yapeNumber && !config.plinNumber) return;

    let html = '<div style="margin-top:.75rem">';
    html += '<p style="font-size:.8rem;font-weight:600;color:var(--text-2);margin-bottom:.5rem">💳 Métodos de pago</p>';
    html += '<div class="payment-methods">';

    if (config.yapeNumber) {
      html += `<button class="payment-method-btn" data-method="yape">
        <span class="pm-icon">💜</span>
        <span>Yape</span>
      </button>`;
    }
    if (config.plinNumber) {
      html += `<button class="payment-method-btn" data-method="plin">
        <span class="pm-icon">💚</span>
        <span>Plin</span>
      </button>`;
    }

    html += '</div><div id="qrDisplay"></div></div>';
    container.insertAdjacentHTML('beforeend', html);

    container.querySelectorAll('.payment-method-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showQR(btn.dataset.method);
      });
    });
  }

  function showQR(method) {
    const display = document.getElementById('qrDisplay');
    if (!display) return;
    const number = method === 'yape' ? config.yapeNumber : config.plinNumber;
    const qrUrl  = method === 'yape' ? config.yapeQR    : config.plinQR;
    const color  = method === 'yape' ? '#7c3aed' : '#059669';
    const name   = method === 'yape' ? 'Yape' : 'Plin';

    display.innerHTML = `
      <div class="yape-qr-display">
        <p style="font-size:.82rem;color:var(--text-2);margin-bottom:.5rem">Paga con <strong style="color:${color}">${name}</strong></p>
        ${qrUrl ? `<img src="${qrUrl}" alt="QR ${name}" />` : '<p style="color:var(--text-3);font-size:.82rem">QR no configurado</p>'}
        <p class="yape-number" style="color:${color}">${number}</p>
        <p style="font-size:.75rem;color:var(--text-3);margin-top:.3rem">Envía el comprobante al administrador</p>
      </div>`;
  }

  function renderAdminPayments(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:1.25rem;margin-bottom:1rem">
        <h4 style="font-size:.95rem;font-weight:700;margin-bottom:1rem">💳 Yape / Plin</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
          <div>
            <p style="font-size:.8rem;font-weight:700;color:#7c3aed;margin-bottom:.5rem">💜 Yape</p>
            <input type="tel" id="yapeNumber" class="input-field" placeholder="+51 9XX XXX XXX" value="${config.yapeNumber||''}" style="margin-bottom:.5rem" />
            <input type="url" id="yapeQR" class="input-field" placeholder="URL imagen QR Yape" value="${config.yapeQR||''}" />
          </div>
          <div>
            <p style="font-size:.8rem;font-weight:700;color:#059669;margin-bottom:.5rem">💚 Plin</p>
            <input type="tel" id="plinNumber" class="input-field" placeholder="+51 9XX XXX XXX" value="${config.plinNumber||''}" style="margin-bottom:.5rem" />
            <input type="url" id="plinQR" class="input-field" placeholder="URL imagen QR Plin" value="${config.plinQR||''}" />
          </div>
        </div>
        <button class="btn-primary btn-sm" style="margin-top:1rem" id="savePaymentsBtn">Guardar</button>
      </div>`;

    document.getElementById('savePaymentsBtn')?.addEventListener('click', () => {
      save({
        yapeNumber: document.getElementById('yapeNumber').value.trim(),
        yapeQR:     document.getElementById('yapeQR').value.trim(),
        plinNumber: document.getElementById('plinNumber').value.trim(),
        plinQR:     document.getElementById('plinQR').value.trim()
      });
    });
  }

  return { load, renderInCart, renderAdminPayments };
})();

// ══════════════════════════════════════════════════════════════════════════════
//  EXCEL EXPORT — Mejora 18
// ══════════════════════════════════════════════════════════════════════════════
const ExcelExport = (() => {

  function filterByPeriod(orders, period) {
    const now   = new Date();
    const start = new Date();
    if (period === 'day')   { start.setHours(0,0,0,0); }
    else if (period === 'week')  { start.setDate(now.getDate()-now.getDay()); start.setHours(0,0,0,0); }
    else if (period === 'month') { start.setDate(1); start.setHours(0,0,0,0); }
    return orders.filter(o => {
      if (!o.createdAt) return false;
      const t = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      return t >= start;
    });
  }

  async function exportXLSX(period) {
    // Load SheetJS dynamically
    if (!window.XLSX) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }

    const snap = await db.collection(COLL.orders).orderBy('createdAt','desc').get();
    const allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const orders    = filterByPeriod(allOrders, period);

    const labels = { day: 'Hoy', week: 'Esta semana', month: 'Este mes' };
    const statusLabel = { pending: 'Pendiente', done: 'Completado', rejected: 'Rechazado' };

    // Sheet 1: Orders
    const ordersData = [
      ['ID', 'Cliente', 'Teléfono', 'Dirección', 'Productos', 'Total', 'Estado', 'Fecha']
    ];
    orders.forEach(o => {
      const items = (o.items||[]).map(i => `${i.name} x${i.qty}`).join(' | ');
      const date  = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString('es-PE') : '';
      ordersData.push([
        o.id?.slice(-8) || '',
        o.customer || '',
        o.customerPhone || '',
        o.deliveryAddress || '',
        items,
        o.total || 0,
        statusLabel[o.status] || o.status,
        date
      ]);
    });

    // Sheet 2: Summary
    const revenue  = orders.filter(o=>o.status!=='rejected').reduce((s,o)=>s+(o.total||0),0);
    const summaryData = [
      ['Métrica', 'Valor'],
      ['Período', labels[period]],
      ['Total pedidos', orders.length],
      ['Completados', orders.filter(o=>o.status==='done').length],
      ['Pendientes', orders.filter(o=>o.status==='pending').length],
      ['Rechazados', orders.filter(o=>o.status==='rejected').length],
      ['Ingresos totales', revenue],
      ['Promedio por pedido', orders.length ? (revenue/orders.length).toFixed(2) : 0]
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(ordersData);
    const ws2 = XLSX.utils.aoa_to_sheet(summaryData);

    // Column widths
    ws1['!cols'] = [10,15,14,20,40,10,12,20].map(w => ({ wch: w }));
    ws2['!cols'] = [20,20].map(w => ({ wch: w }));

    XLSX.utils.book_append_sheet(wb, ws1, 'Pedidos');
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');

    XLSX.writeFile(wb, `kiosco-reporte-${period}-${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast('Excel descargado 📊', 'success');
  }

  return { exportXLSX };
})();

// ══════════════════════════════════════════════════════════════════════════════
//  CAJA DIARIA — Mejora 19
// ══════════════════════════════════════════════════════════════════════════════
const Caja = (() => {
  const KEY = 'kiosco_caja_';

  function getTodayKey() {
    return KEY + new Date().toISOString().slice(0,10);
  }

  function getState() {
    try { return JSON.parse(localStorage.getItem(getTodayKey())) || null; }
    catch { return null; }
  }

  function setState(data) {
    localStorage.setItem(getTodayKey(), JSON.stringify(data));
  }

  function isOpen() {
    const state = getState();
    return state?.status === 'open';
  }

  function openCaja(initialAmount) {
    setState({
      status: 'open',
      openedAt: new Date().toISOString(),
      initialAmount: parseFloat(initialAmount) || 0,
      closedAt: null,
      finalAmount: null
    });
    showToast('Caja abierta ✅', 'success');
  }

  function closeCaja(finalAmount) {
    const state = getState();
    if (!state) return;
    setState({
      ...state,
      status: 'closed',
      closedAt: new Date().toISOString(),
      finalAmount: parseFloat(finalAmount) || 0
    });
    showToast('Caja cerrada 🔒', 'info');
  }

  function renderAdminCaja(containerId, todayRevenue) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const state    = getState();
    const cajaOpen = state?.status === 'open';

    container.innerHTML = `
      <div class="caja-card">
        <div class="caja-header">
          <h3>🏦 Caja del día</h3>
          <span class="caja-status ${cajaOpen ? 'open' : 'closed'}">
            <span class="caja-dot"></span>
            ${cajaOpen ? 'Abierta' : 'Cerrada'}
          </span>
        </div>
        <div class="caja-stats">
          <div class="caja-stat">
            <div class="caja-stat-val">${APP_CONFIG.currency} ${(state?.initialAmount||0).toFixed(2)}</div>
            <div class="caja-stat-label">Apertura</div>
          </div>
          <div class="caja-stat">
            <div class="caja-stat-val">${APP_CONFIG.currency} ${(todayRevenue||0).toFixed(2)}</div>
            <div class="caja-stat-label">Ventas del día</div>
          </div>
          <div class="caja-stat">
            <div class="caja-stat-val">${APP_CONFIG.currency} ${((state?.initialAmount||0)+(todayRevenue||0)).toFixed(2)}</div>
            <div class="caja-stat-label">Total en caja</div>
          </div>
        </div>
        ${cajaOpen ? `
          <div style="display:flex;gap:.75rem;align-items:center">
            <input type="number" id="cajaCloseAmount" class="input-field" placeholder="Monto final en caja" style="flex:1" />
            <button class="btn-danger btn-sm" id="closeCajaBtn">🔒 Cerrar caja</button>
          </div>` : `
          <div style="display:flex;gap:.75rem;align-items:center">
            <input type="number" id="cajaOpenAmount" class="input-field" placeholder="Monto inicial de apertura" style="flex:1" />
            <button class="btn-success btn-sm" id="openCajaBtn">✅ Abrir caja</button>
          </div>`}
        ${state?.openedAt ? `<p style="font-size:.75rem;color:var(--text-3);margin-top:.5rem">Apertura: ${new Date(state.openedAt).toLocaleString('es-PE')}</p>` : ''}
      </div>`;

    document.getElementById('openCajaBtn')?.addEventListener('click', () => {
      const amount = document.getElementById('cajaOpenAmount').value;
      openCaja(amount);
      renderAdminCaja(containerId, todayRevenue);
    });
    document.getElementById('closeCajaBtn')?.addEventListener('click', () => {
      const amount = document.getElementById('cajaCloseAmount').value;
      closeCaja(amount);
      renderAdminCaja(containerId, todayRevenue);
    });
  }

  return { isOpen, openCaja, closeCaja, renderAdminCaja };
})();

// ══════════════════════════════════════════════════════════════════════════════
//  IDIOMA — Mejora 20
// ══════════════════════════════════════════════════════════════════════════════
const I18n = (() => {
  const translations = {
    es: {
      'store.title': 'Todos los productos',
      'store.search': 'Buscar productos...',
      'store.categories': 'Categorías',
      'cart.title': '🛒 Mi Pedido',
      'cart.empty': 'Tu carrito está vacío',
      'cart.total': 'Total:',
      'cart.send': 'Enviar Pedido 🚀',
      'cart.whatsapp': 'Compartir por WhatsApp 💬',
      'cart.name': 'Tu nombre (opcional)',
      'login.title': 'Acceso Administrador',
      'login.subtitle': 'Ingresa tu número de teléfono registrado',
      'login.send': 'Enviar código',
      'login.verify': 'Verificar',
      'login.code': 'Código de 6 dígitos',
    },
    en: {
      'store.title': 'All products',
      'store.search': 'Search products...',
      'store.categories': 'Categories',
      'cart.title': '🛒 My Order',
      'cart.empty': 'Your cart is empty',
      'cart.total': 'Total:',
      'cart.send': 'Place Order 🚀',
      'cart.whatsapp': 'Share on WhatsApp 💬',
      'cart.name': 'Your name (optional)',
      'login.title': 'Admin Access',
      'login.subtitle': 'Enter your registered phone number',
      'login.send': 'Send code',
      'login.verify': 'Verify',
      'login.code': '6-digit code',
    }
  };

  let currentLang = localStorage.getItem('kiosco_lang') || 'es';

  function t(key) {
    return translations[currentLang]?.[key] || translations['es'][key] || key;
  }

  function setLang(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem('kiosco_lang', lang);
    applyTranslations();
    updateLangBtn();
    showToast(lang === 'es' ? '🇵🇪 Español activado' : '🇬🇧 English activated', 'info');
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (el.placeholder !== undefined && el.tagName === 'INPUT') {
        el.placeholder = t(key);
      } else {
        el.textContent = t(key);
      }
    });
  }

  function updateLangBtn() {
    const btn = document.getElementById('langToggleBtn');
    if (btn) btn.innerHTML = currentLang === 'es' ? '🇬🇧 EN' : '🇵🇪 ES';
  }

  function initToggle() {
    const btn = document.getElementById('langToggleBtn');
    if (!btn) return;
    updateLangBtn();
    btn.addEventListener('click', () => setLang(currentLang === 'es' ? 'en' : 'es'));
    applyTranslations();
  }

  return { t, setLang, applyTranslations, initToggle, get current() { return currentLang; } };
})();
