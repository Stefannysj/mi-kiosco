// js/orders.js — Real-time order management
const Orders = (() => {
  let unsub  = null;
  let filter = 'all';

  function init() {
    bindFilters();
    subscribe();
  }

  function bindFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filter = btn.dataset.filter;
        subscribe();
      });
    });
  }

  function subscribe() {
    if (unsub) unsub();
    let q = db.collection(COLL.orders).orderBy('createdAt','desc').limit(120);
    if (filter !== 'all')
      q = db.collection(COLL.orders)
        .where('status','==',filter).orderBy('createdAt','desc').limit(120);

    unsub = q.onSnapshot(snap => {
      const orders = snap.docs.map(d => ({ id:d.id,...d.data() }));
      render(orders);
    });
  }

  function render(orders) {
    const list = document.getElementById('ordersList');
    if (!list) return;
    if (!orders.length) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📋</div><p>No hay pedidos</p></div>`;
      return;
    }
    list.innerHTML = orders.map(buildCard).join('');
    list.querySelectorAll('.status-btn').forEach(btn =>
      btn.addEventListener('click', () => setStatus(btn.dataset.id, btn.dataset.status))
    );
  }

  function buildCard(o) {
    const statusColors = { pending:'var(--warning)', done:'var(--success)', rejected:'var(--danger)' };
    const statusLabels = { pending:'⏳ Pendiente', done:'✅ Hecho', rejected:'❌ Rechazado' };
    const dt = o.createdAt?.toDate
      ? o.createdAt.toDate().toLocaleString('es-PE',
          {hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'})
      : 'Ahora';
    const items = (o.items||[]).map(i=>`${i.name} ×${i.qty}`).join(', ');
    const btns  = ['pending','done','rejected'].map(s =>
      `<button class="status-btn ${s} ${o.status===s?'active-status':''}"
         data-id="${o.id}" data-status="${s}">${statusLabels[s]}</button>`
    ).join('');

    return `<div class="order-card" style="border-left-color:${statusColors[o.status]||'var(--border)'}">
      <div class="order-meta">
        <p class="order-customer">👤 ${o.customer||'Cliente'}</p>
        <p class="order-time">🕐 ${dt}</p>
      </div>
      <div class="order-items" title="${items}">📦 ${items}</div>
      <span class="order-total">${APP_CONFIG.currency} ${(o.total||0).toFixed(2)}</span>
      <div class="order-status-btns">${btns}</div>
    </div>`;
  }

  async function setStatus(id, status) {
    try {
      await db.collection(COLL.orders).doc(id).update({
        status, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      const labels = { pending:'Pendiente ⏳', done:'Hecho ✅', rejected:'Rechazado ❌' };
      showToast(`Estado: ${labels[status]}`, 'info');
    } catch { showToast('Error al actualizar estado', 'error'); }
  }

  return { init };
})();
