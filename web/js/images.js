'use strict';
(function (root) {
  function storagePath(path, imageUrl = '') {
    const bucket = root.FIREBASE_CONFIG?.storageBucket;
    if (!bucket) return '';
    for (const raw of [path, imageUrl]) {
      const value = String(raw || '').trim();
      if (/^(products|logos)\/[^?#]+$/.test(value) && !value.includes('..') && !value.includes('\\')) return value;
      try {
        const url = new URL(value);
        if (url.protocol === 'gs:' && url.hostname === bucket) {
          const result = decodeURIComponent(url.pathname.slice(1));
          if (/^(products|logos)\//.test(result) && !result.includes('..')) return result;
        }
        if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com') continue;
        const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
        if (!match || decodeURIComponent(match[1]) !== bucket) continue;
        const result = decodeURIComponent(match[2]);
        if (/^(products|logos)\//.test(result) && !result.includes('..') && !result.includes('\\')) return result;
      } catch { /* external URLs are never owned assets */ }
    }
    return '';
  }
  function setProgress(percent, stage = '') {
    const wrap = document.getElementById('productImageUploadProgress');
    const bar = document.getElementById('productImageUploadProgressBar');
    const status = document.getElementById('productImageUploadStatus');
    if (status && stage) status.textContent = stage;
    if (!wrap || !bar) return;
    wrap.classList.toggle('d-none', percent == null && !stage);
    if (percent == null) {
      wrap.removeAttribute('aria-valuenow');
      bar.style.width = '100%'; bar.textContent = stage;
      bar.classList.add('progress-bar-striped', 'progress-bar-animated');
    } else {
      const value = Math.max(0, Math.min(100, Math.round(percent)));
      wrap.setAttribute('aria-valuenow', String(value));
      bar.style.width = `${value}%`; bar.textContent = `${value}%`;
      bar.classList.toggle('progress-bar-animated', value < 100);
    }
  }
  async function upload(file, productId, onProgress = setProgress) {
    if (root.KIOSCO_UPGRADE_CONFIG?.imageStorage !== 'firebase-storage') throw new Error('Storage no esta habilitado; se conserva el modo Spark.');
    if (!root.storage || !root.auth?.currentUser) throw new Error('Inicia sesion para subir una imagen.');
    if (!file || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) {
      throw new Error('Selecciona JPG, PNG, WEBP o GIF de hasta 5 MB.');
    }
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[file.type];
    const id = encodeURIComponent(String(productId));
    // randomUUID is missing in some webviews/non-secure test contexts; keep a CSPRNG fallback.
    const bytes = new Uint8Array(16); root.crypto.getRandomValues(bytes);
    const unique = typeof root.crypto.randomUUID === 'function' ? root.crypto.randomUUID()
      : Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    const reference = root.storage.ref(`products/${id}/${unique}.${extension}`);
    const task = reference.put(file, { contentType: file.type, cacheControl: 'public,max-age=31536000,immutable' });
    onProgress(0, 'Subiendo imagen');
    await new Promise((resolve, reject) => {
      task.on('state_changed', snapshot => onProgress(snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes * 100 : 0, 'Subiendo imagen'), reject, resolve);
    });
    try {
      const imageUrl = await reference.getDownloadURL();
      return { imageUrl, imagePath: reference.fullPath, imageProvider: 'firebase-storage' };
    } catch (error) {
      try { await reference.delete(); } catch { /* report original failure */ }
      throw error;
    }
  }
  async function remove(path, url = '') {
    const owned = storagePath(path, url);
    if (!owned) return false;
    if (root.db) {
      const [products, theme] = await Promise.all([root.db.collection('products').get({ source: 'server' }), root.db.collection('config').doc('theme').get({ source: 'server' })]);
      if (products.docs.some(doc => storagePath(doc.data().imagePath, doc.data().imageUrl) === owned)) return false;
      const branding = theme.data() || {};
      if (storagePath(branding.logoPath || branding.storeLogoPath, branding.storeLogoUrl) === owned) return false;
    }
    if (!root.storage) throw new Error('Storage no esta disponible para limpiar la imagen anterior.');
    try { await root.storage.ref(owned).delete(); return true; }
    catch (error) {
      if (error.code === 'storage/object-not-found') return true;
      throw new Error('El cambio se guardo, pero no se pudo borrar la imagen anterior en Storage. Revisa permisos y el plan de Firebase.');
    }
  }
  function load(source, { cors = false, timeout = 10000 } = {}) {
    const value = root.KioscoCore.safeImageUrl(source);
    if (!value) return Promise.reject(new Error('URL de imagen invalida.'));
    return new Promise((resolve, reject) => {
      const image = new Image();
      let timer;
      const finish = (error) => {
        clearTimeout(timer); image.onload = null; image.onerror = null;
        error ? reject(error) : resolve(image);
      };
      if (cors && !value.startsWith('data:')) image.crossOrigin = 'anonymous';
      image.onload = () => image.naturalWidth ? finish() : finish(new Error('Imagen vacia.'));
      image.onerror = () => finish(new Error('La imagen no esta disponible o no permite su lectura.'));
      timer = setTimeout(() => { finish(new Error('La imagen tardo demasiado en responder.')); image.src = ''; }, timeout);
      image.src = value;
    });
  }
  async function toDataUrl(source) {
    if (!source) return null;
    try {
      const image = await load(source, { cors: true });
      const canvas = document.createElement('canvas');
      canvas.width = 464; canvas.height = 448;
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
      const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
      context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch { return null; }
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('error', event => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      const source = image.getAttribute('src');
      if (!source || image.dataset.fallbackApplied === 'true') return;
      image.dataset.fallbackApplied = 'true';
      const wrapper = image.closest('.prod-image-wrap, .prod-img-wrap, .card-img-wrap, .admin-product-image, .product-img-wrap, [data-product-id]');
      if (wrapper) wrapper.dataset.failedSource = source;
      image.alt = 'Imagen no disponible';
      image.removeAttribute('srcset');
      // Inline vector has no network dependency; it is application-owned, not user supplied.
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180"><rect width="240" height="180" fill="#f3f4f6"/><rect x="85" y="42" width="70" height="62" rx="8" fill="none" stroke="#9ca3af" stroke-width="4"/><path d="M88 90l23-24 20 20 13-12 10 12" fill="none" stroke="#9ca3af" stroke-width="4"/><text x="120" y="137" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#6b7280">Sin imagen</text></svg>');
    }, true);
  }
  root.KioscoImages = Object.freeze({ storagePath, upload, remove, load, toDataUrl, setProgress });
})(globalThis);
