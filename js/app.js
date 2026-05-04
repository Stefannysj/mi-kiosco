// js/app.js — Application orchestrator

// ── Global helpers ────────────────────────────────────────────────────────────
function openModal(el)  { if (el) el.classList.add('open'); }
function closeModal(el) { if (el) el.classList.remove('open'); }
function capitalize(s)  { return s.charAt(0).toUpperCase() + s.slice(1); }

function showToast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const icons = { success:'✅', error:'❌', info:'ℹ️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]||''}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3300);
}

// ── App ────────────────────────────────────────────────────────────────────────
const App = (() => {
  let currentPage = 'store';

  function showPage(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(page === 'store' ? 'pageStore' : 'pageAdmin')?.classList.add('active');

    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.title = page === 'admin' ? 'Ir a la tienda' : 'Panel admin';

    if (page === 'admin') {
      Admin.init();
      Dashboard.init();
      Orders.init();
      Notifications.init();
    } else {
      Notifications.stop();
    }
  }

  // ── Theme ──────────────────────────────────────────────────────────────────
  function setTheme(theme) {
    document.body.classList.remove('theme-dark','theme-light');
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem('kiosco_theme', theme);
    const icon = document.querySelector('.theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function initTheme() {
    setTheme(localStorage.getItem('kiosco_theme') || 'dark');
    document.getElementById('themeToggle')?.addEventListener('click', () => {
      setTheme(document.body.classList.contains('theme-dark') ? 'light' : 'dark');
    });
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  function init() {
    initTheme();
    Store.init();
    Cart.init();
    UIHelpers.init();
    showPage('store');
  }

  return { init, showPage, get currentPage() { return currentPage; } };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
