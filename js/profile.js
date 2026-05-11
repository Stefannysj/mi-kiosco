// ===== js/profile.js =====
// Mejora 6: Perfil de cliente con historial de pedidos

const Profile = (() => {
  const KEY_NAME    = 'kiosco_customer_name';
  const KEY_PHONE   = 'kiosco_customer_phone';
  const KEY_ADDRESS = 'kiosco_customer_address';

  function getSaved() {
    return {
      name:    localStorage.getItem(KEY_NAME)    || '',
      phone:   localStorage.getItem(KEY_PHONE)   || '',
      address: localStorage.getItem(KEY_ADDRESS) || ''
    };
  }

  function save(name, phone, address) {
    if (name)    localStorage.setItem(KEY_NAME,    name);
    if (phone)   localStorage.setItem(KEY_PHONE,   phone);
    if (address) localStorage.setItem(KEY_ADDRESS, address);
  }

  // ── Abrir modal de perfil ──────────────────────────────────────────────────
  async function openModal() {
    const existing = document.getElementById('profileModal');
    if (existing) { existing.classList.add('open'); loadHistory(); return; }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay profile-modal';
    modal.id = 'profileModal';

    const saved = getSaved();

    modal.innerHTML = `
      <div class="modal-box" style="max-width:500px">
        <button class="modal-close" id="closeProfileModal">✕</button>
        <h2 class="modal-title">👤 Mi Perfil</h2>

        <div class="profile-tabs">
          <button class="profile-tab active" data-tab="info">Mis datos</button>
          <button class="profile-tab" data-tab="history">Mis pedidos</button>
        </div>

        <!-- Info tab -->
        <div id="profileTabInfo">
          <div class="modal-form">
            <div class="form-row">
              <label>Nombre</label>
              <input type="text" id="profileName" class="input-field" value="${saved.name}" placeholder="Tu nombre" />
            </div>
            <div class="form-row">
              <label>Teléfono (opcional)</label>
              <input type="tel" id="profilePhone" class="input-field" value="${saved.phone}" placeholder="+51 9XX XXX XXX" />
            </div>
            <div class="form-row">
              <label>Dirección habitual (opcional)</label>
              <input type="text" id="profileAddress" class="input-field" value="${saved.address}" placeholder="Calle, número, referencia..." />
            </div>
            <button class="btn-primary btn-block" id="saveProfileBtn">Guardar datos</button>
          </div>
        </div>

        <!-- History tab -->
        <div id="profileTabHistory" style="display:none">
          <div id="orderHistoryList">
            <div class="empty-state"><div class="empty-icon">📋</div><p>Cargando pedidos...</p></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.classList.add('open');

    // Close
    modal.querySelector('#closeProfileModal').addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

    // Tabs
    modal.querySelectorAll('.profile-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('profileTabInfo').style.display    = tab.dataset.tab === 'info'    ? '' : 'none';
        document.getElementById('profileTabHistory').style.display = tab.dataset.tab === 'history' ? '' : 'none';
        if (tab.dataset.tab === 'history') loadHistory();
      });
    });

    // Save
    modal.querySelector('#saveProfileBtn').addEventListener('click', () => {
      const name    = document.getElementById('profileName').value.trim();
      const phone   = document.getElementById('profilePhone').value.trim();
      const address = document.getElementById('profileAddress').value.trim();
      save(name, phone, address);
      showToast('Datos guardados ✅', 'success');
      modal.classList.remove('open');
    });
  }

  // ── Cargar historial por nombre/teléfono ───────────────────────────────────
  async function loadHistory() {
    const list = document.getElementById('orderHistoryList');
    if (!list) return;
    const saved = getSaved();
    if (!saved.name && !saved.phone) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><p>Guarda tu nombre para ver tu historial</p></div>`;
      return;
    }

    try {
      const snap = await db.collection(COLL.orders)
        .where('customer', '==', saved.name)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();

      const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (!orders.length) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><p>Aún no tienes pedidos</p></div>`;
        return;
      }

      const statusLabel = { pending: 'Pendiente', done: 'Completado', rejected: 'Rechazado' };
      list.innerHTML = orders.map(o => {
        const date = o.createdAt?.toDate
          ? o.createdAt.toDate().toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          : '';
        const items = (o.items || []).map(i => `${i.name} ×${i.qty}`).join(', ');
        return `<div class="order-history-item">
          <div class="oh-header">
            <span style="font-weight:700">${date}</span>
            <span class="oh-status ${o.status}">${statusLabel[o.status] || o.status}</span>
          </div>
          <p style="color:var(--text-2);font-size:.82rem;margin-bottom:.3rem">${items}</p>
          <p style="font-weight:700;color:var(--accent)">${APP_CONFIG.currency} ${(o.total||0).toFixed(2)}</p>
          <button class="btn-outline btn-sm" style="margin-top:.5rem" data-repeat="${o.id}">🔁 Repetir pedido</button>
        </div>`;
      }).join('');

      // Repeat order
      list.querySelectorAll('[data-repeat]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const order = orders.find(o => o.id === btn.dataset.repeat);
          if (!order) return;
          // Re-fetch products and add to cart
          for (const item of order.items || []) {
            try {
              const doc = await db.collection(COLL.products).doc(item.productId).get();
              if (doc.exists && doc.data().active) {
                for (let i = 0; i < item.qty; i++) Cart.addItem({ id: doc.id, ...doc.data() });
              }
            } catch {}
          }
          modal.classList.remove('open');
          showToast('Pedido repetido en tu carrito 🛒', 'success');
        });
      });
    } catch (e) {
      list.innerHTML = `<div class="empty-state"><p>Error al cargar historial</p></div>`;
    }
  }

  // ── Botón perfil en header ─────────────────────────────────────────────────
  function initProfileBtn() {
    const btn = document.getElementById('profileBtn');
    if (btn) btn.addEventListener('click', openModal);
  }

  return { openModal, getSaved, save, initProfileBtn };
})();
