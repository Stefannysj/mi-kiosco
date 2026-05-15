// ===== js/admin.js =====
// Panel admin — Productos, Categorías (2 botones), Caja, Horario, Personal, Apariencia

const Admin = (() => {
  let products = [];
  let categories = [];
  let unsubProds = null;
  let unsubCats = null;
  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;
    subscribeAll();
    bindSideNav();
    bindProductModal();
    bindCategoryModal();
    bindCajaSection();
    bindHorarioSection();
    bindPersonalSection();
    bindAparienciaSection();
  }

  // ── Subscriptions ──────────────────────────────────────────────────────────
  function subscribeAll() {
    unsubCats = db.collection(COLL.categories).orderBy('name').onSnapshot(snap => {
      categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderCategoriesManager();
      populateCategorySelect();
    });
    unsubProds = db.collection(COLL.products).orderBy('name').onSnapshot(snap => {
      products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAdminProducts();
    });
  }

  // ── Nav ────────────────────────────────────────────────────────────────────
  function bindSideNav() {
    document.querySelectorAll('.admin-nav-btn[data-section]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const s = btn.dataset.section;
        document.querySelectorAll('.admin-section').forEach(el => el.classList.remove('active'));
        document.getElementById('section' + capitalize(s))?.classList.add('active');
        if (s === 'dashboard') Dashboard.refresh();
        if (s === 'orders') Orders.init();
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PRODUCTOS
  // ══════════════════════════════════════════════════════════════════════════
  function renderAdminProducts() {
    const grid = document.getElementById('adminProductsGrid');
    if (!grid) return;
    if (!products.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📦</div><p>No hay productos aún</p></div>`;
      return;
    }
    grid.innerHTML = products.map(p => `
      <div class="admin-product-card ${p.active ? '' : 'admin-product-inactive'}">
        <div class="admin-product-img">
          ${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" loading="lazy"/>` : `<span style="font-size:3rem">${p.emoji || '🛍️'}</span>`}
          ${p.featured ? '<span class="featured-badge">⭐</span>' : ''}
        </div>
        <div class="admin-product-info">
          <p class="admin-product-name">${esc(p.name)}</p>
          <p class="admin-product-price">${APP_CONFIG.currency} ${Number(p.price).toFixed(2)}</p>
          <p style="font-size:.73rem;color:var(--text-3)">${p.active ? '✅ Visible' : '❌ Oculto'} · ${p.stock != null ? 'Stock: ' + p.stock : 'Sin límite'}</p>
        </div>
        <div class="admin-product-actions">
          <button class="btn-outline btn-sm" data-edit="${p.id}">✏️ Editar</button>
          <button class="btn-danger btn-sm" data-del="${p.id}">🗑️</button>
        </div>
      </div>`).join('');

    grid.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openProductModal(btn.dataset.edit)));
    grid.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => deleteProduct(btn.dataset.del)));
  }

  function bindProductModal() {
    document.getElementById('addProductBtn')?.addEventListener('click', () => openProductModal(null));
    document.getElementById('closeProductModal')?.addEventListener('click', closeProductModal);
    document.getElementById('cancelProductBtn')?.addEventListener('click', closeProductModal);
    document.getElementById('productModal')?.addEventListener('click', e => { if (e.target.id === 'productModal') closeProductModal(); });
    document.getElementById('productCategory')?.addEventListener('change', e => fillSubcatSelect(e.target.value, null));
    let imgTimer;
    document.getElementById('productImage')?.addEventListener('input', () => { clearTimeout(imgTimer); imgTimer = setTimeout(updateImgPreview, 600); });
    document.getElementById('productForm')?.addEventListener('submit', saveProduct);
  }

  function openProductModal(id) {
    document.getElementById('productForm')?.reset();
    document.getElementById('productId').value = '';
    document.getElementById('productActive').checked = true;
    hideImgPreview();
    populateCategorySelect();
    fillSubcatSelect(null, null);
    document.getElementById('productModalTitle').textContent = id ? 'Editar Producto' : 'Nuevo Producto';

    if (id) {
      const p = products.find(x => x.id === id);
      if (!p) return;
      document.getElementById('productId').value = p.id;
      document.getElementById('productName').value = p.name || '';
      document.getElementById('productDesc').value = p.description || '';
      document.getElementById('productPrice').value = p.price ?? '';
      document.getElementById('productStock').value = p.stock ?? '';
      document.getElementById('productImage').value = p.imageUrl || '';
      document.getElementById('productActive').checked = !!p.active;
      document.getElementById('productCategory').value = p.categoryId || '';
      fillSubcatSelect(p.categoryId, p.subcategoryId);
      if (p.imageUrl) showImgPreview(p.imageUrl);
    }
    openModal(document.getElementById('productModal'));
  }

  function closeProductModal() { closeModal(document.getElementById('productModal')); hideImgPreview(); }

  async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('productId').value;
    const price = parseFloat(document.getElementById('productPrice').value);
    if (isNaN(price) || price < 0) { showToast('Precio inválido', 'error'); return; }
    const stockRaw = document.getElementById('productStock').value;
    const data = {
      name: document.getElementById('productName').value.trim(),
      description: document.getElementById('productDesc').value.trim(),
      price, stock: stockRaw !== '' ? parseInt(stockRaw, 10) : null,
      categoryId: document.getElementById('productCategory').value || null,
      subcategoryId: document.getElementById('productSubcategory').value || null,
      imageUrl: document.getElementById('productImage').value.trim() || null,
      active: document.getElementById('productActive').checked,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const btn = document.querySelector('#productForm button[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
    try {
      if (id) { await db.collection(COLL.products).doc(id).update(data); showToast('Producto actualizado ✅', 'success'); }
      else { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection(COLL.products).add(data); showToast('Producto creado ✅', 'success'); }
      closeProductModal();
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Guardar Producto'; } }
  }

  async function deleteProduct(id) {
    const p = products.find(x => x.id === id);
    if (!confirm(`¿Eliminar "${p?.name || 'este producto'}"?`)) return;
    try { await db.collection(COLL.products).doc(id).delete(); showToast('Producto eliminado', 'info'); }
    catch (e) { showToast('Error: ' + e.message, 'error'); }
  }

  function getOrCreatePreview() {
    let el = document.getElementById('productImgPreview');
    if (!el) { el = document.createElement('img'); el.id = 'productImgPreview'; el.className = 'img-preview'; el.alt = 'Vista previa'; document.getElementById('productImage')?.insertAdjacentElement('afterend', el); }
    return el;
  }
  function showImgPreview(url) { const el = getOrCreatePreview(); el.src = url; el.classList.add('visible'); el.onerror = () => el.classList.remove('visible'); }
  function hideImgPreview() { document.getElementById('productImgPreview')?.classList.remove('visible'); }
  function updateImgPreview() { const url = document.getElementById('productImage')?.value.trim(); url ? showImgPreview(url) : hideImgPreview(); }

  // ══════════════════════════════════════════════════════════════════════════
  //  CATEGORÍAS — 2 botones separados
  // ══════════════════════════════════════════════════════════════════════════
  function renderCategoriesManager() {
    const container = document.getElementById('categoriesManager');
    if (!container) return;
    const mainCats = categories.filter(c => !c.parentId);
    const subCats = categories.filter(c => c.parentId);

    if (!mainCats.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div><p>No hay categorías aún. Crea la primera.</p></div>`;
      return;
    }

    let html = '';
    mainCats.forEach(cat => {
      const subs = subCats.filter(s => s.parentId === cat.id);
      html += `
        <div class="category-item">
          <span style="font-size:1.4rem">${cat.emoji || '📦'}</span>
          <span class="category-item-name">${esc(cat.name)}</span>
          <span style="font-size:.73rem;color:var(--text-3);flex-shrink:0">${subs.length} subcat.</span>
          <button class="btn-outline btn-sm" data-edit-cat="${cat.id}">✏️</button>
          <button class="btn-danger btn-sm"  data-del-cat="${cat.id}">🗑️</button>
        </div>
        ${subs.map(sub => `
          <div class="subcategory-item">
            <span>${sub.emoji || '›'}</span>
            <span class="item-name">${esc(sub.name)}</span>
            <button class="btn-outline btn-sm" data-edit-cat="${sub.id}">✏️</button>
            <button class="btn-danger btn-sm"  data-del-cat="${sub.id}">🗑️</button>
          </div>`).join('')}`;
    });

    container.innerHTML = html;
    container.querySelectorAll('[data-edit-cat]').forEach(btn => btn.addEventListener('click', () => openCategoryModal(btn.dataset.editCat)));
    container.querySelectorAll('[data-del-cat]').forEach(btn => btn.addEventListener('click', () => deleteCategory(btn.dataset.delCat)));
  }

  function bindCategoryModal() {
    // Botón nueva CATEGORÍA principal
    document.getElementById('addCategoryBtn')?.addEventListener('click', () => openCategoryModal(null, false));
    // Botón nueva SUBCATEGORÍA
    document.getElementById('addSubcategoryBtn')?.addEventListener('click', () => openCategoryModal(null, true));
    document.getElementById('closeCategoryModal')?.addEventListener('click', closeCategoryModal);
    document.getElementById('cancelCategoryBtn')?.addEventListener('click', closeCategoryModal);
    document.getElementById('categoryModal')?.addEventListener('click', e => { if (e.target.id === 'categoryModal') closeCategoryModal(); });
    document.getElementById('categoryForm')?.addEventListener('submit', saveCategory);
  }

  function openCategoryModal(id, forceSubcat = false) {
    document.getElementById('categoryForm')?.reset();
    document.getElementById('categoryId').value = '';
    populateParentSelect(null);

    if (id) {
      const cat = categories.find(c => c.id === id);
      if (!cat) return;
      document.getElementById('categoryModalTitle').textContent = cat.parentId ? 'Editar Subcategoría' : 'Editar Categoría';
      document.getElementById('categoryId').value = cat.id;
      document.getElementById('categoryName').value = cat.name || '';
      document.getElementById('categoryEmoji').value = cat.emoji || '';
      setTimeout(() => { document.getElementById('categoryParent').value = cat.parentId || ''; }, 30);
    } else {
      document.getElementById('categoryModalTitle').textContent = forceSubcat ? 'Nueva Subcategoría' : 'Nueva Categoría';
      // Si es subcategoría, seleccionar primer padre disponible
      if (forceSubcat) {
        const mainCats = categories.filter(c => !c.parentId);
        if (mainCats.length) setTimeout(() => { document.getElementById('categoryParent').value = mainCats[0].id; }, 30);
      }
    }
    openModal(document.getElementById('categoryModal'));
  }

  function closeCategoryModal() { closeModal(document.getElementById('categoryModal')); }

  async function saveCategory(e) {
    e.preventDefault();
    const id = document.getElementById('categoryId').value;
    const data = {
      name: document.getElementById('categoryName').value.trim(),
      emoji: document.getElementById('categoryEmoji').value.trim() || null,
      parentId: document.getElementById('categoryParent').value || null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!data.name) { showToast('El nombre es obligatorio', 'error'); return; }
    if (id && data.parentId === id) { showToast('No puede ser subcategoría de sí misma', 'error'); return; }
    try {
      if (id) { await db.collection(COLL.categories).doc(id).update(data); showToast('Categoría actualizada ✅', 'success'); }
      else { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection(COLL.categories).add(data); showToast((data.parentId ? 'Subcategoría' : 'Categoría') + ' creada ✅', 'success'); }
      closeCategoryModal();
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  async function deleteCategory(id) {
    const cat = categories.find(c => c.id === id);
    const subs = categories.filter(c => c.parentId === id);
    let msg = `¿Eliminar "${cat?.name || 'categoría'}"?`;
    if (subs.length) msg += `\nTambién se eliminarán sus ${subs.length} subcategoría(s).`;
    if (!confirm(msg)) return;
    const batch = db.batch();
    batch.delete(db.collection(COLL.categories).doc(id));
    subs.forEach(s => batch.delete(db.collection(COLL.categories).doc(s.id)));
    try { await batch.commit(); showToast('Categoría eliminada', 'info'); }
    catch (e) { showToast('Error: ' + e.message, 'error'); }
  }

  // ── Selects ────────────────────────────────────────────────────────────────
  function populateCategorySelect() {
    const sel = document.getElementById('productCategory');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Sin categoría</option>' +
      categories.filter(c => !c.parentId).map(c => `<option value="${c.id}">${c.emoji || ''} ${esc(c.name)}</option>`).join('');
    if (cur) sel.value = cur;
  }

  function fillSubcatSelect(parentId, selectedId) {
    const sel = document.getElementById('productSubcategory');
    if (!sel) return;
    const subs = parentId ? categories.filter(c => c.parentId === parentId) : [];
    sel.innerHTML = '<option value="">Sin subcategoría</option>' +
      subs.map(c => `<option value="${c.id}"${c.id === selectedId ? ' selected' : ''}>${c.emoji || ''} ${esc(c.name)}</option>`).join('');
  }

  function populateParentSelect(excludeId) {
    const sel = document.getElementById('categoryParent');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Categoría principal (sin padre) —</option>' +
      categories.filter(c => !c.parentId && c.id !== excludeId).map(c => `<option value="${c.id}">${c.emoji || ''} ${esc(c.name)}</option>`).join('');
    if (cur) sel.value = cur;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CAJA DIARIA
  // ══════════════════════════════════════════════════════════════════════════
  function bindCajaSection() {
    const KEY = 'kiosco_caja_' + new Date().toISOString().slice(0, 10);

    function getState() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
    function setState(d) { localStorage.setItem(KEY, JSON.stringify(d)); }

    function render() {
      const container = document.getElementById('cajaContainer');
      if (!container) return;
      const state = getState();
      const isOpen = state?.status === 'open';

      container.innerHTML = `
        <div class="caja-card">
          <div class="caja-header">
            <h3>🏦 Caja del día — ${new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            <span class="caja-status ${isOpen ? 'open' : 'closed'}">
              <span class="caja-dot"></span> ${isOpen ? 'Abierta' : 'Cerrada'}
            </span>
          </div>

          <div class="caja-stats">
            <div class="caja-stat">
              <div class="caja-stat-val">${APP_CONFIG.currency} ${(state?.initialAmount || 0).toFixed(2)}</div>
              <div class="caja-stat-label">Monto apertura</div>
            </div>
            <div class="caja-stat">
              <div class="caja-stat-val" id="cajaSalesVal">${APP_CONFIG.currency} 0.00</div>
              <div class="caja-stat-label">Ventas del día</div>
            </div>
            <div class="caja-stat">
              <div class="caja-stat-val" id="cajaTotalVal">${APP_CONFIG.currency} ${(state?.initialAmount || 0).toFixed(2)}</div>
              <div class="caja-stat-label">Total en caja</div>
            </div>
          </div>

          ${isOpen ? `
            <div class="caja-close-form">
              <p style="font-size:.82rem;color:var(--text-2);margin-bottom:.5rem">Apertura: ${state?.openedAt ? new Date(state.openedAt).toLocaleTimeString('es-PE') : ''}</p>
              <div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:center">
                <input type="number" id="cajaFinalAmount" class="input-field" placeholder="Monto final contado" style="flex:1;min-width:160px" />
                <button class="btn-danger" id="closeCajaBtn">🔒 Cerrar caja</button>
              </div>
            </div>` : `
            <div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:center">
              <input type="number" id="cajaInitAmount" class="input-field" placeholder="Monto inicial de apertura (S/)" style="flex:1;min-width:160px" />
              <button class="btn-success" id="openCajaBtn">✅ Abrir caja</button>
            </div>`}

          ${state?.closedAt ? `
            <div style="margin-top:1rem;padding:.75rem;background:var(--bg-3);border-radius:var(--radius-sm);font-size:.83rem">
              <p>🔒 Cerrada a las ${new Date(state.closedAt).toLocaleTimeString('es-PE')}</p>
              <p>Monto final: <strong>${APP_CONFIG.currency} ${(state.finalAmount || 0).toFixed(2)}</strong></p>
            </div>` : ''}
        </div>`;

      // Load today revenue
      db.collection(COLL.orders)
        .where('status', 'in', ['done', 'pending'])
        .orderBy('createdAt', 'desc').limit(200)
        .get().then(snap => {
          const today = new Date(); today.setHours(0, 0, 0, 0);
          let revenue = 0;
          snap.docs.forEach(d => {
            const o = d.data();
            const t = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
            if (t >= today && o.status !== 'rejected') revenue += (o.total || 0);
          });
          document.getElementById('cajaSalesVal').textContent = `${APP_CONFIG.currency} ${revenue.toFixed(2)}`;
          document.getElementById('cajaTotalVal').textContent = `${APP_CONFIG.currency} ${((state?.initialAmount || 0) + revenue).toFixed(2)}`;
        }).catch(() => { });

      document.getElementById('openCajaBtn')?.addEventListener('click', () => {
        const amount = parseFloat(document.getElementById('cajaInitAmount')?.value) || 0;
        setState({ status: 'open', openedAt: new Date().toISOString(), initialAmount: amount });
        showToast('Caja abierta ✅', 'success'); render();
      });
      document.getElementById('closeCajaBtn')?.addEventListener('click', () => {
        const final = parseFloat(document.getElementById('cajaFinalAmount')?.value) || 0;
        setState({ ...getState(), status: 'closed', closedAt: new Date().toISOString(), finalAmount: final });
        showToast('Caja cerrada 🔒', 'info'); render();
      });
    }

    // Render when section is active
    document.querySelector('[data-section="cashregister"]')?.addEventListener('click', render);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  HORARIO DE ATENCIÓN
  // ══════════════════════════════════════════════════════════════════════════
  function bindHorarioSection() {
    const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    async function renderHorario() {
      const container = document.getElementById('horarioContainer');
      if (!container) return;

      let schedule = [];
      try {
        const doc = await db.collection(COLL.config).doc('settings').get();
        schedule = doc.exists ? (doc.data().schedule || []) : [];
      } catch { }

      const defaultDay = { open: true, from: '08:00', to: '20:00' };
      const sch = DAYS.map((_, i) => schedule[i] || { ...defaultDay });

      container.innerHTML = `
        <div class="settings-card">
          <h3 class="settings-card-title">🕐 Horario de atención</h3>
          <p style="font-size:.82rem;color:var(--text-2);margin-bottom:1rem">Configura los días y horarios en que tu tienda estará abierta.</p>
          <div class="schedule-table">
            ${DAYS.map((day, i) => `
              <div class="schedule-row">
                <label class="schedule-day-label">
                  <input type="checkbox" class="day-check" id="dayOpen${i}" ${sch[i].open ? 'checked' : ''} />
                  <span>${day}</span>
                </label>
                <div class="schedule-times ${!sch[i].open ? 'disabled' : ''}">
                  <input type="time" class="input-field schedule-time" id="dayFrom${i}" value="${sch[i].from}" ${!sch[i].open ? 'disabled' : ''} />
                  <span style="color:var(--text-3)">hasta</span>
                  <input type="time" class="input-field schedule-time" id="dayTo${i}" value="${sch[i].to}" ${!sch[i].open ? 'disabled' : ''} />
                </div>
              </div>`).join('')}
          </div>
          <button class="btn-primary" id="saveScheduleBtn" style="margin-top:1.25rem">💾 Guardar horario</button>
        </div>`;

      DAYS.forEach((_, i) => {
        document.getElementById(`dayOpen${i}`)?.addEventListener('change', e => {
          const wrap = document.querySelector(`#dayFrom${i}`).closest('.schedule-times');
          document.getElementById(`dayFrom${i}`).disabled = !e.target.checked;
          document.getElementById(`dayTo${i}`).disabled = !e.target.checked;
          wrap.classList.toggle('disabled', !e.target.checked);
        });
      });

      document.getElementById('saveScheduleBtn')?.addEventListener('click', async () => {
        const newSch = DAYS.map((_, i) => ({
          open: document.getElementById(`dayOpen${i}`)?.checked || false,
          from: document.getElementById(`dayFrom${i}`)?.value || '08:00',
          to: document.getElementById(`dayTo${i}`)?.value || '20:00'
        }));
        try {
          await db.collection(COLL.config).doc('settings').set({ schedule: newSch }, { merge: true });
          showToast('Horario guardado ✅', 'success');
        } catch (e) { showToast('Error: ' + e.message, 'error'); }
      });
    }

    document.querySelector('[data-section="schedule"]')?.addEventListener('click', renderHorario);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PERSONAL Y ROLES
  // ══════════════════════════════════════════════════════════════════════════
  function bindPersonalSection() {
    async function renderPersonal() {
      const container = document.getElementById('personalContainer');
      if (!container) return;

      let members = [];
      try {
        const doc = await db.collection(COLL.config).doc('staff').get();
        members = doc.exists ? (doc.data().members || []) : [];
      } catch { }

      const renderList = () => {
        container.innerHTML = `
          <div class="settings-card">
            <h3 class="settings-card-title">👥 Personal y roles</h3>
            <p style="font-size:.82rem;color:var(--text-2);margin-bottom:1rem">Agrega empleados que pueden acceder al panel con permisos limitados.</p>

            <div class="staff-list" id="staffListRender">
              ${members.length ? members.map((m, i) => `
                <div class="staff-item">
                  <div class="staff-avatar">${(m.name || '?')[0].toUpperCase()}</div>
                  <div class="staff-info">
                    <p class="staff-name">${esc(m.name || 'Sin nombre')}</p>
                    <p class="staff-phone">${esc(m.phone)}</p>
                  </div>
                  <span class="role-badge ${m.role}">${m.role === 'admin' ? '👑 Admin' : '🧑‍💼 Empleado'}</span>
                  <button class="btn-danger btn-sm" data-remove-staff="${i}">✕</button>
                </div>`).join('') :
            `<p style="color:var(--text-3);font-size:.88rem;padding:.75rem 0">Sin personal registrado aún.</p>`}
            </div>

            <div class="staff-add-form">
              <h4 style="font-size:.88rem;font-weight:700;margin-bottom:.75rem">+ Agregar persona</h4>
              <div class="staff-form-grid">
                <input type="text"  id="newStaffName"  class="input-field" placeholder="Nombre completo" />
                <input type="tel"   id="newStaffPhone" class="input-field" placeholder="+51XXXXXXXXX" />
                <select id="newStaffRole" class="input-field">
                  <option value="employee">Empleado</option>
                  <option value="admin">Admin</option>
                </select>
                <button class="btn-primary" id="addStaffBtn">+ Agregar</button>
              </div>
            </div>
          </div>`;

        container.querySelectorAll('[data-remove-staff]').forEach(btn => {
          btn.addEventListener('click', async () => {
            members.splice(parseInt(btn.dataset.removeStaff), 1);
            await saveMemebers(members);
            renderList();
          });
        });

        document.getElementById('addStaffBtn')?.addEventListener('click', async () => {
          const name = document.getElementById('newStaffName').value.trim();
          const phone = document.getElementById('newStaffPhone').value.trim();
          const role = document.getElementById('newStaffRole').value;
          if (!phone) { showToast('El teléfono es obligatorio', 'error'); return; }
          members.push({ name, phone, role });
          await saveMemebers(members);
          renderList();
          showToast('Personal agregado ✅', 'success');
        });
      };

      renderList();
    }

    async function saveMemebers(members) {
      try { await db.collection(COLL.config).doc('staff').set({ members }, { merge: true }); }
      catch (e) { showToast('Error: ' + e.message, 'error'); }
    }

    document.querySelector('[data-section="staff"]')?.addEventListener('click', renderPersonal);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  APARIENCIA
  // ══════════════════════════════════════════════════════════════════════════
  function bindAparienciaSection() {
    const COLORS = [
      { name: 'Naranja', value: '#f97316' },
      { name: 'Azul', value: '#3b82f6' },
      { name: 'Verde', value: '#22c55e' },
      { name: 'Morado', value: '#a855f7' },
      { name: 'Rosa', value: '#ec4899' },
      { name: 'Rojo', value: '#ef4444' },
      { name: 'Turquesa', value: '#06b6d4' },
      { name: 'Dorado', value: '#eab308' },
    ];

    async function renderApariencia() {
      const container = document.getElementById('aparienciaContainer');
      if (!container) return;

      let theme = {};
      try {
        const doc = await db.collection(COLL.config).doc('theme').get();
        theme = doc.exists ? doc.data() : {};
      } catch { }

      container.innerHTML = `
        <div class="settings-card">
          <h3 class="settings-card-title">🎨 Personalización de la tienda</h3>

          <!-- Nombre -->
          <div class="appearance-section">
            <label class="appearance-label">📝 Nombre de la tienda</label>
            <div class="appearance-row">
              <input type="text" id="storeNameInput" class="input-field" value="${esc(theme.storeName || APP_CONFIG.storeName || '')}" placeholder="Mi Kiosco" />
              <button class="btn-primary btn-sm" id="saveStoreNameBtn">Guardar</button>
            </div>
          </div>

          <!-- Logo -->
          <div class="appearance-section">
            <label class="appearance-label">🖼️ Logo (URL de imagen)</label>
            <div class="appearance-row">
              <input type="url" id="storeLogoInput" class="input-field" value="${esc(theme.storeLogo || '')}" placeholder="https://..." />
              <button class="btn-primary btn-sm" id="saveLogoBtn">Aplicar</button>
            </div>
            ${theme.storeLogo ? `<img src="${esc(theme.storeLogo)}" style="width:60px;height:60px;border-radius:var(--radius-sm);object-fit:cover;margin-top:.5rem" />` : ''}
          </div>

          <!-- Colores -->
          <div class="appearance-section">
            <label class="appearance-label">🎨 Color principal</label>
            <div class="color-grid">
              ${COLORS.map(c => `
                <button class="color-swatch ${theme.accentColor === c.value ? 'active' : ''}"
                  style="background:${c.value}" title="${c.name}" data-color="${c.value}"></button>`).join('')}
              <input type="color" id="customColorPicker" value="${theme.accentColor || '#f97316'}"
                title="Color personalizado" style="width:40px;height:40px;border-radius:50%;border:3px solid var(--border);cursor:pointer;padding:0" />
            </div>
          </div>

          <!-- Yape / Plin -->
          <div class="appearance-section">
            <label class="appearance-label">💳 Métodos de pago (Yape / Plin)</label>
            <div class="payment-config-grid">
              <div class="payment-config-col">
                <p style="font-size:.8rem;font-weight:700;color:#7c3aed;margin-bottom:.5rem">💜 Yape</p>
                <input type="tel" id="yapeNumber" class="input-field" placeholder="+51 9XX XXX XXX" value="${esc(theme.yapeNumber || '')}" style="margin-bottom:.4rem" />
                <input type="url" id="yapeQR"     class="input-field" placeholder="URL imagen QR" value="${esc(theme.yapeQR || '')}" />
              </div>
              <div class="payment-config-col">
                <p style="font-size:.8rem;font-weight:700;color:#059669;margin-bottom:.5rem">💚 Plin</p>
                <input type="tel" id="plinNumber" class="input-field" placeholder="+51 9XX XXX XXX" value="${esc(theme.plinNumber || '')}" style="margin-bottom:.4rem" />
                <input type="url" id="plinQR"     class="input-field" placeholder="URL imagen QR" value="${esc(theme.plinQR || '')}" />
              </div>
            </div>
            <button class="btn-primary btn-sm" id="savePaymentBtn" style="margin-top:.75rem">💾 Guardar pagos</button>
          </div>
        </div>`;

      // Name
      document.getElementById('saveStoreNameBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('storeNameInput').value.trim();
        if (!name) return;
        await saveTheme({ storeName: name });
        document.querySelector('.logo-text') && (document.querySelector('.logo-text').textContent = name);
        APP_CONFIG.storeName = name; document.title = name;
        showToast('Nombre actualizado ✅', 'success');
      });

      // Logo
      document.getElementById('saveLogoBtn')?.addEventListener('click', async () => {
        const url = document.getElementById('storeLogoInput').value.trim();
        if (!url) return;
        await saveTheme({ storeLogo: url });
        showToast('Logo actualizado ✅', 'success');
        renderApariencia();
      });

      // Colors
      container.querySelectorAll('.color-swatch').forEach(sw => {
        sw.addEventListener('click', async () => {
          container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
          sw.classList.add('active');
          applyAccentColor(sw.dataset.color);
          await saveTheme({ accentColor: sw.dataset.color });
          showToast('Color aplicado ✅', 'success');
        });
      });
      document.getElementById('customColorPicker')?.addEventListener('input', async e => {
        applyAccentColor(e.target.value);
        await saveTheme({ accentColor: e.target.value });
      });

      // Payments
      document.getElementById('savePaymentBtn')?.addEventListener('click', async () => {
        await saveTheme({
          yapeNumber: document.getElementById('yapeNumber').value.trim(),
          yapeQR: document.getElementById('yapeQR').value.trim(),
          plinNumber: document.getElementById('plinNumber').value.trim(),
          plinQR: document.getElementById('plinQR').value.trim()
        });
        showToast('Datos de pago guardados ✅', 'success');
      });
    }

    async function saveTheme(data) {
      try { await db.collection(COLL.config).doc('theme').set(data, { merge: true }); }
      catch (e) { showToast('Error: ' + e.message, 'error'); }
    }

    function applyAccentColor(color) {
      document.documentElement.style.setProperty('--accent', color);
      const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
      document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},.25)`);
    }

    document.querySelector('[data-section="branding"]')?.addEventListener('click', renderApariencia);
  }

  // ── Utilities ──────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  return { init };
})();
