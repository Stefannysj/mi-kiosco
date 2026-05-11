// ===== js/settings.js =====
// Mejora 11: Factura/Boleta | Mejora 12: Horario | Mejora 13: Roles | Mejora 15: Tema

// ══════════════════════════════════════════════════════════════════════════════
//  INVOICE — Mejora 11
// ══════════════════════════════════════════════════════════════════════════════
const Invoice = (() => {

  function generate(order) {
    const date = order.createdAt?.toDate
      ? order.createdAt.toDate().toLocaleString('es-PE')
      : new Date().toLocaleString('es-PE');

    const rows = (order.items || []).map(i => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${i.name}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${i.qty}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">${APP_CONFIG.currency} ${Number(i.price).toFixed(2)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">${APP_CONFIG.currency} ${Number(i.subtotal || i.price * i.qty).toFixed(2)}</td>
      </tr>`).join('');

    const storeName = APP_CONFIG.storeName || 'Kiosco';
    const deliveryInfo = order.deliveryAddress
      ? `<p><strong>Dirección:</strong> ${order.deliveryAddress}</p>` : '';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Boleta ${order.id?.slice(-6).toUpperCase() || ''} · ${storeName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #222; max-width: 580px; margin: 32px auto; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #f97316; }
    .store-name { font-size: 1.6rem; font-weight: 900; color: #f97316; }
    .doc-info { text-align: right; }
    .doc-title { font-size: 1rem; font-weight: 700; color: #555; }
    .doc-number { font-size: 1.1rem; font-weight: 900; }
    .customer-section { background: #f9f9f9; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: .9rem; }
    .customer-section h3 { font-size: .8rem; text-transform: uppercase; color: #888; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f97316; color: #fff; padding: 8px; font-size: .82rem; text-align: left; }
    th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: center; }
    th:nth-child(4) { text-align: right; }
    .total-section { border-top: 2px solid #f97316; padding-top: 12px; text-align: right; }
    .total-row { display: flex; justify-content: flex-end; gap: 32px; margin-bottom: 6px; font-size: .9rem; }
    .total-final { font-size: 1.2rem; font-weight: 900; color: #f97316; }
    .footer { margin-top: 32px; text-align: center; color: #aaa; font-size: .78rem; }
    .status-pill { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: .75rem; font-weight: 700; }
    .status-done { background: #dcfce7; color: #16a34a; }
    .status-pending { background: #fef9c3; color: #ca8a04; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="store-name">🛍️ ${storeName}</div>
      <div style="font-size:.82rem;color:#888;margin-top:4px">${date}</div>
    </div>
    <div class="doc-info">
      <div class="doc-title">BOLETA DE VENTA</div>
      <div class="doc-number">#${order.id?.slice(-6).toUpperCase() || 'N/A'}</div>
      <span class="status-pill ${order.status === 'done' ? 'status-done' : 'status-pending'}">
        ${order.status === 'done' ? '✅ Completado' : '⏳ Pendiente'}
      </span>
    </div>
  </div>

  <div class="customer-section">
    <h3>Cliente</h3>
    <p><strong>${order.customer || 'Cliente'}</strong></p>
    ${order.customerPhone ? `<p>Tel: ${order.customerPhone}</p>` : ''}
    ${deliveryInfo}
  </div>

  <table>
    <thead>
      <tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Subtotal</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="total-section">
    <div class="total-row"><span>Subtotal</span><span>${APP_CONFIG.currency} ${(order.total||0).toFixed(2)}</span></div>
    <div class="total-row total-final"><span>TOTAL</span><span>${APP_CONFIG.currency} ${(order.total||0).toFixed(2)}</span></div>
  </div>

  <div class="footer">
    <p>Gracias por tu compra en ${storeName} 🎉</p>
    <p style="margin-top:4px">Generado el ${new Date().toLocaleString('es-PE')}</p>
  </div>

  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (!win) {
      const a = document.createElement('a');
      a.href = url; a.download = `boleta-${order.id?.slice(-6) || Date.now()}.html`; a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  return { generate };
})();

// ══════════════════════════════════════════════════════════════════════════════
//  SCHEDULE — Horario de atención (Mejora 12)
// ══════════════════════════════════════════════════════════════════════════════
const Schedule = (() => {
  const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  let schedule = null;

  async function load() {
    try {
      const doc = await db.collection(COLL.config).doc('settings').get();
      if (doc.exists) schedule = doc.data().schedule || null;
    } catch {}
    checkOpen();
  }

  function isStoreOpen() {
    if (!schedule) return true; // sin config = siempre abierto
    const now     = new Date();
    const dayIdx  = (now.getDay() + 6) % 7; // 0=Lun
    const dayConf = schedule[dayIdx];
    if (!dayConf?.open) return false;

    const [openH, openM]   = (dayConf.from || '00:00').split(':').map(Number);
    const [closeH, closeM] = (dayConf.to   || '23:59').split(':').map(Number);
    const nowMins  = now.getHours() * 60 + now.getMinutes();
    const openMins = openH * 60 + openM;
    const closeMins= closeH * 60 + closeM;
    return nowMins >= openMins && nowMins <= closeMins;
  }

  function checkOpen() {
    const banner = document.getElementById('storeClosedBanner');
    if (!banner) return;
    if (isStoreOpen()) {
      banner.style.display = 'none';
    } else {
      banner.style.display = '';
      banner.textContent = '🔒 La tienda está cerrada en este momento. ¡Vuelve pronto!';
    }
  }

  async function save(newSchedule) {
    await db.collection(COLL.config).doc('settings').set({ schedule: newSchedule }, { merge: true });
    schedule = newSchedule;
    showToast('Horario guardado ✅', 'success');
    checkOpen();
  }

  function renderAdminSchedule(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const defaultDay = { open: true, from: '08:00', to: '20:00' };
    const sch = schedule || DAYS.map(() => ({ ...defaultDay }));

    container.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:1.25rem;margin-bottom:1rem">
        <h4 style="font-size:.95rem;font-weight:700;margin-bottom:1rem">🕐 Horario de atención</h4>
        ${DAYS.map((day, i) => `
          <div class="schedule-grid">
            <span class="day-label">${day}</span>
            <input type="checkbox" class="day-toggle" id="dayOpen${i}" ${sch[i]?.open ? 'checked' : ''} />
            <input type="time" class="input-field btn-sm" id="dayFrom${i}" value="${sch[i]?.from || '08:00'}" ${!sch[i]?.open ? 'disabled' : ''} />
            <span style="color:var(--text-3)">a</span>
            <input type="time" class="input-field btn-sm" id="dayTo${i}" value="${sch[i]?.to || '20:00'}" ${!sch[i]?.open ? 'disabled' : ''} />
          </div>`).join('')}
        <button class="btn-primary btn-sm" style="margin-top:1rem" id="saveScheduleBtn">Guardar horario</button>
      </div>`;

    // Toggle disable on checkbox change
    DAYS.forEach((_, i) => {
      document.getElementById(`dayOpen${i}`)?.addEventListener('change', e => {
        document.getElementById(`dayFrom${i}`).disabled = !e.target.checked;
        document.getElementById(`dayTo${i}`).disabled   = !e.target.checked;
      });
    });

    document.getElementById('saveScheduleBtn')?.addEventListener('click', () => {
      const newSch = DAYS.map((_, i) => ({
        open: document.getElementById(`dayOpen${i}`)?.checked || false,
        from: document.getElementById(`dayFrom${i}`)?.value || '08:00',
        to:   document.getElementById(`dayTo${i}`)?.value   || '20:00'
      }));
      save(newSch);
    });
  }

  return { load, isStoreOpen, renderAdminSchedule };
})();

// ══════════════════════════════════════════════════════════════════════════════
//  ROLES — Mejora 13
// ══════════════════════════════════════════════════════════════════════════════
const Roles = (() => {
  let staffList = [];

  async function load() {
    try {
      const doc = await db.collection(COLL.config).doc('staff').get();
      if (doc.exists) staffList = doc.data().members || [];
    } catch {}
    return staffList;
  }

  async function save(members) {
    await db.collection(COLL.config).doc('staff').set({ members }, { merge: true });
    staffList = members;
    showToast('Personal actualizado ✅', 'success');
  }

  function isEmployee(phone) {
    return staffList.some(m => m.phone === phone && m.role === 'employee');
  }

  function renderAdminRoles(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const renderList = () => {
      container.innerHTML = `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:1.25rem;margin-bottom:1rem">
          <h4 style="font-size:.95rem;font-weight:700;margin-bottom:1rem">👥 Personal y roles</h4>
          <div id="staffList">
            ${staffList.length ? staffList.map((m, i) => `
              <div class="staff-item">
                <div class="staff-info">
                  <p class="staff-name">${m.name || 'Sin nombre'}</p>
                  <p class="staff-phone">${m.phone}</p>
                </div>
                <span class="role-badge ${m.role}">${m.role === 'admin' ? '👑 Admin' : '🧑‍💼 Empleado'}</span>
                <button class="btn-danger btn-sm" data-remove="${i}">✕</button>
              </div>`).join('') : '<p style="color:var(--text-3);font-size:.88rem">Sin personal registrado</p>'}
          </div>
          <div style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap">
            <input type="text" id="newStaffName" class="input-field" placeholder="Nombre" style="flex:1;min-width:120px" />
            <input type="tel" id="newStaffPhone" class="input-field" placeholder="+51XXXXXXXXX" style="flex:1;min-width:140px" />
            <select id="newStaffRole" class="input-field" style="flex-shrink:0">
              <option value="employee">Empleado</option>
              <option value="admin">Admin</option>
            </select>
            <button class="btn-primary btn-sm" id="addStaffBtn">+ Agregar</button>
          </div>
        </div>`;

      container.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
          staffList.splice(parseInt(btn.dataset.remove), 1);
          save([...staffList]).then(renderList);
        });
      });

      document.getElementById('addStaffBtn')?.addEventListener('click', () => {
        const name  = document.getElementById('newStaffName').value.trim();
        const phone = document.getElementById('newStaffPhone').value.trim();
        const role  = document.getElementById('newStaffRole').value;
        if (!phone) { showToast('El teléfono es obligatorio', 'error'); return; }
        staffList.push({ name, phone, role });
        save([...staffList]).then(renderList);
      });
    };

    load().then(renderList);
  }

  return { load, isEmployee, renderAdminRoles };
})();

// ══════════════════════════════════════════════════════════════════════════════
//  THEME CUSTOMIZER — Mejora 15
// ══════════════════════════════════════════════════════════════════════════════
const ThemeCustomizer = (() => {
  const COLORS = [
    { name: 'Naranja',   value: '#f97316' },
    { name: 'Azul',      value: '#3b82f6' },
    { name: 'Verde',     value: '#22c55e' },
    { name: 'Morado',    value: '#a855f7' },
    { name: 'Rosa',      value: '#ec4899' },
    { name: 'Rojo',      value: '#ef4444' },
    { name: 'Turquesa',  value: '#06b6d4' },
    { name: 'Amarillo',  value: '#eab308' },
  ];

  async function load() {
    try {
      const doc = await db.collection(COLL.config).doc('theme').get();
      if (doc.exists) {
        const { accentColor, storeName, storeLogo } = doc.data();
        if (accentColor) applyColor(accentColor, false);
        if (storeName)   applyStoreName(storeName);
        if (storeLogo)   applyStoreLogo(storeLogo);
      }
    } catch {}
  }

  function applyColor(color, save = true) {
    document.documentElement.style.setProperty('--accent', color);
    document.body.style.setProperty('--accent', color);
    // Update glow
    const r = parseInt(color.slice(1,3),16);
    const g = parseInt(color.slice(3,5),16);
    const b = parseInt(color.slice(5,7),16);
    const glow = `rgba(${r},${g},${b},.25)`;
    document.documentElement.style.setProperty('--accent-glow', glow);
    if (save) saveTheme({ accentColor: color });
  }

  function applyStoreName(name) {
    const el = document.querySelector('.logo-text');
    if (el) el.textContent = name;
    document.title = name;
    APP_CONFIG.storeName = name;
  }

  function applyStoreLogo(url) {
    const el = document.querySelector('.logo-icon');
    if (el && url) { el.innerHTML = `<img src="${url}" style="width:28px;height:28px;border-radius:6px;object-fit:cover" />`; }
  }

  async function saveTheme(data) {
    try {
      await db.collection(COLL.config).doc('theme').set(data, { merge: true });
    } catch {}
  }

  function renderAdminTheme(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:1.25rem;margin-bottom:1rem">
        <h4 style="font-size:.95rem;font-weight:700;margin-bottom:1rem">🎨 Personalización</h4>

        <div class="form-row" style="margin-bottom:1rem">
          <label style="font-size:.82rem;font-weight:600;color:var(--text-2);display:block;margin-bottom:.5rem">Nombre de la tienda</label>
          <div style="display:flex;gap:.5rem">
            <input type="text" id="storeNameInput" class="input-field" placeholder="Mi Kiosco" value="${APP_CONFIG.storeName || ''}" />
            <button class="btn-primary btn-sm" id="saveStoreNameBtn">Guardar</button>
          </div>
        </div>

        <div class="form-row" style="margin-bottom:1rem">
          <label style="font-size:.82rem;font-weight:600;color:var(--text-2);display:block;margin-bottom:.5rem">Logo (URL de imagen)</label>
          <div style="display:flex;gap:.5rem">
            <input type="url" id="storeLogoInput" class="input-field" placeholder="https://..." />
            <button class="btn-primary btn-sm" id="saveLogoBtn">Aplicar</button>
          </div>
        </div>

        <div class="form-row">
          <label style="font-size:.82rem;font-weight:600;color:var(--text-2);display:block;margin-bottom:.5rem">Color principal</label>
          <div class="theme-picker">
            ${COLORS.map(c => `
              <div class="color-swatch" style="background:${c.value}"
                title="${c.name}" data-color="${c.value}"></div>`).join('')}
            <input type="color" id="customColorPicker" title="Color personalizado"
              style="width:36px;height:36px;border-radius:50%;border:3px solid var(--border);cursor:pointer;padding:0" />
          </div>
        </div>
      </div>`;

    container.querySelector('#saveStoreNameBtn')?.addEventListener('click', () => {
      const name = document.getElementById('storeNameInput').value.trim();
      if (!name) return;
      applyStoreName(name);
      saveTheme({ storeName: name });
      showToast('Nombre actualizado ✅', 'success');
    });

    container.querySelector('#saveLogoBtn')?.addEventListener('click', () => {
      const url = document.getElementById('storeLogoInput').value.trim();
      if (!url) return;
      applyStoreLogo(url);
      saveTheme({ storeLogo: url });
      showToast('Logo actualizado ✅', 'success');
    });

    container.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        applyColor(swatch.dataset.color);
        showToast('Color aplicado ✅', 'success');
      });
    });

    document.getElementById('customColorPicker')?.addEventListener('input', e => {
      applyColor(e.target.value);
    });
  }

  return { load, applyColor, renderAdminTheme };
})();
