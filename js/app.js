// ===== js/app.js =====
// Orquestador principal — integra todas las funcionalidades nuevas

// ── Utilidades globales ────────────────────────────────────────────────────
function openModal(el) { if (el) el.classList.add('open'); }
function closeModal(el) { if (el) el.classList.remove('open'); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function showToast(message, type = 'info') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ── App ────────────────────────────────────────────────────────────────────
const App = (() => {
  let currentPage = 'store';

  function showPage(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(page === 'store' ? 'pageStore' : 'pageAdmin');
    if (target) target.classList.add('active');

    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
      if (page === 'admin') {
        loginBtn.textContent = '🏪';
        loginBtn.title = 'Ver tienda';
      } else {
        const userName = Auth.getUserName ? Auth.getUserName() : '';
        loginBtn.textContent = '👤';
        loginBtn.title = userName ? userName + ' · Cerrar sesión' : 'Ingresar';
      }
    }

    if (page === 'admin') {
      Dashboard.init();
      Orders.init();
      Notifications.init();
      Notifications.requestPermission();
      if (window.StockAlerts) StockAlerts.init();
      if (document.getElementById('cashRegisterContainer') && window.CashRegister) CashRegister.renderSummary('cashRegisterContainer');
      if (window.renderScheduleEditor) renderScheduleEditor();
      if (window.renderStaffList) renderStaffList();
      if (window.loadBrandingForm) loadBrandingForm();
      if (window.bindExpenses) bindExpenses();
    } else {
      Notifications.stop();
    }
  }

  function goBack() {
    if (currentPage === 'admin') showPage('store');
    else window.history.back();
  }

  // ── Theme ────────────────────────────────────────────────────────────────
  function initTheme() {
    const saved = localStorage.getItem('kiosco_theme') || 'dark';
    setTheme(saved);
    document.getElementById('themeToggle')?.addEventListener('click', () => {
      setTheme(document.body.classList.contains('theme-dark') ? 'light' : 'dark');
    });
  }

  function setTheme(theme) {
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem('kiosco_theme', theme);
    const icon = document.querySelector('.theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  // ── Featured section injector ────────────────────────────────────────────
  function injectFeaturedSection() {
    const storeMain = document.getElementById('pageStore');
    if (!storeMain || document.getElementById('featuredSection')) return;
    const layout = storeMain.querySelector('.store-layout');
    if (!layout) return;

    const section = document.createElement('div');
    section.id = 'featuredSection';
    section.className = 'featured-section';
    section.innerHTML = `
      <h2 class="featured-title">⭐ Productos Destacados</h2>
      <div class="featured-grid" id="featuredGrid"></div>
    `;
    storeMain.insertBefore(section, layout);
    Featured.init();
  }

  // ── Cart history button ──────────────────────────────────────────────────
  function injectHistoryButton() {
    ['cartFooter', 'cartFooterMobile'].forEach(id => {
      const footer = document.getElementById(id);
      if (!footer || footer.querySelector('.history-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'btn-outline btn-block history-btn';
      btn.textContent = '📋 Ver mis pedidos anteriores';
      btn.addEventListener('click', async () => {
        const profile = CustomerProfile.getProfile();
        if (!profile?.name) {
          showToast('Ingresa tu nombre primero', 'info'); return;
        }
        const orders = await CustomerProfile.getOrderHistory(profile.name);
        CustomerProfile.showHistory(orders);
      });
      footer.appendChild(btn);
    });
  }

  // ── Chat send ────────────────────────────────────────────────────────────
  function bindChat() {
    document.getElementById('chatSendBtn')?.addEventListener('click', () => {
      const input = document.getElementById('chatInput');
      if (!input?.value.trim()) return;
      Chat.send(input.value.trim(), 'admin');
      input.value = '';
    });
    document.getElementById('chatInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('chatSendBtn')?.click();
    });
    document.getElementById('closeHistoryModal')?.addEventListener('click', () =>
      closeModal(document.getElementById('historyModal')));
  }

  // ── Expenses ─────────────────────────────────────────────────────────────
  function bindExpenses() {
    document.getElementById('addExpenseBtn')?.addEventListener('click', async () => {
      const desc = document.getElementById('expenseDesc')?.value;
      const amount = document.getElementById('expenseAmount')?.value;
      if (!desc || !amount) { showToast('Completa descripción y monto', 'error'); return; }
      await Expenses.add(desc, amount);
      document.getElementById('expenseDesc').value = '';
      document.getElementById('expenseAmount').value = '';
      loadExpenses('day');
    });

    document.getElementById('exportExpensesCSV')?.addEventListener('click', async () => {
      const items = await Expenses.getByPeriod('day');
      let csv = 'Descripción,Monto,Fecha\n';
      items.forEach(e => {
        const d = e.createdAt?.toDate ? e.createdAt.toDate().toLocaleString('es-PE') : '';
        csv += `"${e.description}",${e.amount},"${d}"\n`;
      });
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'gastos.csv'; a.click();
    });

    document.getElementById('exportExpensesXLSX')?.addEventListener('click', async () => {
      const items = await Expenses.getByPeriod('day');
      ExcelExport.exportExpenses(items, 'day');
    });

    // Period tabs in expenses section
    document.querySelectorAll('#sectionExpenses .period-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#sectionExpenses .period-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loadExpenses(tab.dataset.period);
      });
    });

    loadExpenses('day');
  }

  async function loadExpenses(period) {
    const items = await Expenses.getByPeriod(period);
    const list = document.getElementById('expenseList');
    const total = document.getElementById('expenseTotal');
    const totalAmt = document.getElementById('expenseTotalAmount');

    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<p style="color:var(--text-3);font-size:.88rem">No hay gastos registrados.</p>';
      if (total) total.style.display = 'none';
      return;
    }

    list.innerHTML = items.map(e => {
      const d = e.createdAt?.toDate ? e.createdAt.toDate().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '';
      return `<div class="expense-item">
        <span class="expense-desc">${e.description}</span>
        <span class="expense-date">${d}</span>
        <span class="expense-amount">−S/ ${Number(e.amount).toFixed(2)}</span>
        <button class="btn-danger btn-sm" onclick="Expenses.remove('${e.id}').then(()=>App.reloadExpenses())">🗑️</button>
      </div>`;
    }).join('');

    const sum = items.reduce((s, e) => s + (e.amount || 0), 0);
    if (total) { total.style.display = 'flex'; }
    if (totalAmt) totalAmt.textContent = `S/ ${sum.toFixed(2)}`;
  }

  // ── Schedule editor ──────────────────────────────────────────────────────
  function renderScheduleEditor() {
    const grid = document.getElementById('scheduleGrid');
    if (!grid) return;
    const days = Schedule.DAYS;
    const data = Schedule.data || {};

    grid.innerHTML = days.map(day => {
      const slot = data[day] || { open: true, from: '08:00', to: '22:00' };
      return `<div class="schedule-row">
        <label>${day}</label>
        <input type="checkbox" ${slot.open ? 'checked' : ''} data-day="${day}" class="sched-open" />
        <input type="time" value="${slot.from || '08:00'}" data-day="${day}" class="sched-from" />
        <input type="time" value="${slot.to || '22:00'}"   data-day="${day}" class="sched-to" />
      </div>`;
    }).join('');

    document.getElementById('saveScheduleBtn')?.addEventListener('click', async () => {
      const result = {};
      days.forEach(day => {
        result[day] = {
          open: document.querySelector(`.sched-open[data-day="${day}"]`)?.checked || false,
          from: document.querySelector(`.sched-from[data-day="${day}"]`)?.value || '08:00',
          to: document.querySelector(`.sched-to[data-day="${day}"]`)?.value || '22:00'
        };
      });
      await Schedule.save(result);
    });
  }

  // ── Staff management ─────────────────────────────────────────────────────
  async function renderStaffList() {
    const list = document.getElementById('staffList');
    if (!list) return;
    try {
      const doc = await db.collection(COLL.config).doc('admin').get();
      const staff = doc.exists ? (doc.data().staff || []) : [];
      const names = doc.exists ? (doc.data().staffNames || {}) : {};

      list.innerHTML = !staff.length
        ? '<p style="color:var(--text-3);font-size:.88rem">No hay empleados registrados.</p>'
        : staff.map(phone => `
          <div class="expense-item">
            <span class="expense-desc">${names[phone] || phone} <small style="color:var(--text-3)">${phone}</small></span>
            <span class="role-badge staff">Empleado</span>
            <button class="btn-danger btn-sm" onclick="removeStaff('${phone}')">🗑️</button>
          </div>`).join('');
    } catch { }
  }

  // ── Branding form ────────────────────────────────────────────────────────
  async function loadBrandingForm() {
    try {
      const doc = await db.collection(COLL.config).doc('branding').get();
      if (doc.exists) {
        const d = doc.data();
        if (d.storeName) document.getElementById('brandStoreName').value = d.storeName;
        if (d.logoEmoji) document.getElementById('brandLogoEmoji').value = d.logoEmoji;
        if (d.accentColor) {
          document.getElementById('brandColor').value = d.accentColor;
          document.getElementById('colorPreview').style.background = d.accentColor;
        }
        if (d.deliveryMinutes) document.getElementById('brandDeliveryTime').value = d.deliveryMinutes;
      }
    } catch { }

    // Color swatches
    document.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        const color = sw.dataset.color;
        document.getElementById('brandColor').value = color;
        document.getElementById('colorPreview').style.background = color;
      });
    });

    document.getElementById('brandColor')?.addEventListener('input', e => {
      document.getElementById('colorPreview').style.background = e.target.value;
    });

    document.getElementById('saveBrandingBtn')?.addEventListener('click', async () => {
      const data = {
        storeName: document.getElementById('brandStoreName')?.value.trim(),
        logoEmoji: document.getElementById('brandLogoEmoji')?.value.trim(),
        accentColor: document.getElementById('brandColor')?.value,
        deliveryMinutes: parseInt(document.getElementById('brandDeliveryTime')?.value) || null
      };
      await Branding.save(data);
      if (data.deliveryMinutes) await DeliveryTime.save(data.deliveryMinutes);
    });
  }

  // ── Staff modal ──────────────────────────────────────────────────────────
  function bindStaffModal() {
    const modal = document.getElementById('staffModal');
    document.getElementById('addStaffBtn')?.addEventListener('click', () => openModal(modal));
    document.getElementById('closeStaffModal')?.addEventListener('click', () => closeModal(modal));
    document.getElementById('cancelStaffBtn')?.addEventListener('click', () => closeModal(modal));

    document.getElementById('saveStaffBtn')?.addEventListener('click', async () => {
      const phone = '+51' + (document.getElementById('staffPhone')?.value.trim().replace(/\D/g, '') || '');
      const name = document.getElementById('staffName')?.value.trim() || '';
      if (phone.length < 13) { showToast('Número inválido', 'error'); return; }

      try {
        const ref = db.collection(COLL.config).doc('admin');
        const doc = await ref.get();
        const data = doc.exists ? doc.data() : {};
        const staff = Array.isArray(data.staff) ? data.staff : [];
        const names = data.staffNames || {};

        if (!staff.includes(phone)) staff.push(phone);
        names[phone] = name;

        await ref.update({ staff, staffNames: names });
        showToast('Empleado agregado ✅', 'success');
        closeModal(modal);
        renderStaffList();
      } catch (err) { showToast('Error: ' + err.message, 'error'); }
    });
  }

  // ── Orders: add invoice + chat buttons ───────────────────────────────────
  function enhanceOrderCards() {
    // Patch Orders module to add invoice and chat buttons
    const origInit = Orders.init.bind(Orders);
    const origRender = Orders.renderOrders?.bind(Orders);
  }

  // ── Orders: export to Excel ──────────────────────────────────────────────
  function bindOrderExcelExport() {
    // Add Excel buttons next to CSV in dashboard
    const downloadBar = document.querySelector('.download-bar');
    if (!downloadBar || downloadBar.querySelector('#dlXlsxDay')) return;
    downloadBar.insertAdjacentHTML('beforeend', `
      <span style="margin-left:.5rem;color:var(--text-3)">Excel:</span>
      <button class="btn-outline" id="dlXlsxDay">Hoy</button>
      <button class="btn-outline" id="dlXlsxWeek">Semana</button>
      <button class="btn-outline" id="dlXlsxMonth">Mes</button>
    `);
    ['Day', 'Week', 'Month'].forEach(p => {
      document.getElementById(`dlXlsx${p}`)?.addEventListener('click', async () => {
        const period = p.toLowerCase();
        const snap = await db.collection(COLL.orders).orderBy('createdAt', 'desc').get();
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const start = (() => {
          const d = new Date();
          if (period === 'day') { d.setHours(0, 0, 0, 0); }
          else if (period === 'week') { d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); }
          else { d.setDate(1); d.setHours(0, 0, 0, 0); }
          return d;
        })();
        const filtered = all.filter(o => {
          const t = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
          return t >= start;
        });
        ExcelExport.exportOrders(filtered, period);
      });
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    initTheme();
    Store.init();
    Cart.init();
    UIHelpers.init();
    if (window.I18n) I18n.init();
    if (window.Branding) Branding.load();
    if (window.DeliveryTime) DeliveryTime.load();
    if (window.Schedule) Schedule.load();
    if (window.CustomerProfile) CustomerProfile.init();
    if (window.Delivery) Delivery.injectIntoCartFooter();
    if (window.injectFeaturedSection) injectFeaturedSection();
    if (window.bindChat) bindChat();
    if (window.bindStaffModal) bindStaffModal();

    // Botón volver a la tienda
    document.getElementById('backToStoreBtn')?.addEventListener('click', () => showPage('store'));

    // Cerrar sesión
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      if (confirm('¿Cerrar sesión de administrador?')) {
        Auth.signOut().then(() => {
          showPage('store');
          showToast('Sesión cerrada', 'info');
        });
      }
    });

    showPage('store');

    // Inject history button after cart renders
    setTimeout(injectHistoryButton, 500);
    setTimeout(bindOrderExcelExport, 800);
  }

  // Public helper to reload expenses
  function reloadExpenses() { loadExpenses('day'); }

  return { init, showPage, reloadExpenses, get currentPage() { return currentPage; } };
})();

// ── Global helpers ─────────────────────────────────────────────────────────
async function removeStaff(phone) {
  if (!confirm('¿Eliminar este empleado?')) return;
  try {
    const ref = db.collection(COLL.config).doc('admin');
    const doc = await ref.get();
    const data = doc.exists ? doc.data() : {};
    const staff = (data.staff || []).filter(p => p !== phone);
    const names = data.staffNames || {};
    delete names[phone];
    await ref.update({ staff, staffNames: names });
    showToast('Empleado eliminado', 'info');
    document.getElementById('staffList') && App.showPage('admin');
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
