// ===== js/featured.js =====
// Mejora 3: Productos destacados | Mejora 5: Alertas de stock

const Featured = (() => {

  // ── Renderiza sección de destacados en la tienda ───────────────────────────
  function render(products) {
    const featured = products.filter(p => p.active && p.featured);
    const container = document.getElementById('featuredSection');
    if (!container) return;

    if (!featured.length) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    const grid = container.querySelector('#featuredGrid');
    if (!grid) return;

    grid.innerHTML = featured.map(p => buildFeaturedCard(p)).join('');

    grid.querySelectorAll('.product-add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        Cart.addItem(featured.find(p => p.id === id));
      });
    });
    grid.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const p = featured.find(x => x.id === id);
        if (btn.dataset.action === 'add') Cart.addItem(p);
        else Cart.removeOne(id);
      });
    });
  }

  function buildFeaturedCard(p) {
    const qty = Cart.getQty(p.id);
    const isLowStock = p.stock != null && p.stock <= 5;
    const imgHtml = p.imageUrl
      ? `<img src="${p.imageUrl}" alt="${p.name}" loading="lazy" />`
      : `<span style="font-size:3rem">${p.emoji || '🛍️'}</span>`;

    const addControl = qty > 0
      ? `<div class="product-qty-control">
          <button class="qty-btn" data-id="${p.id}" data-action="remove">−</button>
          <span class="qty-value">${qty}</span>
          <button class="qty-btn" data-id="${p.id}" data-action="add">+</button>
        </div>`
      : `<button class="product-add-btn" data-id="${p.id}">+</button>`;

    return `<div class="product-card featured" data-id="${p.id}">
      <div class="product-img-wrap">
        ${imgHtml}
        <span class="featured-badge">⭐ Destacado</span>
        ${isLowStock ? `<span class="low-stock-badge">¡Últimas ${p.stock}!</span>` : ''}
      </div>
      <div class="product-info">
        <p class="product-name">${p.name}</p>
        ${p.description ? `<p class="product-desc">${p.description}</p>` : ''}
      </div>
      <div class="product-footer">
        <span class="product-price">${APP_CONFIG.currency} ${Number(p.price).toFixed(2)}</span>
        ${addControl}
      </div>
    </div>`;
  }

  // ── Admin: toggle destacado en tarjeta de producto ─────────────────────────
  function addFeaturedToggle(productId, currentValue, onToggle) {
    const btn = document.createElement('button');
    btn.className = currentValue ? 'btn-outline btn-sm' : 'btn-outline btn-sm';
    btn.innerHTML = currentValue ? '⭐ Destacado' : '☆ Destacar';
    btn.style.color = currentValue ? '#f59e0b' : '';
    btn.title = 'Marcar como producto destacado';
    btn.addEventListener('click', async () => {
      try {
        await db.collection(COLL.products).doc(productId).update({ featured: !currentValue });
        showToast(currentValue ? 'Quitado de destacados' : '⭐ Marcado como destacado', 'info');
        if (onToggle) onToggle();
      } catch (e) {
        showToast('Error al actualizar', 'error');
      }
    });
    return btn;
  }

  // ── Stock: mostrar alerta cuando stock es bajo ─────────────────────────────
  function checkLowStock(products) {
    const low = products.filter(p => p.active && p.stock != null && p.stock <= 3);
    if (!low.length) return;
    const names = low.map(p => `${p.name} (${p.stock} restantes)`).join(', ');
    showToast(`⚠️ Stock bajo: ${names}`, 'error');
  }

  return { render, addFeaturedToggle, checkLowStock };
})();
