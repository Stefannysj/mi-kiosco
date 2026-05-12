// ===== js/cart.js =====
// Carrito con: envío programado (hasta 3 días), ubicación en tiempo real, dirección

const Cart = (() => {
  let items = [];

  function load() {
    try { items = JSON.parse(localStorage.getItem('kiosco_cart') || '[]'); }
    catch { items = []; }
  }

  function save() { localStorage.setItem('kiosco_cart', JSON.stringify(items)); }

  function addItem(product) {
    const idx = items.findIndex(i => i.product.id === product.id);
    if (idx >= 0) items[idx].qty++;
    else items.push({ product, qty: 1 });
    save(); render(); animateBadge();
  }

  function removeOne(productId) {
    const idx = items.findIndex(i => i.product.id === productId);
    if (idx < 0) return;
    if (items[idx].qty > 1) items[idx].qty--;
    else items.splice(idx, 1);
    save(); render();
  }

  function removeAll(productId) {
    items = items.filter(i => i.product.id !== productId);
    save(); render();
  }

  function clear() { items = []; save(); render(); }

  function getQty(productId) { return items.find(i => i.product.id === productId)?.qty || 0; }
  function getTotal() { return items.reduce((s, i) => s + i.product.price * i.qty, 0); }
  function getItems() { return items; }
  function getCount() { return items.reduce((s, i) => s + i.qty, 0); }

  function animateBadge() {
    document.querySelectorAll('.cart-badge').forEach(b => {
      b.classList.remove('badge-animate');
      void b.offsetWidth;
      b.classList.add('badge-animate');
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function render() {
    const count = getCount();
    const total = getTotal();
    const totalStr = `${APP_CONFIG.currency} ${total.toFixed(2)}`;

    document.querySelectorAll('.cart-badge').forEach(el => el.textContent = count);
    document.querySelectorAll('#cartTotal,#cartTotalMobile').forEach(el => { if (el) el.textContent = totalStr; });

    ['cartFooter', 'cartFooterMobile'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = items.length ? 'flex' : 'none';
    });

    renderItemsList('cartItems');
    renderItemsList('cartItemsMobile');

    if (window.Store) Store.refreshCards();
  }

  function renderItemsList(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items.length) {
      container.innerHTML = '<p class="cart-empty">Tu carrito está vacío</p>';
      return;
    }

    container.innerHTML = items.map(({ product, qty }) => {
      const imgHtml = product.imageUrl
        ? `<img class="cart-item-img" src="${product.imageUrl}" alt="${product.name}" />`
        : `<div class="cart-item-img">${product.emoji || '🛍️'}</div>`;
      return `<div class="cart-item" data-id="${product.id}">
        ${imgHtml}
        <div class="cart-item-info">
          <p class="cart-item-name">${product.name}</p>
          <p class="cart-item-price">${APP_CONFIG.currency} ${(product.price * qty).toFixed(2)}</p>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" data-id="${product.id}" data-action="remove">−</button>
          <span class="qty-value">${qty}</span>
          <button class="qty-btn" data-id="${product.id}" data-action="add">+</button>
          <button class="cart-item-remove" data-id="${product.id}">✕</button>
        </div>
      </div>`;
    }).join('');

    container.querySelectorAll('.qty-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const p = items.find(i => i.product.id === id)?.product;
        if (btn.dataset.action === 'add' && p) addItem(p);
        else removeOne(id);
      })
    );
    container.querySelectorAll('.cart-item-remove').forEach(btn =>
      btn.addEventListener('click', () => removeAll(btn.dataset.id))
    );
  }

  // ── Modal envío avanzado ───────────────────────────────────────────────────
  function openOrderModal(isMobile) {
    if (!items.length) return;

    const existing = document.getElementById('orderOptionsModal');
    if (existing) existing.remove();

    const savedName = Auth.getUserName ? Auth.getUserName() : (localStorage.getItem('kiosco_user_name') || '');
    const savedPhone = Auth.getUserPhone ? Auth.getUserPhone() : (localStorage.getItem('kiosco_user_phone') || '');

    // Build date options (today + 2 days)
    const dateOpts = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const label = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'short' });
      const value = d.toISOString().slice(0, 10);
      dateOpts.push(`<option value="${value}">${label} — ${d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</option>`);
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.id = 'orderOptionsModal';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:480px">
        <button class="modal-close" id="closeOrderModal">✕</button>
        <h2 class="modal-title">🚀 Confirmar Pedido</h2>

        <!-- Resumen -->
        <div style="background:var(--bg-3);border-radius:var(--radius-sm);padding:.75rem;margin-bottom:1rem;font-size:.85rem">
          ${items.map(i => `<div style="display:flex;justify-content:space-between;margin-bottom:.3rem">
            <span>${i.product.name} ×${i.qty}</span>
            <span style="color:var(--accent);font-weight:700">${APP_CONFIG.currency} ${(i.product.price * i.qty).toFixed(2)}</span>
          </div>`).join('')}
          <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:.5rem;margin-top:.5rem;font-weight:800">
            <span>Total</span>
            <span style="color:var(--accent)">${APP_CONFIG.currency} ${getTotal().toFixed(2)}</span>
          </div>
        </div>

        <div class="modal-form">
          <!-- Datos del cliente -->
          <div class="form-row">
            <label>Tu nombre *</label>
            <input type="text" id="orderName" class="input-field" value="${savedName}" placeholder="Nombre completo" required />
          </div>
          <div class="form-row">
            <label>Teléfono (opcional)</label>
            <input type="tel" id="orderPhone" class="input-field" value="${savedPhone}" placeholder="+51 9XX XXX XXX" />
          </div>

          <!-- Fecha de entrega -->
          <div class="form-row">
            <label>📅 ¿Cuándo lo quieres?</label>
            <select id="orderDate" class="input-field">
              ${dateOpts.join('')}
            </select>
          </div>

          <!-- Hora -->
          <div class="form-row">
            <label>🕐 Hora preferida</label>
            <input type="time" id="orderTime" class="input-field" value="${getDefaultTime()}" />
          </div>

          <!-- Tipo de entrega -->
          <div class="form-row">
            <label>🛵 Tipo de entrega</label>
            <div style="display:flex;gap:.5rem;margin-top:.25rem">
              <button class="delivery-type-btn active" data-type="pickup">🏪 Recoger en tienda</button>
              <button class="delivery-type-btn" data-type="delivery">🛵 Delivery</button>
            </div>
          </div>

          <!-- Dirección (solo si delivery) -->
          <div class="form-row" id="addressRow" style="display:none">
            <label>📍 Dirección de entrega</label>
            <input type="text" id="orderAddress" class="input-field" placeholder="Calle, número, referencia..." />
            <button class="btn-outline btn-sm" id="useLocationBtn" style="margin-top:.4rem;width:100%">
              📡 Usar mi ubicación actual
            </button>
            <p id="locationStatus" style="font-size:.75rem;color:var(--text-3);margin-top:.3rem"></p>
          </div>

          <!-- Notas -->
          <div class="form-row">
            <label>📝 Notas adicionales</label>
            <textarea id="orderNotes" class="input-field" rows="2" placeholder="Sin cebolla, extra salsa, etc."></textarea>
          </div>

          <!-- Acciones -->
          <div style="display:flex;flex-direction:column;gap:.5rem;margin-top:.5rem">
            <button class="btn-primary btn-block" id="confirmOrderBtn">✅ Enviar Pedido</button>
            <button class="btn-outline btn-block" id="shareOrderWhatsapp">💬 Compartir por WhatsApp</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(modal);

    // Close
    modal.querySelector('#closeOrderModal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    // Delivery type toggle
    let deliveryType = 'pickup';
    modal.querySelectorAll('.delivery-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.delivery-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        deliveryType = btn.dataset.type;
        document.getElementById('addressRow').style.display = deliveryType === 'delivery' ? '' : 'none';
      });
    });

    // GPS location
    let gpsCoords = null;
    document.getElementById('useLocationBtn')?.addEventListener('click', () => {
      const status = document.getElementById('locationStatus');
      if (!navigator.geolocation) { status.textContent = 'Geolocalización no disponible'; return; }
      status.textContent = '📡 Obteniendo ubicación...';
      navigator.geolocation.getCurrentPosition(
        pos => {
          gpsCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          const addressInput = document.getElementById('orderAddress');
          if (addressInput && !addressInput.value) {
            addressInput.value = `GPS: ${gpsCoords.lat.toFixed(6)}, ${gpsCoords.lng.toFixed(6)}`;
          }
          status.textContent = `✅ Ubicación obtenida (precisión: ${Math.round(gpsCoords.accuracy)}m)`;
          status.style.color = 'var(--success)';
          // Open Google Maps link
          const mapsUrl = `https://www.google.com/maps?q=${gpsCoords.lat},${gpsCoords.lng}`;
          status.innerHTML += ` <a href="${mapsUrl}" target="_blank" style="color:var(--info);text-decoration:underline">Ver en mapa</a>`;
        },
        err => {
          status.textContent = '❌ No se pudo obtener ubicación. Activa el GPS.';
          status.style.color = 'var(--danger)';
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

    // Confirm order
    document.getElementById('confirmOrderBtn')?.addEventListener('click', () => sendOrder(modal, deliveryType, gpsCoords));

    // WhatsApp share
    document.getElementById('shareOrderWhatsapp')?.addEventListener('click', () => {
      if (window.Share) Share.openWhatsapp(items, getTotal());
    });
  }

  function getDefaultTime() {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  async function sendOrder(modal, deliveryType, gpsCoords) {
    const name = document.getElementById('orderName')?.value.trim();
    const phone = document.getElementById('orderPhone')?.value.trim();
    const date = document.getElementById('orderDate')?.value;
    const time = document.getElementById('orderTime')?.value;
    const address = document.getElementById('orderAddress')?.value.trim();
    const notes = document.getElementById('orderNotes')?.value.trim();

    if (!name) { showToast('Ingresa tu nombre', 'error'); return; }

    const btn = document.getElementById('confirmOrderBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }

    const order = {
      customer: name,
      customerPhone: phone || null,
      items: items.map(i => ({
        productId: i.product.id,
        name: i.product.name,
        price: i.product.price,
        qty: i.qty,
        subtotal: +(i.product.price * i.qty).toFixed(2)
      })),
      total: +getTotal().toFixed(2),
      status: 'pending',
      deliveryType: deliveryType,
      deliveryAddress: deliveryType === 'delivery' ? (address || null) : null,
      scheduledDate: date || null,
      scheduledTime: time || null,
      notes: notes || null,
      location: gpsCoords ? {
        lat: gpsCoords.lat,
        lng: gpsCoords.lng,
        accuracy: gpsCoords.accuracy
      } : null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      await db.collection(COLL.orders).add(order);
      clear();
      modal?.remove();
      closeModal(document.getElementById('cartModal'));
      showToast('¡Pedido enviado! 🎉', 'success');
      // Save user data
      if (name) localStorage.setItem('kiosco_user_name', name);
      if (phone) localStorage.setItem('kiosco_user_phone', phone);
    } catch (e) {
      showToast('Error al enviar pedido', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '✅ Enviar Pedido'; }
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    load(); render();

    document.getElementById('clearCartBtn')?.addEventListener('click', clear);

    // Mobile cart modal
    document.getElementById('cartBtnMobile')?.addEventListener('click', () =>
      openModal(document.getElementById('cartModal'))
    );
    document.getElementById('closeCartModal')?.addEventListener('click', () =>
      closeModal(document.getElementById('cartModal'))
    );
    document.getElementById('cartModal')?.addEventListener('click', e => {
      if (e.target.id === 'cartModal') closeModal(document.getElementById('cartModal'));
    });

    // Send order → open advanced modal
    document.getElementById('sendOrderBtn')?.addEventListener('click', () => openOrderModal(false));
    document.getElementById('sendOrderBtnMobile')?.addEventListener('click', () => openOrderModal(true));

    // WhatsApp
    ['shareWhatsappBtn', 'shareWhatsappBtnMobile'].forEach(id =>
      document.getElementById(id)?.addEventListener('click', () =>
        Share.openWhatsapp(items, getTotal())
      )
    );
  }

  return { init, addItem, removeOne, removeAll, clear, getQty, getTotal, getItems, getCount, render };
})();
