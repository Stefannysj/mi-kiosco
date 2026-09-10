// ===== js/invoice.js =====
// Módulo unificado: Invoice (boleta PDF) + ExcelExport

// ══════════════════════════════════════════════════════════════════════════════
//  INVOICE — Boleta PDF
// ══════════════════════════════════════════════════════════════════════════════
const Invoice = (() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function generate(rawOrder = {}) {
    const order = { ...rawOrder, total: Number(rawOrder.total) || 0 };
    for (const key of ['id','customer','customerPhone','deliveryAddress','scheduledDate','scheduledTime']) order[key] = escape(order[key]);
    const date = order.createdAt?.toDate
      ? order.createdAt.toDate().toLocaleString('es-PE') : new Date().toLocaleString('es-PE');
    const storeName = escape((typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.storeName : null) || 'Kiosco');
    const rows = (order.items || []).map(i => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${escape(i.name)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${Number(i.qty) || 0}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">S/ ${Number(i.price).toFixed(2)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">S/ ${Number(i.subtotal || i.price * i.qty).toFixed(2)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8"/>
<title>Boleta #${(order.id || '').slice(-6).toUpperCase()} · ${storeName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;color:#222;max-width:580px;margin:32px auto;padding:24px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #f97316}
  .store-name{font-size:1.6rem;font-weight:900;color:#f97316}
  .doc-title{font-size:.95rem;font-weight:700;color:#555;text-align:right}
  .doc-number{font-size:1.1rem;font-weight:900;text-align:right}
  .client-box{background:#f9f9f9;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:.88rem}
  .client-box h3{font-size:.75rem;text-transform:uppercase;color:#888;margin-bottom:6px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  th{background:#f97316;color:#fff;padding:8px;font-size:.8rem;text-align:left}
  th:nth-child(n+2){text-align:center}
  th:last-child{text-align:right}
  .total-section{border-top:2px solid #f97316;padding-top:12px;text-align:right}
  .total-row{display:flex;justify-content:flex-end;gap:32px;margin-bottom:4px;font-size:.88rem}
  .total-final{font-size:1.2rem;font-weight:900;color:#f97316}
  .footer{margin-top:32px;text-align:center;color:#aaa;font-size:.75rem}
  @media print{body{margin:0}}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="store-name">🛍️ ${storeName}</div>
    <div style="font-size:.8rem;color:#888;margin-top:4px">${date}</div>
  </div>
  <div>
    <div class="doc-title">BOLETA DE VENTA</div>
    <div class="doc-number">#${(order.id || '').slice(-6).toUpperCase() || 'N/A'}</div>
  </div>
</div>
<div class="client-box">
  <h3>Cliente</h3>
  <p><strong>${order.customer || 'Cliente'}</strong></p>
  ${order.customerPhone ? `<p>Tel: ${order.customerPhone}</p>` : ''}
  ${order.deliveryAddress ? `<p>Dirección: ${order.deliveryAddress}</p>` : ''}
  ${order.scheduledDate ? `<p>Fecha pedido: ${order.scheduledDate}${order.scheduledTime ? ' ' + order.scheduledTime : ''}</p>` : ''}
</div>
<table>
  <thead><tr>
    <th>Producto</th>
    <th style="text-align:center">Cant.</th>
    <th style="text-align:right">Precio</th>
    <th style="text-align:right">Subtotal</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="total-section">
  <div class="total-row"><span>Subtotal</span><span>S/ ${(order.total || 0).toFixed(2)}</span></div>
  <div class="total-row total-final"><span>TOTAL</span><span>S/ ${(order.total || 0).toFixed(2)}</span></div>
</div>
<div class="footer">
  <p>¡Gracias por tu compra en ${storeName}! 🎉</p>
  <p style="margin-top:4px">Generado el ${new Date().toLocaleString('es-PE')}</p>
</div>
<script>window.onload=()=>window.print()<\/script>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (win) win.opener = null;
    if (!win) {
      const a = document.createElement('a');
      a.href = url; a.download = `boleta-${(order.id || Date.now().toString()).slice(-6)}.html`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  return { generate };
})();

// ══════════════════════════════════════════════════════════════════════════════
//  EXCEL EXPORT
// ══════════════════════════════════════════════════════════════════════════════
const ExcelExport = (() => {
  async function exportXLSX() {
    if (!window.Auth?.hasAdministrativeAccess()) return;
    return Dashboard.exportOrders(undefined, { period: Dashboard.getPeriod(), filePrefix: 'kiosco', lockKey: 'legacy-dashboard' });
  }
  return { exportXLSX };
})();
