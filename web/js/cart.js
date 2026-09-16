'use strict';
const Cart = (() => {
  const STORAGE_KEY = 'kk_cart';
  const MAX_QTY_PER_ITEM = 999;
  let items = [], initialized = false, checkoutInProgress = false;
  function notify(message, type = 'info') {
    if (typeof window.showToast === 'function') { window.showToast(message, type); return; }
    console.info(`[Cart:${type}] ${message}`);
  }
  function normalizeId(value) { return String(value ?? '').trim(); }
  function normalizePrice(value) { const price = Number(value); return Number.isFinite(price) && price >= 0 ? price : 0; }
  function normalizeStock(value) {
    if (value === null || value === undefined || value === '') return null;
    const stock = Math.trunc(Number(value));
    return Number.isFinite(stock) && stock >= 0 ? stock : null;
  }
  function normalizeQty(value) {
    const quantity = Math.trunc(Number(value));
    return Number.isFinite(quantity) ? Math.max(1, Math.min(quantity, MAX_QTY_PER_ITEM)) : 1;
  }
  function normalizeItem(item) {
    if (!item || typeof item !== 'object') return null;
    const productId = normalizeId(item.productId || String(item.id || '').split('::')[0]);
    const selections = Array.isArray(item.variantSelections) ? item.variantSelections.map(String) : [];
    const id = KioscoCore.cartKey(productId, selections), name = String(item.name || '').trim();
    const stock = normalizeStock(item.stock);
    if (!productId || !name || stock === 0) return null;
    return { id, productId, variantSelections: selections, name, price: normalizePrice(item.price),
      unit: String(item.unit || 'Unidad'), imageUrl: KioscoCore.productImage(item) || null,
      qty: Math.min(normalizeQty(item.qty), stock ?? MAX_QTY_PER_ITEM), stock };
  }
  function sanitizeItems(rawItems) {
    if (!Array.isArray(rawItems)) return [];
    const merged = new Map(), totals = new Map();
    for (const raw of rawItems) {
      const item = normalizeItem(raw);
      if (!item) continue;
      const used = totals.get(item.productId) || 0;
      item.qty = Math.min(item.qty, (item.stock ?? MAX_QTY_PER_ITEM) - used, MAX_QTY_PER_ITEM - used);
      if (item.qty <= 0) continue;
      totals.set(item.productId, used + item.qty);
      const old = merged.get(item.id);
      if (old) old.qty += item.qty; else merged.set(item.id, item);
    }
    return [...merged.values()];
  }
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      let legacy = {};
      try { legacy = JSON.parse(localStorage.getItem('kk_cart_variants') || '{}'); } catch { /* Invalid legacy state. */ }
      items = sanitizeItems(Array.isArray(raw) ? raw.map(item => {
        const previous = legacy[item.id];
        return previous && !item.variantSelections ? { ...item, variantSelections: previous.selections || [] } : item;
      }) : []);
    } catch { items = []; }
  }
  function save(emit = true) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
    catch { notify('El navegador no permite guardar el carrito. No cierres esta pagina.', 'warning'); }
    if (emit) window.dispatchEvent(new CustomEvent('cart:updated', { detail: { count: count(), total: total(), items: getItems() } }));
  }
  function refreshStoreCards() { window.Store?.refreshCards?.(); }
  function persistAndRender() { save(); render(); refreshStoreCards(); }
  function getItem(id) {
    const key = normalizeId(id);
    return items.find(item => item.id === key) || [...items].reverse().find(item => item.productId === key) || null;
  }
  function productQuantity(productId) { return items.filter(item => item.productId === productId).reduce((sum, item) => sum + item.qty, 0); }
  function add(product, amount = 1) {
    const selections = Array.isArray(product?.variantSelections) ? product.variantSelections.map(String) : [];
    let prepared = { ...product, variantSelections: selections };
    try {
      if (Array.isArray(product?.variants)) {
        prepared.price = KioscoCore.priceFor(product, selections);
        prepared.name = `${product.name}${selections.length ? ' - ' + selections.join(' / ') : ''}`;
      }
    } catch (error) { notify(error.message, 'warning'); return false; }
    const normalized = normalizeItem({ ...prepared, qty: 1 });
    if (!normalized) { notify('El producto no esta disponible.', 'warning'); return false; }
    const existing = items.find(item => item.id === normalized.id);
    const stock = normalizeStock(product.stock ?? existing?.stock);
    const used = productQuantity(normalized.productId);
    const increment = Math.max(1, Math.trunc(Number(amount)) || 1);
    const remaining = Math.min(stock ?? MAX_QTY_PER_ITEM, MAX_QTY_PER_ITEM) - used;
    if (remaining <= 0) { notify('Ya agregaste todo el stock disponible.', 'warning'); return false; }
    const added = Math.min(increment, remaining);
    if (existing) Object.assign(existing, normalized, { qty: existing.qty + added, stock });
    else items.push({ ...normalized, qty: added, stock });
    persistAndRender();
    return true;
  }
  function setQty(id, value, options = {}) {
    const item = getItem(id);
    if (!item) return false;
    const requested = Math.trunc(Number(value));
    if (!Number.isFinite(requested)) { render(); return false; }
    if (requested <= 0) return removeAll(item.id);
    const other = productQuantity(item.productId) - item.qty;
    const limit = Math.max(0, Math.min(item.stock ?? MAX_QTY_PER_ITEM, MAX_QTY_PER_ITEM) - other);
    if (requested > limit && options.notify !== false) notify(`Stock disponible para esta variante: ${limit}`, 'warning');
    if (!limit) return removeAll(item.id);
    item.qty = Math.min(requested, limit);
    persistAndRender();
    return true;
  }
  function remove(id, amount = 1) {
    const item = getItem(id);
    return item ? setQty(item.id, item.qty - Math.max(1, Math.trunc(Number(amount)) || 1)) : false;
  }
  function removeAll(id) {
    const item = getItem(id);
    if (!item) return false;
    items = items.filter(entry => entry.id !== item.id);
    persistAndRender();
    return true;
  }
  function clear(options = {}) {
    if (!items.length || (options.confirmFirst && !window.confirm('Deseas vaciar el carrito?'))) return false;
    items = [];
    try { localStorage.removeItem('kk_cart_variants'); } catch { /* Private browser. */ }
    persistAndRender();
    return true;
  }
  function qty(id) {
    const key = normalizeId(id);
    return key.includes('::') ? (items.find(item => item.id === key)?.qty || 0) : productQuantity(key);
  }
  function subtotal(id) { const item = getItem(id); return item ? KioscoCore.cents(item.price) * item.qty / 100 : 0; }
  function total() { return items.reduce((sum, item) => sum + KioscoCore.cents(item.price) * item.qty, 0) / 100; }
  function count() { return items.reduce((sum, item) => sum + item.qty, 0); }
  function getItems() { return items.map(item => ({ ...item, variantSelections: [...item.variantSelections] })); }
  function getCurrency() { return window.APP_CONFIG?.currency || 'S/'; }
  function formatMoney(value) { return `${getCurrency()} ${Number(value || 0).toFixed(2)}`; }
  function createPlaceholder() {
    const placeholder = document.createElement('div');
    placeholder.className = 'cart-item-img-ph';
    placeholder.innerHTML = '<i class="bi bi-bag" aria-hidden="true"></i>';
    return placeholder;
  }
  function createImage(item) {
    if (!item.imageUrl) return createPlaceholder();
    const image = document.createElement('img');
    Object.assign(image, { className: 'cart-item-img', width: 52, height: 52, loading: 'lazy', alt: item.name, src: item.imageUrl });
    image.addEventListener('error', () => image.replaceWith(createPlaceholder()), { once: true });
    return image;
  }
  function createActionButton(action, item, icon, label, className) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `btn btn-xs cart-action ${className}`;
    button.dataset.cartAction = action; button.dataset.productId = item.id;
    button.setAttribute('aria-label', label); button.title = label;
    button.innerHTML = `<i class="bi bi-${icon}" aria-hidden="true"></i>`;
    return button;
  }
  function createQuantityInput(item) {
    const input = document.createElement('input');
    Object.assign(input, { type: 'number', inputMode: 'numeric', className: 'form-control form-control-sm cart-qty-input', min: '1',
      max: String(item.stock === null ? MAX_QTY_PER_ITEM : item.stock), value: String(item.qty) });
    input.dataset.cartQtyInput = 'true'; input.dataset.productId = item.id;
    input.setAttribute('aria-label', `Cantidad de ${item.name}`);
    return input;
  }
  function createCartItem(item) {
    const row = document.createElement('article'); row.className = 'cart-item'; row.dataset.productId = item.id;
    row.append(createImage(item));
    const content = document.createElement('div'); content.className = 'min-width-0';
    const top = document.createElement('div'); top.className = 'd-flex justify-content-between gap-2';
    const details = document.createElement('div'); details.className = 'flex-grow-1 min-width-0';
    const name = document.createElement('div'); name.className = 'fw-semibold small text-truncate'; name.textContent = item.name;
    const unitPrice = document.createElement('div'); unitPrice.className = 'text-muted small'; unitPrice.textContent = `${formatMoney(item.price)} / ${item.unit}`;
    const itemSubtotal = document.createElement('div'); itemSubtotal.className = 'cart-item-subtotal'; itemSubtotal.textContent = `Subtotal: ${formatMoney(item.price * item.qty)}`;
    details.append(name, unitPrice, itemSubtotal);
    top.append(details, createActionButton('remove', item, 'trash', `Eliminar ${item.name}`, 'btn-outline-danger'));
    const controls = document.createElement('div'); controls.className = 'd-flex align-items-center gap-1 mt-2';
    const decrease = createActionButton('decrease', item, 'dash', `Disminuir ${item.name}`, 'btn-outline-secondary');
    const input = createQuantityInput(item);
    const increase = createActionButton('increase', item, 'plus', `Aumentar ${item.name}`, 'btn-outline-secondary');
    if (item.stock !== null && item.qty >= item.stock) increase.disabled = true;
    const available = document.createElement('small'); available.className = 'text-muted ms-1 cart-stock-available';
    available.textContent = item.stock === null ? 'Stock ilimitado' : `Disponible: ${Math.max(item.stock - item.qty, 0)}`;
    controls.append(decrease, input, increase, available); content.append(top, controls); row.append(content);
    return row;
  }
  function renderList(element) {
    if (!element) return;
    const fragment = document.createDocumentFragment(); items.forEach(item => fragment.append(createCartItem(item))); element.replaceChildren(fragment);
  }
  function toggleElement(element, visible, display = '') {
    if (!element) return; element.hidden = !visible; element.style.display = visible ? display : 'none';
  }
  function render() {
    const countValue = count(), totalText = formatMoney(total()), hasItems = items.length > 0;
    document.querySelectorAll('.cart-count').forEach(element => { element.textContent = String(countValue); toggleElement(element, countValue > 0, 'inline-flex'); });
    renderList(document.getElementById('cartItemsList')); renderList(document.getElementById('cartItemsListMobile'));
    ['cartTotal', 'cartSubtotalMobile', 'cartTotalMobile'].forEach(id => { const element = document.getElementById(id); if (element) element.textContent = totalText; });
    toggleElement(document.getElementById('cartEmpty'), !hasItems, 'block'); toggleElement(document.getElementById('cartEmptyMobile'), !hasItems, 'block');
    toggleElement(document.getElementById('cartFooter'), hasItems, 'block'); toggleElement(document.getElementById('cartFooterMobile'), hasItems, 'block');
    ['clearCartBtn', 'clearCartBtnMobile', 'sendOrderBtn', 'sendOrderBtnMobile', 'shareWhatsappBtn', 'shareWhatsappBtnMobile'].forEach(id => {
      const button = document.getElementById(id); if (button) button.disabled = !hasItems;
    });
  }
  function handleClick(event) {
    const button = event.target.closest('[data-cart-action]'); if (!button) return;
    const id = button.dataset.productId;
    if (button.dataset.cartAction === 'increase') { const item = getItem(id); if (item) add(item); }
    if (button.dataset.cartAction === 'decrease') remove(id);
    if (button.dataset.cartAction === 'remove') removeAll(id);
  }
  function handleQuantityChange(event) {
    const input = event.target.closest('[data-cart-qty-input]'); if (input) setQty(input.dataset.productId, input.value);
  }
  function handleQuantityKeydown(event) {
    const input = event.target.closest('[data-cart-qty-input]');
    if (!input || event.key !== 'Enter') return; event.preventDefault(); input.blur();
  }
  function bindEvents() {
    document.addEventListener('click', handleClick); document.addEventListener('change', handleQuantityChange); document.addEventListener('keydown', handleQuantityKeydown);
    document.getElementById('clearCartBtn')?.addEventListener('click', () => clear({ confirmFirst: true }));
    document.getElementById('clearCartBtnMobile')?.addEventListener('click', () => clear({ confirmFirst: true }));
    window.addEventListener('storage', event => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      load(); render(); window.dispatchEvent(new CustomEvent('cart:updated', { detail: { items: getItems(), count: count(), total: total() } })); refreshStoreCards();
    });
  }
  function syncProducts(productList) {
    if (!Array.isArray(productList) || !items.length) return;
    const products = new Map(productList.map(product => [String(product.id), product]));
    const before = JSON.stringify(items);
    items = items.flatMap(item => {
      const product = products.get(item.productId); if (!product || product.active === false) return [];
      try {
        return [{ ...item, price: KioscoCore.priceFor(product, item.variantSelections), stock: normalizeStock(product.stock),
          name: `${product.name}${item.variantSelections.length ? ' - ' + item.variantSelections.join(' / ') : ''}`,
          imageUrl: KioscoCore.productImage(product) || null, unit: product.unit || 'Unidad' }];
      } catch { return []; }
    });
    items = sanitizeItems(items); if (JSON.stringify(items) !== before) { save(); render(); }
  }
  function validateCheckout(customerName, deliveryType, address) {
    if (!items.length) throw new Error('El carrito esta vacio');
    if (!String(customerName || '').trim()) throw new Error('El nombre del cliente es obligatorio');
    if (deliveryType === 'delivery' && !String(address || '').trim()) throw new Error('La direccion de entrega es obligatoria');
  }
  async function checkout(customerName, customerPhone, notes, deliveryType, address, scheduledDate, scheduledTime, gpsCoords) {
    validateCheckout(customerName, deliveryType, address);
    if (!navigator.onLine) throw new Error('Sin conexion. Tu carrito sigue guardado.');
    if (checkoutInProgress) throw new Error('El pedido ya se esta procesando.');
    if (items.length > 100) throw new Error('El pedido admite hasta 100 lineas de productos.');
    if (String(customerName).trim().length > 120) throw new Error('El nombre supera 120 caracteres.');
    const cleanPhone = String(customerPhone || '').replace(/\D/g, '');
    if (cleanPhone && !/^9\d{8}$/.test(cleanPhone)) throw new Error('Ingresa un celular peruano valido.');
    checkoutInProgress = true;
    try {
      // The client database has NO Firebase Auth session, even on an admin's device.
      const database = window.clientDb || window.db;
      if (!database) throw new Error('La tienda no esta disponible. Recarga la pagina.');
      // Existing local grouping identifier; never a Firebase UID or a login prerequisite.
      const localOwnerId = window.Auth?.getClientId?.() || '';
      // The private block list is advisory in the browser, never an authentication gate.
      let blocked = false;
      try { blocked = await window.KioscoSystem?.isBlockedClient?.(cleanPhone); }
      catch (error) { console.warn('No se pudo consultar la lista interna de clientes:', error?.code || 'unavailable'); }
      if (blocked) throw new Error('No se puede registrar el pedido. Comunicate con la tienda.');
      const currentItems = getItems(), orderReference = database.collection(COLL.orders).doc();
      const quantities = {};
      for (const item of currentItems) quantities[item.productId] = (quantities[item.productId] || 0) + item.qty;
      const extras = window.KioscoFinalImprovements?.getCheckoutExtras?.() || {};
      await database.runTransaction(async transaction => {
        const offerSnapshot = await transaction.get(database.collection(COLL.config).doc('offer'));
        const liveOffer = offerSnapshot.exists ? offerSnapshot.data() : null;
        const snapshots = new Map();
        for (const productId of Object.keys(quantities)) {
          const reference = database.collection(COLL.products).doc(productId);
          snapshots.set(productId, { reference, snapshot: await transaction.get(reference) });
        }
        const orderItems = currentItems.map(item => {
          const { snapshot } = snapshots.get(item.productId);
          if (!snapshot.exists) throw new Error(`El producto ${item.name} ya no existe.`);
          const product = snapshot.data();
          if (product.active === false) throw new Error(`El producto ${item.name} no esta disponible.`);
          const stock = normalizeStock(product.stock);
          if (stock !== null && stock < quantities[item.productId]) throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${stock}.`);
          const price = KioscoCore.priceFor({ ...product, id: item.productId }, item.variantSelections, liveOffer);
          return { productId: item.productId, name: `${product.name}${item.variantSelections.length ? ' - ' + item.variantSelections.join(' / ') : ''}`,
            price, qty: item.qty, unit: product.unit || 'Unidad', variants: item.variantSelections, subtotal: KioscoCore.cents(price) * item.qty / 100 };
        });
        for (const [productId, { reference, snapshot }] of snapshots) {
          const stock = normalizeStock(snapshot.data().stock);
          if (stock !== null) transaction.update(reference, { stock: stock - quantities[productId], lastOrderId: orderReference.id,
            stockReservations: { ...(snapshot.data().stockReservations || {}), [orderReference.id]: quantities[productId] },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
        transaction.set(orderReference, {
          ownerId: localOwnerId, customer: String(customerName).trim(), customerPhone: cleanPhone || null,
          items: orderItems, productQuantities: quantities,
          total: orderItems.reduce((sum, item) => sum + KioscoCore.cents(item.subtotal), 0) / 100,
          itemCount: orderItems.reduce((sum, item) => sum + item.qty, 0), status: 'pending',
          paymentMethod: extras.paymentMethod || 'cash', paymentGroup: extras.paymentGroup || 'cash',
          paymentProofExpected: Boolean(extras.paymentProofExpected), notes: String(notes || '').trim().slice(0, 300) || null,
          deliveryType: deliveryType === 'delivery' ? 'delivery' : 'pickup', deliveryAddress: String(address || '').trim() || null,
          scheduledDate: scheduledDate || null, scheduledTime: scheduledTime || null, location: gpsCoords || null,
          source: 'web', createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      load();
      for (const purchased of currentItems) {
        const current = items.find(item => item.id === purchased.id); if (current) current.qty -= purchased.qty;
      }
      items = items.filter(item => item.qty > 0); persistAndRender();
      return orderReference.id;
    } finally { checkoutInProgress = false; }
  }
  function init() {
    if (initialized) { render(); return; }
    initialized = true; load(); bindEvents();
    const currentProducts = window.Store?.getProducts?.() || [];
    if (currentProducts.length) syncProducts(currentProducts);
    render();
  }
  return { init, add, addItem: add, getQty: qty, removeOne: remove, setQty, remove, removeAll, clear,
    qty, subtotal, total, count, getItems, render, syncProducts, checkout };
})();
window.Cart = Cart;
