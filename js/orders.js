// ===== js/orders.js =====
// Gestión de pedidos en tiempo real con: eliminar, boleta, GPS, estado

const Orders = (() => {
  let unsubOrders = null;
  let currentFilter = 'all';
  let orders = [];

  function init() {
    bindFilters();
    subscribe();
  }

  function bindFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        subscribe();
      });
    });
  }

  function subscribe() {
    if (unsubOrders) unsubOrders();
    let query = db.collection(COLL.orders).orderBy('createdAt', 'desc').limit(150);
    if (currentFilter !== 'all') {
      query = db.collection(COLL.orders)
        .where('status', '==', currentFilter)
        .orderBy('createdAt', 'desc').limit(150);
    }
    unsubOrders = query.onSnapshot(snap => {
      orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderOrders(orders);
    });
  }

  function renderOrders(list) {
    const container = document.getElementById('ordersList');
    if (!container) return;
    if (!list.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>No hay pedidos${currentFilter !== 'all' ? ' en este estado' : ''}</p></div>`;
      return;
    }
    container.innerHTML = list.map(o => buildOrderCard(o)).join('');

    container.querySelectorAll('.status-btn').forEach(btn =>
      btn.addEventListener('click', () => setStatus(btn.dataset.id, btn.dataset.status)));
    container.querySelectorAll('[data-invoice]').forEach(btn =>
      btn.addEventListener('click', () => {
        const order = orders.find(o => o.id === btn.dataset.invoice);
        if (order && window.Invoice) Invoice.generate(order);
        else showToast('Módulo de boleta no disponible', 'error');
      }));
    container.querySelectorAll('[data-delete-order]').forEach(btn =>
      btn.addEventListener('click', () => deleteOrder(btn.dataset.deleteOrder)));
  }

  function buildOrderCard(o) {
    const dt = o.createdAt?.toDate
      ? o.createdAt.toDate().toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : 'Ahora';
    const items = (o.items || []).map(i => `${i.name} ×${i.qty}`).join(', ');
    const statusColors = { pending: 'var(--warning)', done: 'var(--success)', rejected: 'var(--danger)' };
    const statusLabels = { pending: '⏳ Pendiente', done: '✅ Hecho', rejected: '❌ Rechazado' };
    const statusBtns = ['pending', 'done', 'rejected'].map(s =>
      `<button class="status-btn ${s} ${o.status === s ? 'active-status' : ''}" data-id="${o.id}" data-status="${s}">${statusLabels[s]}</button>`
    ).join('');
    const deliveryInfo = o.deliveryType === 'delivery' ? `🛵 ${o.deliveryAddress || 'Delivery'}` : '🏪 Recoge en tienda';
    const scheduled = o.scheduledDate ? `📅 ${o.scheduledDate}${o.scheduledTime ? ' · ' + o.scheduledTime : ''}` : '';
    const locationLink = o.location
      ? `<a href="https://www.google.com/maps?q=${o.location.lat},${o.location.lng}" target="_blank" style="color:var(--info);font-size:.75rem">📡 Ver en Google Maps</a>` : '';
    const notes = o.notes ? `<p style="font-size:.78rem;color:var(--text-3);margin-top:.2rem">📝 ${o.notes}</p>` : '';

    return `<div class="order-card" style="border-left:3px solid ${statusColors[o.status] || 'var(--border)'}">
      <div class="order-meta">
        <p class="order-customer">👤 <strong>${o.customer || 'Cliente'}</strong>${o.customerPhone ? ` <span style="color:var(--text-3);font-size:.78rem">· 📞 ${o.customerPhone}</span>` : ''}</p>
        <p class="order-time">🕐 ${dt}</p>
        <p style="font-size:.8rem;color:var(--info);margin-top:.15rem">${deliveryInfo}</p>
        ${scheduled ? `<p style="font-size:.75rem;color:var(--warning);margin-top:.15rem">${scheduled}</p>` : ''}
        ${locationLink ? `<div style="margin-top:.2rem">${locationLink}</div>` : ''}
        ${notes}
      </div>
      <div class="order-items">
        <p style="font-size:.85rem;color:var(--text-2);margin-bottom:.3rem">${items}</p>
        <p class="order-total">${APP_CONFIG.currency} ${(o.total || 0).toFixed(2)}</p>
      </div>
      <div class="order-actions-wrap">
        <div class="order-status-btns">${statusBtns}</div>
        <div style="display:flex;gap:.4rem;margin-top:.5rem;flex-wrap:wrap">
          <button class="invoice-btn" data-invoice="${o.id}">🧾 Boleta</button>
          <button class="btn-delete-order" data-delete-order="${o.id}">🗑️ Eliminar</button>
        </div>
      </div>
    </div>`;
  }

  async function setStatus(orderId, status) {
    try {
      await db.collection(COLL.orders).doc(orderId).update({ status, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      showToast({ pending: 'Pendiente ⏳', done: 'Completado ✅', rejected: 'Rechazado ❌' }[status], 'info');
    } catch { showToast('Error al actualizar', 'error'); }
  }

  async function deleteOrder(orderId) {
    const o = orders.find(x => x.id === orderId);
    if (!confirm(`¿Eliminar el pedido de "${o?.customer || 'cliente'}"?\nEsta acción no se puede deshacer.`)) return;
    try {
      await db.collection(COLL.orders).doc(orderId).delete();
      showToast('Pedido eliminado 🗑️', 'info');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
  }

  return { init };
})();
