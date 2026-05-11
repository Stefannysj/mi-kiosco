// ===== js/invoice.js =====
// Funcionalidad 11: Generar boleta/factura PDF profesional por pedido

const Invoice = (() => {

  function generate(order) {
    const date = order.createdAt?.toDate
      ? order.createdAt.toDate().toLocaleString('es-PE', {
          weekday: 'long', year: 'numeric', month: 'long',
          day: 'numeric', hour: '2-digit', minute: '2-digit'
        })
      : new Date().toLocaleString('es-PE');

    const itemRows = (order.items || []).map(item => `
      <tr>
        <td>${item.name}</td>
        <td style="text-align:center">${item.qty}</td>
        <td style="text-align:right">${APP_CONFIG.currency} ${Number(item.price).toFixed(2)}</td>
        <td style="text-align:right">${APP_CONFIG.currency} ${Number(item.price * item.qty).toFixed(2)}</td>
      </tr>
    `).join('');

    const storeName = document.querySelector('.logo-text')?.textContent || APP_CONFIG.storeName;
    const accentColor = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#f97316';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Boleta #${order.id?.slice(-6).toUpperCase() || 'KIOSCO'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #1a1a1a;
      background: #fff;
      padding: 40px;
      max-width: 680px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 3px solid ${accentColor};
    }
    .store-name {
      font-size: 28px;
      font-weight: 900;
      color: ${accentColor};
      letter-spacing: -.02em;
    }
    .store-sub { font-size: 13px; color: #888; margin-top: 4px; }
    .invoice-meta { text-align: right; }
    .invoice-num { font-size: 18px; font-weight: 700; color: #333; }
    .invoice-date { font-size: 12px; color: #888; margin-top: 4px; }

    .customer-section {
      background: #f8f8f8;
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .customer-label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: .08em; }
    .customer-name { font-size: 18px; font-weight: 700; margin-top: 4px; }
    ${order.delivery?.address ? `
    .customer-address { font-size: 13px; color: #666; margin-top: 6px; }
    ` : ''}

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    thead tr {
      background: ${accentColor};
      color: #fff;
    }
    th {
      padding: 10px 12px;
      text-align: left;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .06em;
    }
    td {
      padding: 10px 12px;
      font-size: 14px;
      border-bottom: 1px solid #eee;
    }
    tbody tr:hover { background: #fafafa; }

    .totals {
      margin-left: auto;
      width: 260px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 14px;
      color: #555;
    }
    .total-row.grand {
      border-top: 2px solid ${accentColor};
      margin-top: 8px;
      padding-top: 10px;
      font-size: 20px;
      font-weight: 900;
      color: ${accentColor};
    }

    ${order.delivery?.address ? `
    .delivery-section {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 10px;
      padding: 14px 18px;
      margin-top: 16px;
      font-size: 13px;
      color: #0369a1;
    }
    .delivery-section strong { display: block; margin-bottom: 4px; }
    ` : ''}

    ${order.estimatedMinutes ? `
    .eta-badge {
      display: inline-block;
      background: ${accentColor}20;
      color: ${accentColor};
      border-radius: 99px;
      padding: 4px 12px;
      font-size: 13px;
      font-weight: 700;
      margin-top: 12px;
    }
    ` : ''}

    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #eee;
      text-align: center;
      font-size: 12px;
      color: #aaa;
    }
    .status-chip {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 700;
      margin-top: 8px;
    }
    .status-done     { background: #dcfce7; color: #16a34a; }
    .status-pending  { background: #fef9c3; color: #ca8a04; }
    .status-rejected { background: #fee2e2; color: #dc2626; }

    @media print {
      body { padding: 20px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="store-name">🛍️ ${storeName}</div>
      <div class="store-sub">Tu tienda digital de confianza</div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-num">BOLETA #${(order.id || '').slice(-6).toUpperCase()}</div>
      <div class="invoice-date">${date}</div>
      <span class="status-chip status-${order.status || 'pending'}">
        ${{ pending:'⏳ Pendiente', done:'✅ Completado', rejected:'❌ Rechazado' }[order.status] || order.status}
      </span>
    </div>
  </div>

  <div class="customer-section">
    <div class="customer-label">Cliente</div>
    <div class="customer-name">👤 ${order.customer || 'Cliente'}</div>
    ${order.delivery?.address ? `<div class="customer-address">📍 ${order.delivery.address}${order.delivery.reference ? ` — ${order.delivery.reference}` : ''}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th style="text-align:center">Cant.</th>
        <th style="text-align:right">Precio</th>
        <th style="text-align:right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span>Subtotal</span>
      <span>${APP_CONFIG.currency} ${(order.total || 0).toFixed(2)}</span>
    </div>
    <div class="total-row grand">
      <span>TOTAL</span>
      <span>${APP_CONFIG.currency} ${(order.total || 0).toFixed(2)}</span>
    </div>
  </div>

  ${order.delivery?.address ? `
  <div class="delivery-section">
    <strong>📦 Información de entrega</strong>
    Dirección: ${order.delivery.address}
    ${order.delivery.reference ? `<br>Referencia: ${order.delivery.reference}` : ''}
  </div>` : ''}

  ${order.estimatedMinutes ? `<div class="eta-badge">⏱️ Entrega estimada: ${order.estimatedMinutes} min</div>` : ''}

  <div class="footer">
    Gracias por tu compra en ${storeName} 🙏<br>
    Generado el ${new Date().toLocaleString('es-PE')}
  </div>

  <script>
    window.onload = () => {
      window.print();
    };
  <\/script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (!win) {
      // Fallback: download
      const a = document.createElement('a');
      a.href = url;
      a.download = `boleta-${(order.id || 'kiosco').slice(-6)}.html`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  return { generate };
})();
