// ===== js/chat.js =====
// Mejora 9: Chat en tiempo real | Mejora 7: Dirección de entrega | Mejora 8: Tiempo estimado

// ══════════════════════════════════════════════════════════════════════════════
//  CHAT
// ══════════════════════════════════════════════════════════════════════════════
const Chat = (() => {
  let sessionId    = null;
  let unsubChat    = null;
  let isOpen       = false;
  let unreadCount  = 0;
  let isAdmin      = false;
  let adminOrderId = null; // when admin opens chat for a specific order

  function getSessionId() {
    if (!sessionId) {
      sessionId = localStorage.getItem('kiosco_chat_session');
      if (!sessionId) {
        sessionId = 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        localStorage.setItem('kiosco_chat_session', sessionId);
      }
    }
    return sessionId;
  }

  // ── Init for customers ─────────────────────────────────────────────────────
  function initCustomer() {
    isAdmin = false;
    const fab = document.getElementById('chatFab');
    if (!fab) return;
    fab.addEventListener('click', toggleChat);
    document.getElementById('chatClose')?.addEventListener('click', () => closeChat());
    document.getElementById('chatSendBtn')?.addEventListener('click', sendMessage);
    document.getElementById('chatMsgInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
  }

  // ── Init for admin (per order) ─────────────────────────────────────────────
  function initAdmin(orderId) {
    isAdmin      = true;
    adminOrderId = orderId;
    sessionId    = orderId;
    subscribeMessages(orderId);
  }

  function toggleChat() {
    isOpen ? closeChat() : openChat();
  }

  function openChat() {
    isOpen = true;
    unreadCount = 0;
    updateBadge();
    document.getElementById('chatWindow')?.classList.remove('hidden');
    subscribeMessages(getSessionId());
    setTimeout(() => document.getElementById('chatMsgInput')?.focus(), 100);
  }

  function closeChat() {
    isOpen = false;
    document.getElementById('chatWindow')?.classList.add('hidden');
    if (unsubChat) { unsubChat(); unsubChat = null; }
  }

  function subscribeMessages(sid) {
    if (unsubChat) unsubChat();
    unsubChat = db.collection('chats').doc(sid).collection('messages')
      .orderBy('createdAt', 'asc')
      .limit(100)
      .onSnapshot(snap => {
        renderMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        if (!isOpen) {
          const newMsgs = snap.docChanges().filter(c => c.type === 'added' && c.doc.data().sender !== 'customer');
          if (newMsgs.length) { unreadCount += newMsgs.length; updateBadge(); }
        }
      });
  }

  function renderMessages(messages) {
    const container = document.getElementById(isAdmin ? 'adminChatMessages' : 'chatMessages');
    if (!container) return;

    container.innerHTML = messages.map(m => {
      const time = m.createdAt?.toDate
        ? m.createdAt.toDate().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
        : '';
      const isOwn = isAdmin ? m.sender === 'admin' : m.sender === 'customer';
      return `<div class="chat-msg ${isOwn ? 'sent' : 'received'} ${m.sender === 'admin' ? 'admin-msg' : ''}">
        ${m.sender === 'admin' ? '<span style="font-size:.7rem;opacity:.7">Admin · </span>' : ''}
        ${escHtml(m.text)}
        <div class="msg-time">${time}</div>
      </div>`;
    }).join('');

    container.scrollTop = container.scrollHeight;
  }

  async function sendMessage() {
    const input = document.getElementById(isAdmin ? 'adminChatInput' : 'chatMsgInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const sid    = isAdmin ? adminOrderId : getSessionId();
    const sender = isAdmin ? 'admin' : 'customer';

    input.value = '';
    try {
      await db.collection('chats').doc(sid).collection('messages').add({
        text, sender,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      // Mark chat as having new message for admin notification
      await db.collection('chats').doc(sid).set({
        lastMessage: text, lastSender: sender,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        unreadAdmin: sender === 'customer'
      }, { merge: true });
    } catch (e) {
      showToast('Error al enviar mensaje', 'error');
    }
  }

  function updateBadge() {
    const badge = document.getElementById('chatUnreadBadge');
    if (!badge) return;
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
  }

  function escHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
    );
  }

  return { initCustomer, initAdmin, sendMessage, openChat, closeChat };
})();

// ══════════════════════════════════════════════════════════════════════════════
//  DELIVERY ADDRESS (Mejora 7)
// ══════════════════════════════════════════════════════════════════════════════
const Delivery = (() => {
  function getAddress() {
    return localStorage.getItem('kiosco_customer_address') || '';
  }

  function renderDeliverySection(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const saved = getAddress();
    const html = `
      <div class="delivery-section">
        <label class="delivery-toggle">
          <input type="checkbox" id="deliveryCheck" ${saved ? 'checked' : ''} />
          🛵 Quiero entrega a domicilio
        </label>
        <div id="deliveryAddressWrap" style="${saved ? '' : 'display:none'}">
          <label>Dirección de entrega</label>
          <input type="text" id="deliveryAddress" class="input-field"
            value="${saved}" placeholder="Calle, número, piso, referencia..." />
        </div>
      </div>`;
    container.insertAdjacentHTML('beforeend', html);

    document.getElementById('deliveryCheck')?.addEventListener('change', e => {
      const wrap = document.getElementById('deliveryAddressWrap');
      if (wrap) wrap.style.display = e.target.checked ? '' : 'none';
    });
  }

  function getDeliveryData() {
    const check   = document.getElementById('deliveryCheck');
    const address = document.getElementById('deliveryAddress');
    if (!check?.checked) return null;
    const addr = address?.value.trim() || '';
    if (addr) localStorage.setItem('kiosco_customer_address', addr);
    return addr;
  }

  return { renderDeliverySection, getDeliveryData, getAddress };
})();

// ══════════════════════════════════════════════════════════════════════════════
//  ETA — Tiempo estimado (Mejora 8)
// ══════════════════════════════════════════════════════════════════════════════
const ETA = (() => {
  let etaMinutes = null;

  async function load() {
    try {
      const doc = await db.collection(COLL.config).doc('settings').get();
      if (doc.exists) etaMinutes = doc.data().etaMinutes || null;
    } catch {}
    renderETA();
  }

  async function save(minutes) {
    await db.collection(COLL.config).doc('settings').set({ etaMinutes: parseInt(minutes) }, { merge: true });
    etaMinutes = parseInt(minutes);
    showToast('Tiempo estimado actualizado ✅', 'success');
  }

  function renderETA() {
    const el = document.getElementById('etaBanner');
    if (!el) return;
    if (etaMinutes) {
      el.innerHTML = `<span class="eta-badge">⏱️ Tiempo estimado: ${etaMinutes} min</span>`;
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  }

  // Admin config UI
  function renderAdminETA(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
      <div class="eta-config">
        <h4>⏱️ Tiempo estimado de entrega</h4>
        <div class="eta-row">
          <input type="number" id="etaInput" class="input-field" value="${etaMinutes || ''}" min="1" max="180" placeholder="minutos" />
          <span style="color:var(--text-2);font-size:.85rem">minutos</span>
          <button class="btn-primary btn-sm" id="saveEtaBtn">Guardar</button>
          <button class="btn-outline btn-sm" id="clearEtaBtn">Quitar</button>
        </div>
      </div>`;

    document.getElementById('saveEtaBtn')?.addEventListener('click', () => {
      const val = document.getElementById('etaInput').value;
      if (val && parseInt(val) > 0) save(val);
    });
    document.getElementById('clearEtaBtn')?.addEventListener('click', async () => {
      await db.collection(COLL.config).doc('settings').set({ etaMinutes: null }, { merge: true });
      etaMinutes = null;
      document.getElementById('etaInput').value = '';
      showToast('Tiempo estimado eliminado', 'info');
    });
  }

  return { load, save, renderAdminETA };
})();
