'use strict';

const Orders = (() => {
  let unsubscribe = null;
  let statusFilter = 'all';
  let periodFilter = 'day';
  let allOrders = [];
  let initialized = false;
  let refreshTimer = null;

  function init() {
    if (initialized) {
      refresh();
      return;
    }

    initialized = true;
    bindFilters();
    bindExport();
    subscribe();
    refreshTimer = window.setInterval(refresh, 60000);
  }

  function refresh() {
    renderCurrent();
  }

  function bindFilters() {
    document.querySelectorAll('[data-orders-filter]').forEach(button => {
      if (button.dataset.ordersStatusBound === 'true') return;
      button.dataset.ordersStatusBound = 'true';
      button.addEventListener('click', () => {
        document.querySelectorAll('[data-orders-filter]').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        statusFilter = button.dataset.ordersFilter || 'all';
        renderCurrent();
      });
    });

    document.querySelectorAll('[data-orders-period]').forEach(button => {
      if (button.dataset.ordersPeriodBound === 'true') return;
      button.dataset.ordersPeriodBound = 'true';
      button.addEventListener('click', () => {
        document.querySelectorAll('[data-orders-period]').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        periodFilter = button.dataset.ordersPeriod || 'day';
        renderCurrent();
      });
    });
  }

  function bindExport() {
    const button = document.getElementById('ordersExportBtn');
    if (!button || button.dataset.ordersExportBound === 'true') return;

    button.dataset.ordersExportBound = 'true';
    button.addEventListener('click', async () => {
      const list = getFilteredOrders();
      const statusName = {
        all: 'Todos',
        pending: 'Pendientes',
        done: 'Completados',
        rejected: 'Rechazados'
      }[statusFilter] || 'Pedidos';
      const periodName = {
        day: 'Hoy',
        week: 'Semana',
        month: 'Mes'
      }[periodFilter] || 'Historial';

      if (typeof Dashboard === 'undefined' || typeof Dashboard.exportOrders !== 'function') {
        showToast('El exportador de Excel no está disponible', 'danger');
        return;
      }

      await Dashboard.exportOrders(list, {
        period: periodFilter,
        periodLabel: `${periodName} - ${statusName}`,
        button,
        filePrefix: `historial-${statusFilter}`,
        lockKey: `orders:${periodFilter}:${statusFilter}`
      });
    });
  }

  function subscribe() {
    if (typeof unsubscribe === 'function') unsubscribe();

    unsubscribe = db.collection(COLL.orders).onSnapshot(snapshot => {
      allOrders = snapshot.docs
        .map(documentSnapshot => ({ id: documentSnapshot.id, ...documentSnapshot.data() }))
        .sort((left, right) => toDate(right.createdAt) - toDate(left.createdAt));
      renderCurrent();
    }, error => {
      console.warn('Pedidos:', error?.code || error);
      showToast('No se pudieron actualizar los pedidos', 'warning');
    });
  }

  function toDate(value) {
    if (!value) return new Date(0);
    if (typeof value.toDate === 'function') return value.toDate();
    if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000);
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  function filterByPeriod(list) {
    if (typeof Dashboard !== 'undefined' && typeof Dashboard.filterByPeriod === 'function') {
      return Dashboard.filterByPeriod(list, periodFilter);
    }

    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (periodFilter === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 1);
    } else if (periodFilter === 'week') {
      const day = start.getDay();
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 7);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setMonth(end.getMonth() + 1);
    }

    return list.filter(order => {
      const createdAt = toDate(order.createdAt);
      return createdAt >= start && createdAt < end;
    });
  }

  function getFilteredOrders() {
    const periodOrders = filterByPeriod(allOrders);
    if (statusFilter === 'all') return periodOrders;
    return periodOrders.filter(order => order.status === statusFilter);
  }

  function renderCurrent() {
    render(getFilteredOrders());
    const counter = document.getElementById('ordersFilteredCount');
    if (counter) counter.textContent = String(getFilteredOrders().length);
  }

  function render(list) {
    const container = document.getElementById('ordersContainer');
    if (!container) return;

    if (!list.length) {
      container.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="bi bi-clipboard-x display-4 text-muted"></i>
          <p class="mt-3 text-muted">No hay pedidos para el filtro seleccionado</p>
        </div>`;
      return;
    }

    const statusBadge = { pending: 'warning', done: 'success', rejected: 'danger' };
    const statusLabel = { pending: 'Pendiente', done: 'Completado', rejected: 'Rechazado' };

    container.innerHTML = list.map(order => {
      const createdAt = toDate(order.createdAt);
      const dateText = createdAt.getTime()
        ? createdAt.toLocaleString('es-PE', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        : '—';
      const items = (order.items || []).map(item => {
        const unit = item.unit ? ` ${item.unit}` : '';
        return `${item.name} ×${item.qty}${unit}`;
      }).join(', ');
      const locationLink = order.location
        ? `<a href="https://www.google.com/maps?q=${Number(order.location.lat)},${Number(order.location.lng)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-info btn-sm py-0 mt-1"><i class="bi bi-geo-alt me-1"></i>GPS</a>`
        : '';

      return `
        <div class="col-12 col-md-6 col-xl-4">
          <div class="card h-100 order-card border-start border-4 border-${statusBadge[order.status] || 'secondary'}">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start mb-2 gap-2">
                <div class="min-width-0">
                  <strong class="d-block text-break">${escapeHtml(order.customer || 'Cliente')}</strong>
                  ${order.customerPhone ? `<small class="text-muted"><i class="bi bi-telephone me-1"></i>${escapeHtml(order.customerPhone)}</small>` : ''}
                </div>
                <span class="badge bg-${statusBadge[order.status] || 'secondary'}">${statusLabel[order.status] || escapeHtml(order.status)}</span>
              </div>
              <p class="small text-muted mb-1"><i class="bi bi-clock me-1"></i>${escapeHtml(dateText)}</p>
              <p class="small mb-1 text-break"><i class="bi bi-bag me-1"></i>${escapeHtml(items)}</p>
              ${order.deliveryType === 'delivery'
                ? `<p class="small mb-1 text-break"><i class="bi bi-truck me-1"></i>${escapeHtml(order.deliveryAddress || 'Sin dirección')}</p>`
                : '<p class="small mb-1"><i class="bi bi-shop me-1"></i>Recojo en tienda</p>'}
              ${order.scheduledDate ? `<p class="small mb-1"><i class="bi bi-calendar me-1"></i>${escapeHtml(order.scheduledDate)}${order.scheduledTime ? ` ${escapeHtml(order.scheduledTime)}` : ''}</p>` : ''}
              ${order.notes ? `<p class="small mb-1 text-muted text-break"><i class="bi bi-chat-left-text me-1"></i>${escapeHtml(order.notes)}</p>` : ''}
              ${locationLink}
              <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top gap-2">
                <strong class="text-primary">${getCurrency()} ${Number(order.total || 0).toFixed(2)}</strong>
                <div class="btn-group btn-group-sm flex-shrink-0">
                  <button class="btn btn-outline-warning" onclick="Orders.setStatus('${order.id}','pending')" title="Pendiente" aria-label="Marcar pendiente"><i class="bi bi-hourglass"></i></button>
                  <button class="btn btn-outline-success" onclick="Orders.setStatus('${order.id}','done')" title="Completado" aria-label="Marcar completado"><i class="bi bi-check-lg"></i></button>
                  <button class="btn btn-outline-danger" onclick="Orders.setStatus('${order.id}','rejected')" title="Rechazado" aria-label="Marcar rechazado"><i class="bi bi-x-lg"></i></button>
                  <button class="btn btn-outline-secondary" onclick="Orders.invoice('${order.id}')" title="Boleta" aria-label="Abrir boleta"><i class="bi bi-receipt"></i></button>
                  <button class="btn btn-outline-danger" onclick="Orders.del('${order.id}')" title="Eliminar" aria-label="Eliminar pedido"><i class="bi bi-trash"></i></button>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function getCurrency() {
    return window.APP_CONFIG?.currency || 'S/';
  }

  const mutationLocks = new Set();
  async function inventoryPlan(transaction, orderId, order, status) {
    const quantities = order.productQuantities || {};
    const committed = {};
    const updates = [];
    let legacy = false;
    for (const [productId, rawQty] of Object.entries(quantities)) {
      const qty = Number(rawQty);
      if (!Number.isSafeInteger(qty) || qty < 1 || qty > 999) throw new Error('Cantidad de pedido invalida. Revisa el inventario.');
      const ref = db.collection(COLL.products).doc(productId);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) { legacy = true; continue; }
      const product = snapshot.data();
      if (product.stock == null || product.stock === '') continue;
      const stock = Number(product.stock);
      if (!Number.isSafeInteger(stock) || stock < 0) throw new Error('El stock del producto no es valido.');
      const reservations = { ...(product.stockReservations || {}) };
      const reserved = Number(reservations[orderId] || 0);
      const consumed = Number(order.inventoryCommitted?.[productId] || 0);
      const verifiedQty = reserved || consumed;
      let nextStock = stock;
      delete reservations[orderId];
      if (status === 'rejected') {
        if (verifiedQty > 0) nextStock += verifiedQty;
        else if (order.status !== 'rejected') legacy = true;
      } else if (order.status === 'rejected') {
        if (product.active === false || stock < qty) throw new Error(`Stock insuficiente para reabrir ${product.name}.`);
        nextStock -= qty;
        if (status === 'pending') reservations[orderId] = qty;
        else committed[productId] = qty;
      } else if (status === 'done') {
        if (verifiedQty > 0) committed[productId] = verifiedQty;
        else legacy = true;
      } else if (verifiedQty > 0) reservations[orderId] = verifiedQty;
      if (nextStock !== stock || JSON.stringify(reservations) !== JSON.stringify(product.stockReservations || {})) {
        updates.push({ ref, data: { stock: nextStock, stockReservations: reservations, lastOrderId: orderId,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp() } });
      }
    }
    return { updates, committed, legacy };
  }
  function publicProjection(id, order) {
    return { orderId: id, status: order.status, billing: order.billing, total: Number(order.total || 0),
      paymentMethod: String(order.paymentMethod || ''), createdAt: order.createdAt,
      items: (order.items || []).map(item => ({ name: String(item.name || ''), qty: Number(item.qty || 0),
        price: Number(item.price || 0), subtotal: Number(item.subtotal || 0), unit: String(item.unit || 'Unidad') })) };
  }
  async function setStatus(id, status) {
    if (!['pending', 'done', 'rejected'].includes(status) || mutationLocks.has(id)) return;
    mutationLocks.add(id);
    try {
      const legacy = await db.runTransaction(async transaction => {
        const ref = db.collection(COLL.orders).doc(id);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new Error('El pedido ya no existe.');
        const order = snapshot.data();
        if (order.status === status) return false;
        const plan = await inventoryPlan(transaction, id, order, status);
        // All transaction reads above, all writes below.
        for (const item of plan.updates) transaction.update(item.ref, item.data);
        const changes = { status, inventoryCommitted: plan.committed, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        transaction.update(ref, changes);
        if (order.billing?.publicToken) transaction.set(db.collection('public_receipts').doc(order.billing.publicToken), publicProjection(id, { ...order, ...changes }));
        return plan.legacy;
      });
      showToast(legacy ? 'Pedido actualizado. Es anterior al control de reservas: revisa su stock manualmente.' : 'Pedido y stock actualizados', legacy ? 'warning' : 'success');
    } catch (error) { showToast(`No se pudo actualizar el pedido: ${error.message}`, 'danger'); }
    finally { mutationLocks.delete(id); }
  }
  async function del(id) {
    const order = allOrders.find(item => item.id === id);
    if (mutationLocks.has(id) || !window.confirm(`Eliminar pedido de "${order?.customer || 'cliente'}" y sus archivos de pago? Una venta completada no devolvera stock; rechazala primero para anularla.`)) return;
    mutationLocks.add(id);
    try {
      await db.runTransaction(async transaction => {
        const ref = db.collection(COLL.orders).doc(id);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) return;
        const fresh = snapshot.data();
        const plan = fresh.status === 'pending' ? await inventoryPlan(transaction, id, fresh, 'rejected') : { updates: [] };
        for (const item of plan.updates) transaction.update(item.ref, item.data);
        transaction.delete(db.collection('paymentProofs').doc(id));
        if (fresh.billing?.publicToken) transaction.delete(db.collection('public_receipts').doc(fresh.billing.publicToken));
        transaction.delete(ref);
      });
      showToast('Pedido y archivos asociados eliminados', 'info');
    } catch (error) { showToast(`No se pudo eliminar el pedido: ${error.message}`, 'danger'); }
    finally { mutationLocks.delete(id); }
  }

  function invoice(id) {
    const order = allOrders.find(item => item.id === id);
    if (!order) return;

    const rows = (order.items || []).map(item => {
      const quantity = Number(item.qty || 0);
      const price = Number(item.price || 0);
      const subtotal = Number(item.subtotal ?? price * quantity);
      return `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td class="text-center">${quantity}</td>
          <td>${escapeHtml(item.unit || 'Unidad')}</td>
          <td class="text-end">${getCurrency()} ${price.toFixed(2)}</td>
          <td class="text-end">${getCurrency()} ${subtotal.toFixed(2)}</td>
        </tr>`;
    }).join('');

    const dateText = toDate(order.createdAt).toLocaleString('es-PE');
    const html = `<!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Boleta</title>
          <style>
            body{font-family:Arial,sans-serif;max-width:700px;margin:2rem auto;padding:1rem;color:#202124}
            h1{color:#f97316}table{width:100%;border-collapse:collapse;margin:1rem 0}
            th,td{padding:8px;border-bottom:1px solid #ddd}th{background:#f5f5f5}.total{font-size:1.2rem;font-weight:bold;color:#f97316}
          </style>
        </head>
        <body>
          <h1>${escapeHtml(window.APP_CONFIG?.storeName || 'Kiosco')}</h1>
          <p>Fecha: ${escapeHtml(dateText)}</p>
          <p>Cliente: <strong>${escapeHtml(order.customer || 'Cliente')}</strong></p>
          <table>
            <thead><tr><th>Producto</th><th>Cant.</th><th>Unidad</th><th>Precio</th><th>Subtotal</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p class="total">TOTAL: ${getCurrency()} ${Number(order.total || 0).toFixed(2)}</p>
          <script>window.print()<\/script>
        </body>
      </html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('El navegador bloqueó la ventana de impresión', 'warning');
      return;
    }
    printWindow.opener = null;
    printWindow.document.write(html);
    printWindow.document.close();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function destroy() { unsubscribe?.(); unsubscribe = null; clearInterval(refreshTimer); allOrders = []; initialized = false; renderCurrent(); }

  return {
    init, destroy,
    refresh,
    setStatus,
    del,
    invoice,
    getFilteredOrders
  };
})();

window.Orders = Orders;
