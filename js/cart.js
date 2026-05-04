// js/cart.js — Shopping cart
const Cart = (() => {
  let items = []; // [{ product, qty }]

  // ── Persistence ───────────────────────────────────────────────────────────
  function load() {
    try { items = JSON.parse(localStorage.getItem('kiosco_cart') || '[]'); }
    catch { items = []; }
  }
  function save() {
    localStorage.setItem('kiosco_cart', JSON.stringify(items));
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
  function addItem(product) {
    const i = items.findIndex(x => x.product.id === product.id);
    if (i >= 0) items[i].qty++;
    else items.push({ product, qty: 1 });
    save(); render(); animateBadge();
    showToast(`${product.name} agregado 🛒`, 'success');
  }

  function removeOne(id) {
    const i = items.findIndex(x => x.product.id === id);
    if (i < 0) return;
    items[i].qty > 1 ? items[i].qty-- : items.splice(i, 1);
    save(); render();
  }

  function removeAll(id) {
    items = items.filter(x => x.product.id !== id);
    save(); render();
  }

  function clear() { items = []; save(); render(); }

  // ── Getters ───────────────────────────────────────────────────────────────
  const getQty   = id => items.find(x => x.product.id === id)?.qty || 0;
  const getTotal = ()  => items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const getCount = ()  => items.reduce((s, i) => s + i.qty, 0);
  const getItems = ()  => items;

  // ── Badge animation ───────────────────────────────────────────────────────
  function animateBadge() {
    const b = document.getElementById('cartBadge');
    b?.classList.remove('badge-animate');
    void b?.offsetWidth;
    b?.classList.add('badge-animate');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    const count = getCount();
    const total = getTotal();
    const totalStr = `${APP_CONFIG.currency} ${total.toFixed(2)}`;

    // Badge
    document.getElementById('cartBadge').textContent = count;

    // Totals & footer visibility
    ['cartTotal','cartTotalMobile'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = totalStr;
    });
    ['cartFooter','cartFooterMobile'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = items.length ? 'flex' : 'none';
    });

    // Item lists
    renderList('cartItems');
    renderList('cartItemsMobile');

    // Refresh product qty controls in store
    if (window.Store) Store.refreshCards();
  }

  function renderList(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!items.length) { c.innerHTML = '<p class="cart-empty">Tu carrito está vacío 🛒</p>'; return; }

    c.innerHTML = items.map(({ product: p, qty }) => {
      const img = p.imageUrl
        ? `<img class="cart-item-img" src="${p.imageUrl}" alt="${p.name}"/>`
        : `<div class="cart-item-img">${p.emoji||'🛍️'}</div>`;
      return `<div class="cart-item" data-id="${p.id}">
        ${img}
        <div class="cart-item-info">
          <p class="cart-item-name">${p.name}</p>
          <p class="cart-item-price">${APP_CONFIG.currency} ${(p.price*qty).toFixed(2)}</p>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" data-id="${p.id}" data-action="remove">−</button>
          <span class="qty-value">${qty}</span>
          <button class="qty-btn" data-id="${p.id}" data-action="add">+</button>
          <button class="cart-item-remove" data-id="${p.id}" aria-label="Quitar">✕</button>
        </div>
      </div>`;
    }).join('');

    c.querySelectorAll('.qty-btn').forEach(btn =>
      btn.addEventListener('click', () =>
        btn.dataset.action === 'add'
          ? addItem(items.find(x => x.product.id === btn.dataset.id).product)
          : removeOne(btn.dataset.id)
      )
    );
    c.querySelectorAll('.cart-item-remove').forEach(btn =>
      btn.addEventListener('click', () => removeAll(btn.dataset.id))
    );
  }

  // ── Send order to Firestore ───────────────────────────────────────────────
  async function sendOrder(isMobile) {
    if (!items.length) return;
    const nameEl = document.getElementById(isMobile ? 'customerNameMobile' : 'customerName');
    const customer = nameEl?.value.trim() || 'Cliente';

    const order = {
      customer,
      items: items.map(i => ({
        productId: i.product.id,
        name:      i.product.name,
        price:     i.product.price,
        qty:       i.qty,
        subtotal:  +(i.product.price * i.qty).toFixed(2)
      })),
      total:     +getTotal().toFixed(2),
      status:    'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      await db.collection(COLL.orders).add(order);
      clear();
      closeModal(document.getElementById('cartModal'));
      showToast('¡Pedido enviado! 🎉', 'success');
    } catch { showToast('Error al enviar pedido', 'error'); }
  }

  // ── Init & bindings ───────────────────────────────────────────────────────
  function init() {
    load(); render();

    // Clear cart
    document.getElementById('clearCartBtn')?.addEventListener('click', () => {
      if (confirm('¿Limpiar el carrito?')) clear();
    });

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

    // Send order
    document.getElementById('sendOrderBtn')?.addEventListener('click', () => sendOrder(false));
    document.getElementById('sendOrderBtnMobile')?.addEventListener('click', () => sendOrder(true));

    // WhatsApp
    document.getElementById('shareWhatsappBtn')?.addEventListener('click', () =>
      Share.openWhatsapp(items, getTotal())
    );
    document.getElementById('shareWhatsappBtnMobile')?.addEventListener('click', () =>
      Share.openWhatsapp(items, getTotal())
    );
  }

  return { init, addItem, removeOne, removeAll, clear, getQty, getTotal, getCount, getItems, render };
})();
