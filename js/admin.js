// ===== js/admin.js =====
// Panel de administración — CRUD productos, categorías y subcategorías

const Admin = (() => {
  let products    = [];
  let categories  = [];
  let unsubProds  = null;
  let unsubCats   = null;
  let initialized = false;

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    if (initialized) return;
    initialized = true;
    subscribeAll();
    bindSideNav();
    bindProductModal();
    bindCategoryModal();
  }

  // ── Real-time subscriptions ────────────────────────────────────────────────
  function subscribeAll() {
    unsubCats = db.collection(COLL.categories).orderBy('name')
      .onSnapshot(snap => {
        categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCategoriesManager();
        populateSelects();
      });

    unsubProds = db.collection(COLL.products).orderBy('name')
      .onSnapshot(snap => {
        products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAdminProducts();
      });
  }

  // ── Side navigation ────────────────────────────────────────────────────────
  function bindSideNav() {
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const s = btn.dataset.section;
        document.querySelectorAll('.admin-section').forEach(el => el.classList.remove('active'));
        document.getElementById('section' + capitalize(s))?.classList.add('active');
        if (s === 'dashboard') Dashboard.refresh();
        if (s === 'orders')    Orders.init();
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PRODUCTS
  // ═══════════════════════════════════════════════════════════════════════════

  function renderAdminProducts() {
    const grid = document.getElementById('adminProductsGrid');
    if (!grid) return;

    if (!products.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📦</div><p>No hay productos. Crea el primero.</p></div>';
      return;
    }

    grid.innerHTML = products.map(p => `
      <div class="admin-product-card ${p.active ? '' : 'admin-product-inactive'}">
        <div class="admin-product-img">
          ${p.imageUrl
            ? `<img src="${escHtml(p.imageUrl)}" alt="${escHtml(p.name)}" loading="lazy" />`
            : `<span style="font-size:3rem">${p.emoji || '🛍️'}</span>`}
        </div>
        <div class="admin-product-info">
          <p class="admin-product-name">${escHtml(p.name)}</p>
          <p class="admin-product-price">${APP_CONFIG.currency} ${Number(p.price).toFixed(2)}</p>
          <p style="font-size:.75rem;color:var(--text-3);margin-top:.2rem">
            ${p.active ? '✅ Visible' : '❌ Oculto'} ·
            ${p.stock != null ? 'Stock: ' + p.stock : 'Sin límite'}
          </p>
        </div>
        <div class="admin-product-actions">
          <button class="btn-outline btn-sm" data-edit="${p.id}">✏️ Editar</button>
          <button class="btn-danger btn-sm" data-del="${p.id}">🗑️</button>
        </div>
      </div>`).join('');

    grid.querySelectorAll('[data-edit]').forEach(btn =>
      btn.addEventListener('click', () => openProductModal(btn.dataset.edit)));
    grid.querySelectorAll('[data-del]').forEach(btn =>
      btn.addEventListener('click', () => deleteProduct(btn.dataset.del)));
  }

  // ── Product modal ──────────────────────────────────────────────────────────
  function bindProductModal() {
    const modal = document.getElementById('productModal');
    document.getElementById('addProductBtn')
      ?.addEventListener('click', () => openProductModal(null));
    document.getElementById('closeProductModal')
      ?.addEventListener('click', closeProductModal);
    document.getElementById('cancelProductBtn')
      ?.addEventListener('click', closeProductModal);
    modal?.addEventListener('click', e => { if (e.target === modal) closeProductModal(); });

    // Category → subcategory cascade
    document.getElementById('productCategory')
      ?.addEventListener('change', e => fillSubcategorySelect(e.target.value, null));

    // Image URL → live preview
    let previewTimer;
    document.getElementById('productImage')?.addEventListener('input', () => {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(updateImgPreview, 600);
    });

    document.getElementById('productForm')?.addEventListener('submit', saveProduct);
  }

  function openProductModal(id) {
    const modal = document.getElementById('productModal');
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('productActive').checked = true;
    hideImgPreview();
    populateSelects();
    fillSubcategorySelect(null, null);

    if (id) {
      const p = products.find(x => x.id === id);
      if (!p) return;
      document.getElementById('productModalTitle').textContent = 'Editar Producto';
      document.getElementById('productId').value       = p.id;
      document.getElementById('productName').value     = p.name        || '';
      document.getElementById('productDesc').value     = p.description || '';
      document.getElementById('productPrice').value    = p.price       ?? '';
      document.getElementById('productStock').value    = p.stock       ?? '';
      document.getElementById('productImage').value    = p.imageUrl    || '';
      document.getElementById('productActive').checked = !!p.active;
      document.getElementById('productCategory').value = p.categoryId  || '';
      fillSubcategorySelect(p.categoryId || null, p.subcategoryId || null);
      if (p.imageUrl) showImgPreview(p.imageUrl);
    } else {
      document.getElementById('productModalTitle').textContent = 'Nuevo Producto';
    }
    openModal(modal);
  }

  function closeProductModal() {
    closeModal(document.getElementById('productModal'));
    hideImgPreview();
  }

  async function saveProduct(e) {
    e.preventDefault();
    const id    = document.getElementById('productId').value;
    const price = parseFloat(document.getElementById('productPrice').value);
    if (isNaN(price) || price < 0) { showToast('Precio inválido', 'error'); return; }

    const stockRaw = document.getElementById('productStock').value;
    const data = {
      name:          document.getElementById('productName').value.trim(),
      description:   document.getElementById('productDesc').value.trim(),
      price,
      stock:         stockRaw !== '' ? parseInt(stockRaw, 10) : null,
      categoryId:    document.getElementById('productCategory').value    || null,
      subcategoryId: document.getElementById('productSubcategory').value || null,
      imageUrl:      document.getElementById('productImage').value.trim() || null,
      active:        document.getElementById('productActive').checked,
      updatedAt:     firebase.firestore.FieldValue.serverTimestamp()
    };

    const btn = document.querySelector('#productForm button[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

    try {
      if (id) {
        await db.collection(COLL.products).doc(id).update(data);
        showToast('Producto actualizado ✅', 'success');
      } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection(COLL.products).add(data);
        showToast('Producto creado ✅', 'success');
      }
      closeProductModal();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar Producto'; }
    }
  }

  async function deleteProduct(id) {
    const p = products.find(x => x.id === id);
    if (!confirm('¿Eliminar "' + (p?.name || 'este producto') + '"? No se puede deshacer.')) return;
    try {
      await db.collection(COLL.products).doc(id).delete();
      showToast('Producto eliminado', 'info');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  // ── Image preview ──────────────────────────────────────────────────────────
  function getOrCreatePreview() {
    let el = document.getElementById('productImgPreview');
    if (!el) {
      el = document.createElement('img');
      el.id = 'productImgPreview';
      el.className = 'img-preview';
      el.alt = 'Vista previa de imagen';
      document.getElementById('productImage')?.insertAdjacentElement('afterend', el);
    }
    return el;
  }
  function showImgPreview(url) {
    const el = getOrCreatePreview();
    el.src = url;
    el.classList.add('visible');
    el.onerror = () => el.classList.remove('visible');
  }
  function hideImgPreview() {
    const el = document.getElementById('productImgPreview');
    if (el) el.classList.remove('visible');
  }
  function updateImgPreview() {
    const url = document.getElementById('productImage')?.value.trim();
    url ? showImgPreview(url) : hideImgPreview();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CATEGORIES
  // ═══════════════════════════════════════════════════════════════════════════

  function renderCategoriesManager() {
    const container = document.getElementById('categoriesManager');
    if (!container) return;

    const mainCats = categories.filter(c => !c.parentId);
    const subCats  = categories.filter(c =>  c.parentId);

    if (!mainCats.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📂</div><p>No hay categorías aún.</p></div>';
      return;
    }

    let html = '';
    mainCats.forEach(cat => {
      const subs = subCats.filter(s => s.parentId === cat.id);
      html += `<div class="category-item">
        <span style="font-size:1.4rem">${cat.emoji || '📦'}</span>
        <span class="category-item-name">${escHtml(cat.name)}</span>
        <span style="font-size:.75rem;color:var(--text-3)">${subs.length ? subs.length + ' subcat.' : ''}</span>
        <button class="btn-outline btn-sm" data-edit-cat="${cat.id}">✏️</button>
        <button class="btn-danger btn-sm" data-del-cat="${cat.id}">🗑️</button>
      </div>`;
      subs.forEach(sub => {
        html += `<div class="subcategory-item">
          <span>${sub.emoji || '›'}</span>
          <span class="item-name">${escHtml(sub.name)}</span>
          <button class="btn-outline btn-sm" data-edit-cat="${sub.id}">✏️</button>
          <button class="btn-danger btn-sm" data-del-cat="${sub.id}">🗑️</button>
        </div>`;
      });
    });

    container.innerHTML = html;
    container.querySelectorAll('[data-edit-cat]').forEach(btn =>
      btn.addEventListener('click', () => openCategoryModal(btn.dataset.editCat)));
    container.querySelectorAll('[data-del-cat]').forEach(btn =>
      btn.addEventListener('click', () => deleteCategory(btn.dataset.delCat)));
  }

  function bindCategoryModal() {
    const modal = document.getElementById('categoryModal');
    document.getElementById('addCategoryBtn')
      ?.addEventListener('click', () => openCategoryModal(null));
    document.getElementById('closeCategoryModal')
      ?.addEventListener('click', closeCategoryModal);
    document.getElementById('cancelCategoryBtn')
      ?.addEventListener('click', closeCategoryModal);
    modal?.addEventListener('click', e => { if (e.target === modal) closeCategoryModal(); });
    document.getElementById('categoryForm')?.addEventListener('submit', saveCategory);
  }

  function openCategoryModal(id) {
    const modal = document.getElementById('categoryModal');
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryModalTitle').textContent = id ? 'Editar Categoría' : 'Nueva Categoría';
    populateParentSelect(id);

    if (id) {
      const cat = categories.find(c => c.id === id);
      if (!cat) return;
      document.getElementById('categoryId').value    = cat.id;
      document.getElementById('categoryName').value  = cat.name  || '';
      document.getElementById('categoryEmoji').value = cat.emoji || '';
      setTimeout(() => {
        document.getElementById('categoryParent').value = cat.parentId || '';
      }, 30);
    }
    openModal(modal);
  }

  function closeCategoryModal() {
    closeModal(document.getElementById('categoryModal'));
  }

  async function saveCategory(e) {
    e.preventDefault();
    const id = document.getElementById('categoryId').value;
    const data = {
      name:      document.getElementById('categoryName').value.trim(),
      emoji:     document.getElementById('categoryEmoji').value.trim() || null,
      parentId:  document.getElementById('categoryParent').value       || null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!data.name) { showToast('El nombre es obligatorio', 'error'); return; }
    if (id && data.parentId === id) { showToast('No puede ser subcategoría de sí misma', 'error'); return; }

    try {
      if (id) {
        await db.collection(COLL.categories).doc(id).update(data);
        showToast('Categoría actualizada ✅', 'success');
      } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection(COLL.categories).add(data);
        showToast('Categoría creada ✅', 'success');
      }
      closeCategoryModal();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  async function deleteCategory(id) {
    const cat  = categories.find(c => c.id === id);
    const subs = categories.filter(c => c.parentId === id);
    let msg = '¿Eliminar "' + (cat?.name || 'categoría') + '"?';
    if (subs.length) msg += '\nTambién se eliminarán sus ' + subs.length + ' subcategoría(s).';
    if (!confirm(msg)) return;

    const batch = db.batch();
    batch.delete(db.collection(COLL.categories).doc(id));
    subs.forEach(s => batch.delete(db.collection(COLL.categories).doc(s.id)));

    try {
      await batch.commit();
      showToast('Categoría eliminada', 'info');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  // ── Select helpers ─────────────────────────────────────────────────────────
  function populateSelects() {
    populateCategorySelect();
  }

  function populateCategorySelect() {
    const sel = document.getElementById('productCategory');
    if (!sel) return;
    const cur = sel.value;
    const mainCats = categories.filter(c => !c.parentId);
    sel.innerHTML = '<option value="">Sin categoría</option>' +
      mainCats.map(c => `<option value="${c.id}">${c.emoji || ''} ${escHtml(c.name)}</option>`).join('');
    if (cur) sel.value = cur;
  }

  function fillSubcategorySelect(parentId, selectedId) {
    const sel = document.getElementById('productSubcategory');
    if (!sel) return;
    const subs = parentId ? categories.filter(c => c.parentId === parentId) : [];
    sel.innerHTML = '<option value="">Sin subcategoría</option>' +
      subs.map(c =>
        `<option value="${c.id}"${c.id === selectedId ? ' selected' : ''}>${c.emoji || ''} ${escHtml(c.name)}</option>`
      ).join('');
  }

  function populateParentSelect(excludeId) {
    const sel = document.getElementById('categoryParent');
    if (!sel) return;
    const cur = sel.value;
    const mainCats = categories.filter(c => !c.parentId && c.id !== excludeId);
    sel.innerHTML = '<option value="">— Categoría principal (sin padre) —</option>' +
      mainCats.map(c => `<option value="${c.id}">${c.emoji || ''} ${escHtml(c.name)}</option>`).join('');
    if (cur) sel.value = cur;
  }

  // ── Utility ────────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
    );
  }

  return { init };
})();
