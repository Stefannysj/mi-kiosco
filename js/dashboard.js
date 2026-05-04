// ===== js/dashboard.js =====
// Dashboard de administrador — estadísticas, gráfico y descarga de reportes

const Dashboard = (() => {
  let period      = 'day';        // 'day' | 'week' | 'month'
  let chartInst   = null;
  let allOrders   = [];
  let unsubOrders = null;
  let chartReady  = false;

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    bindPeriodTabs();
    bindDownloads();
    loadChart().then(() => {
      chartReady = true;
      subscribeOrders();
    });
  }

  // ── Load Chart.js dynamically ──────────────────────────────────────────────
  function loadChart() {
    return new Promise(resolve => {
      if (window.Chart) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
      s.onload  = resolve;
      s.onerror = resolve; // continue even if CDN fails
      document.head.appendChild(s);
    });
  }

  // ── Subscribe to orders real-time ──────────────────────────────────────────
  function subscribeOrders() {
    if (unsubOrders) unsubOrders();
    unsubOrders = db.collection(COLL.orders)
      .orderBy('createdAt', 'desc')
      .limit(1000)
      .onSnapshot(snap => {
        allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderStats();
        renderChart();
      }, err => console.error('Dashboard subscription error:', err));
  }

  // ── Period filter ──────────────────────────────────────────────────────────
  function getStartDate(p) {
    const d = new Date();
    if (p === 'day') {
      d.setHours(0, 0, 0, 0);
    } else if (p === 'week') {
      d.setDate(d.getDate() - d.getDay()); // Sunday
      d.setHours(0, 0, 0, 0);
    } else if (p === 'month') {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
    }
    return d;
  }

  function filterByPeriod(orders, p) {
    const start = getStartDate(p);
    return orders.filter(o => {
      if (!o.createdAt) return false;
      const t = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      return t >= start;
    });
  }

  // ── Stats rendering ────────────────────────────────────────────────────────
  function renderStats() {
    const filtered  = filterByPeriod(allOrders, period);
    const nonRejected = filtered.filter(o => o.status !== 'rejected');
    const revenue   = nonRejected.reduce((s, o) => s + (o.total || 0), 0);
    const done      = filtered.filter(o => o.status === 'done').length;
    const pending   = filtered.filter(o => o.status === 'pending').length;

    setText('statRevenue', APP_CONFIG.currency + ' ' + revenue.toFixed(2));
    setText('statOrders',  filtered.length);
    setText('statDone',    done);
    setText('statPending', pending);
  }

  // ── Chart rendering ────────────────────────────────────────────────────────
  function renderChart() {
    const canvas = document.getElementById('salesChart');
    if (!canvas || !chartReady || !window.Chart) return;

    const { labels, revenueData, countData } = buildChartData(period);

    const style   = getComputedStyle(document.body);
    const accent  = style.getPropertyValue('--accent').trim()  || '#f97316';
    const info    = style.getPropertyValue('--info').trim()    || '#06b6d4';
    const text3   = style.getPropertyValue('--text-3').trim()  || '#6b6b80';
    const border  = style.getPropertyValue('--border').trim()  || 'rgba(255,255,255,.08)';

    if (chartInst) { chartInst.destroy(); chartInst = null; }

    chartInst = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Ventas (S/)',
            data: revenueData,
            backgroundColor: accent + '55',
            borderColor: accent,
            borderWidth: 2,
            borderRadius: 6,
            yAxisID: 'y'
          },
          {
            label: 'Pedidos',
            data: countData,
            type: 'line',
            borderColor: info,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointBackgroundColor: info,
            pointRadius: 4,
            tension: 0.3,
            yAxisID: 'y2'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: text3, font: { size: 12 } } },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,.8)',
            callbacks: {
              label: ctx => ctx.datasetIndex === 0
                ? ' S/ ' + ctx.parsed.y.toFixed(2)
                : ' ' + ctx.parsed.y + ' pedidos'
            }
          }
        },
        scales: {
          x: {
            ticks: { color: text3, font: { size: 11 }, maxRotation: 45 },
            grid: { color: border }
          },
          y: {
            position: 'left',
            ticks: { color: text3, font: { size: 11 }, callback: v => 'S/' + v },
            grid: { color: border }
          },
          y2: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: info, font: { size: 11 } }
          }
        }
      }
    });
  }

  function buildChartData(p) {
    const filtered = filterByPeriod(allOrders, p);
    let labels = [], revenueData = [], countData = [];

    if (p === 'day') {
      labels = Array.from({ length: 24 }, (_, i) => i + 'h');
      revenueData = new Array(24).fill(0);
      countData   = new Array(24).fill(0);
      filtered.forEach(o => {
        if (o.status === 'rejected') return;
        const h = (o.createdAt?.toDate ? o.createdAt.toDate() : new Date()).getHours();
        revenueData[h] += o.total || 0;
        countData[h]++;
      });

    } else if (p === 'week') {
      labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      revenueData = new Array(7).fill(0);
      countData   = new Array(7).fill(0);
      filtered.forEach(o => {
        if (o.status === 'rejected') return;
        const d = (o.createdAt?.toDate ? o.createdAt.toDate() : new Date()).getDay();
        revenueData[d] += o.total || 0;
        countData[d]++;
      });

    } else { // month
      const daysInMonth = new Date(
        new Date().getFullYear(), new Date().getMonth() + 1, 0
      ).getDate();
      labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1) + '');
      revenueData = new Array(daysInMonth).fill(0);
      countData   = new Array(daysInMonth).fill(0);
      filtered.forEach(o => {
        if (o.status === 'rejected') return;
        const day = (o.createdAt?.toDate ? o.createdAt.toDate() : new Date()).getDate() - 1;
        revenueData[day] += o.total || 0;
        countData[day]++;
      });
    }

    return { labels, revenueData, countData };
  }

  // ── Period tabs ────────────────────────────────────────────────────────────
  function bindPeriodTabs() {
    document.querySelectorAll('.period-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        period = tab.dataset.period;
        renderStats();
        renderChart();
      });
    });
  }

  // ── Download reports ───────────────────────────────────────────────────────
  function bindDownloads() {
    ['downloadDay', 'downloadWeek', 'downloadMonth'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        const p = id.replace('download', '').toLowerCase();
        downloadCSV(p);
      });
    });
  }

  async function downloadCSV(p) {
    let orders;
    try {
      const snap = await db.collection(COLL.orders).orderBy('createdAt', 'desc').get();
      orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      showToast('Error al obtener pedidos', 'error'); return;
    }

    const filtered = filterByPeriod(orders, p);
    const labels   = { day: 'Hoy', week: 'Esta semana', month: 'Este mes' };
    const revenue  = filtered
      .filter(o => o.status !== 'rejected')
      .reduce((s, o) => s + (o.total || 0), 0);

    const statusLabel = { pending: 'Pendiente', done: 'Hecho', rejected: 'Rechazado' };

    let csv = '\uFEFF'; // BOM for Excel UTF-8
    csv += 'Reporte Kiosco · ' + labels[p] + '\n';
    csv += 'Generado: ' + new Date().toLocaleString('es-PE') + '\n\n';
    csv += 'ID,Cliente,Productos,Total,Estado,Fecha\n';

    filtered.forEach(o => {
      const items = (o.items || []).map(i => i.name + ' x' + i.qty).join(' | ');
      const date  = o.createdAt?.toDate
        ? o.createdAt.toDate().toLocaleString('es-PE')
        : '';
      csv += [
        o.id,
        '"' + (o.customer || 'N/A') + '"',
        '"' + items + '"',
        APP_CONFIG.currency + ' ' + (o.total || 0).toFixed(2),
        statusLabel[o.status] || o.status,
        '"' + date + '"'
      ].join(',') + '\n';
    });

    csv += '\nRESUMEN\n';
    csv += 'Total pedidos,' + filtered.length + '\n';
    csv += 'Completados,' + filtered.filter(o => o.status === 'done').length + '\n';
    csv += 'Pendientes,' + filtered.filter(o => o.status === 'pending').length + '\n';
    csv += 'Rechazados,' + filtered.filter(o => o.status === 'rejected').length + '\n';
    csv += 'Ingresos totales,' + APP_CONFIG.currency + ' ' + revenue.toFixed(2) + '\n';

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'kiosco-reporte-' + p + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast('Reporte descargado 📥', 'success');
  }

  // ── Public refresh ─────────────────────────────────────────────────────────
  function refresh() {
    renderStats();
    renderChart();
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  return { init, refresh };
})();
