// js/notifications.js — Admin: new order real-time alerts
const Notifications = (() => {
  let unsub    = null;
  let active   = false;
  let baseline = null; // timestamp when admin logged in

  function init() {
    if (!window.Auth?.hasAdministrativeAccess()) return;
    active   = true;
    baseline = new Date();
    subscribe();
    // Permission is requested only by an explicit user action.
  }

  function stop() {
    active = false;
    if (unsub) { unsub(); unsub = null; }
    document.querySelectorAll('.new-order-alert').forEach(el => el.remove());
  }

  function subscribe() {
    if (unsub) unsub();
    unsub = db.collection(COLL.orders)
      .where('status','==','pending')

      .onSnapshot(snap => {
        if (!active) return;
        snap.docChanges().sort((a, b) => KioscoCore.timestamp(a.doc.data().createdAt) - KioscoCore.timestamp(b.doc.data().createdAt)).forEach(ch => {
          if (ch.type !== 'added') return;
          const o  = { id:ch.doc.id, ...ch.doc.data() };
          const ts = o.createdAt?.toDate ? o.createdAt.toDate() : null;
          if (ts && baseline && ts > baseline) {
            showAlert(o);
            vibrate();
            browserNotif(o);
          }
        });
      }, () => { stop(); });
  }

  function showAlert(o) {
    document.querySelectorAll('.new-order-alert').forEach(el => el.remove());
    const el = document.createElement('div');
    el.className = 'new-order-alert';
    el.innerHTML = `
      <span class="alert-icon">🔔</span>
      <div>
        <p class="alert-title">¡Nuevo pedido!</p>
        <p class="alert-sub">👤 ${String(o.customer||'Cliente').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))} · ${APP_CONFIG.currency} ${Number(o.total||0).toFixed(2)}</p>
      </div>
      <button class="alert-close" aria-label="Cerrar">✕</button>`;
    document.body.appendChild(el);

    el.querySelector('.alert-close').addEventListener('click', e => {
      e.stopPropagation(); dismiss(el);
    });
    el.addEventListener('click', () => {
      document.querySelector('[data-section="orders"]')?.click();
      dismiss(el);
    });
    setTimeout(() => el.isConnected && dismiss(el), 9000);
  }

  function dismiss(el) {
    el.style.animation = 'fadeOut .25s ease forwards';
    setTimeout(() => el.remove(), 260);
  }

  function vibrate() {
    try { navigator.vibrate?.([200,100,200]); } catch {}
  }

  async function requestPermission() {
    if ('Notification' in window && Notification.permission === 'default')
      await Notification.requestPermission();
  }

  function browserNotif(o) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      new Notification(`🛍️ Nuevo pedido en ${APP_CONFIG.storeName}`, {
        body:  `${String(o.customer||'Cliente').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))} · ${APP_CONFIG.currency} ${Number(o.total||0).toFixed(2)}`,
        icon:  'icons/icon-192.png',
        tag:   'new-order',
        renotify: true
      });
    } catch {}
  }

  return { init, stop, requestPermission };
})();
