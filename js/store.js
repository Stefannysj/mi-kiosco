// js/store.js — Public store, real-time
const Store = (() => {
  let categories = [];
  let products   = [];
  let activeCat  = null;
  let activeSub  = null;
  let query      = '';
  let unsubP = null, unsubC = null;

  function init() {
    subCategories();
    subProducts();
    document.getElementById('searchInput')?.addEventListener('input', e => {
      query = e.target.value.trim();
      renderProducts();
    });
  }

  function subCategories() {
    if (unsubC) unsubC();
    unsubC = db.collection(COLL.categories).orderBy('name').onSnapshot(snap => {
      categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderCategories();
    });
  }

  function subProducts() {
    if (unsubP) unsubP();
    unsubP = db.collection(COLL.products)
      .where('active','==',true).orderBy('name')
      .onSnapshot(snap => {
        products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderProducts();
      });
  }

  function renderCategories() {
    const list   = document.getElementById('categoryList');
    const mains  = categories.filter(c => !c.parentId);
    const subs   = categories.filter(c =>  c.parentId);

    let html = `<li><button class="category-btn ${!activeCat?'active':''}" data-cat="">
      🏠 Todos</button></li>`;

    mains.forEach(cat => {
      const children = subs.filter(s => s.parentId === cat.id);
      html += `<li>
        <button class="category-btn ${activeCat===cat.id?'active':''}" data-cat="${cat.id}">
          ${cat.emoji||'📦'} ${cat.name}</button>`;
      if (children.length) {
        html += `<ul class="subcategory-list">`;
        children.forEach(s => {
          html += `<li><button class="subcategory-btn ${activeSub===s.id?'active':''}"
            data-subcat="${s.id}" data-parent="${s.parentId}">
            ${s.emoji||'›'} ${s.name}</button></li>`;
        });
        html += `</ul>`;
      }
      html += `</li>`;
    });

    list.innerHTML = html;

    list.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCat = btn.dataset.cat || null;
        activeSub = null;
        const cat = categories.find(c => c.id === activeCat);
        document.getElementById('currentCategoryTitle').textContent =
          cat ? cat.name : 'Todos los productos';
        renderCategories(); renderProducts();
      });
    });
    list.querySelectorAll('.subcategory-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCat = btn.dataset.parent || null;
        activeSub = btn.dataset.subcat || null;
        const sub = categories.find(c => c.id === activeSub);
        document.getElementById('currentCategoryTitle').textContent = sub ? sub.name : 'Productos';
        renderCategories(); renderProducts();
      });
    });
  }

  function renderProducts() {
    const grid = document.getElementById('productsGrid');
    // Remove skeleton
    document.getElementById('productsLoading')?.remove();

    let list = products;
    if (activeSub) {
      list = list.filter(p => p.subcategoryId === activeSub);
    } else if (activeCat) {
      const childIds = categories.filter(c => c.parentId === activeCat).map(c => c.id);
      list = list.filter(p => p.categoryId === activeCat || childIds.includes(p.subcategoryId));
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q));
    }

    if (!list.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🔍</div><p>No se encontraron productos</p></div>`;
      return;
    }

    grid.innerHTML = list.map(buildCard).join('');

    grid.querySelectorAll('.product-add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = products.find(x => x.id === btn.dataset.id);
        if (p) Cart.addItem(p);
      });
    });
    grid.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = products.find(x => x.id === btn.dataset.id);
        if (btn.dataset.action === 'add' && p) Cart.addItem(p);
        else Cart.removeOne(btn.dataset.id);
      });
    });
  }

  function buildCard(p) {
    const qty = Cart.getQty(p.id);
    const img = p.imageUrl
      ? `<img src="${p.imageUrl}" alt="${p.name}" loading="lazy"/>`
      : `<span>${p.emoji||'🛍️'}</span>`;
    const control = qty > 0
      ? `<div class="product-qty-control">
          <button class="qty-btn" data-id="${p.id}" data-action="remove">−</button>
          <span class="qty-value">${qty}</span>
          <button class="qty-btn" data-id="${p.id}" data-action="add">+</button>
        </div>`
      : `<button class="product-add-btn" data-id="${p.id}" aria-label="Agregar ${p.name}">+</button>`;

    const stockBadge = (p.stock !== null && p.stock !== undefined && p.stock <= 5 && p.stock > 0)
      ? `<span class="stock-badge low">Últimos ${p.stock}</span>` : '';

    return `<div class="product-card" data-id="${p.id}">
      <div class="product-img-wrap">${img}</div>
      ${stockBadge}
      <div class="product-info">
        <p class="product-name">${p.name}</p>
        ${p.description ? `<p class="product-desc">${p.description}</p>` : ''}
      </div>
      <div class="product-footer">
        <span class="product-price">${APP_CONFIG.currency} ${Number(p.price).toFixed(2)}</span>
        ${control}
      </div>
    </div>`;
  }

  // Called by Cart to refresh qty controls without full re-subscribe
  function refreshCards() { renderProducts(); }

  return { init, refreshCards, get categories() { return categories; } };
})();
