/* Shared, dependency-free validation. No credentials or network side effects. */
'use strict';
(function (root) {
  const MAX_QTY = 999;
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const cents = value => Math.round((Number(value) + Number.EPSILON) * 100);
  const money = value => cents(value) / 100;
  function timestamp(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    const result = new Date(value).getTime();
    return Number.isFinite(result) ? result : 0;
  }
  function limaDate(value = new Date()) {
    return new Date(timestamp(value) - 5 * 3600000);
  }
  function periodRange(period, now = new Date()) {
    const local = limaDate(now);
    let year = local.getUTCFullYear(), month = local.getUTCMonth(), day = local.getUTCDate();
    if (period === 'week') day -= (local.getUTCDay() + 6) % 7;
    if (period === 'month') day = 1;
    const start = Date.UTC(year, month, day, 5);
    const end = period === 'month' ? Date.UTC(year, month + 1, 1, 5) : start + (period === 'week' ? 7 : 1) * 86400000;
    return { start: new Date(start), end: new Date(end) };
  }
  function filterPeriod(list, period, now = new Date()) {
    const { start, end } = periodRange(period, now);
    return (Array.isArray(list) ? list : []).filter(item => {
      const time = timestamp(item.createdAt);
      return time >= +start && time < +end;
    });
  }
  function decimal(value) {
    if (typeof value === 'number') return value;
    let text = String(value ?? '').trim().replace(/\s+/g, '');
    if (!text || !/^-?\d+(?:[.,]\d+)*$/.test(text)) return NaN;
    if (text.includes(',') && text.includes('.')) {
      const separator = text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.';
      const groups = text.split(separator);
      if (groups.length !== 2 || !/^\d{1,2}$/.test(groups[1])) return NaN;
      const whole = groups[0];
      const validGrouping = separator === ',' ? /^-?\d{1,3}(?:\.\d{3})+$/ : /^-?\d{1,3}(?:,\d{3})+$/;
      if (!validGrouping.test(whole)) return NaN;
      text = whole.replace(/[.,]/g, '') + '.' + groups[1];
    } else {
      text = text.replace(',', '.');
    }
    return Number(text);
  }
  function safeImageUrl(value, { inline = true, relative = true } = {}) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    if (inline && /^data:image\/(?:png|jpeg|jpg|webp|gif|avif);base64,[a-z0-9+/=\s]+$/i.test(text)) return text;
    if (relative && /^(?:\/?(?:icons|uploads)\/)[^<>"\\]+$/i.test(text) && !text.includes('..')) return text;
    try {
      const url = new URL(text);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
      return url.href;
    } catch { return ''; }
  }
  function productImage(product) {
    const sources = [...(Array.isArray(product?.images) ? product.images : []), product?.resolvedImageUrl, product?.imageUrl];
    for (const source of sources) { const valid = safeImageUrl(source); if (valid) return valid; }
    return '';
  }
  function variants(product) {
    return (Array.isArray(product?.variants) ? product.variants : []).filter(group =>
      group && String(group.name || '').trim() && Array.isArray(group.options) && group.options.length);
  }
  let currentOffer = null;
  function setOffer(offer) { currentOffer = offer && typeof offer === 'object' ? { ...offer } : null; }
  function basePrice(product, offer = currentOffer, now = Date.now()) {
    const base = Number(product?.price);
    if (!Number.isFinite(base) || base < 0) throw new Error('El precio del producto no es valido.');
    const rawDiscount = Number(product?.discountPercent || 0);
    const discount = Number.isFinite(rawDiscount) ? Math.max(0, Math.min(100, rawDiscount)) : 0;
    const discounted = money(base * (1 - discount / 100));
    const promoted = Number(offer?.offerPrice);
    return offer && offer.active !== false && String(offer.productId) === String(product?.id)
      && timestamp(offer.endTime) > timestamp(now) && Number.isFinite(promoted) && promoted >= 0
      ? money(Math.min(discounted, promoted)) : discounted;
  }
  function priceFor(product, selections = [], offer = currentOffer) {
    const groups = variants(product);
    if (groups.length !== selections.length) throw new Error('Selecciona las variantes del producto.');
    let amount = basePrice(product, offer);
    if (!Number.isFinite(amount) || amount < 0) throw new Error('El precio del producto no es valido.');
    groups.forEach((group, index) => {
      if (!group.options.some(option => String(option) === String(selections[index]))) throw new Error('Una variante ya no esta disponible.');
      const extra = Number(group.extraPrice || 0);
      if (!Number.isFinite(extra) || extra < 0) throw new Error('El precio de la variante no es valido.');
      amount += extra;
    });
    return money(amount);
  }
  function cartKey(productId, selections = []) {
    return selections.length ? `${productId}::${encodeURIComponent(JSON.stringify(selections.map(String)))}` : String(productId);
  }
  function validateImport(row, categories = []) {
    const errors = [];
    const name = String(row.nombre ?? '').trim();
    const description = String(row.descripcion ?? '').trim();
    const price = decimal(row.precio);
    const rawStock = String(row.stock ?? '').trim();
    const stock = rawStock === '' ? null : decimal(row.stock);
    const imageUrl = String(row.imageUrl ?? '').trim();
    const rawActive = normalize(row.activo === '' || row.activo == null ? 'si' : row.activo);
    let active = true;
    if (!name || name.length > 120) errors.push('nombre requerido, maximo 120 caracteres');
    if (description.length > 3000) errors.push('descripcion demasiado larga (maximo 3000)');
    if (!Number.isFinite(price) || price < 0 || price > 10000000) errors.push('precio invalido');
    if (stock !== null && (!Number.isSafeInteger(stock) || stock < 0)) errors.push('stock debe ser un entero positivo, cero o vacio');
    if (imageUrl && !safeImageUrl(imageUrl, { inline: false, relative: false })) errors.push('imageUrl debe ser una URL http o https valida');
    if (['si', 'yes', 'true', '1'].includes(rawActive)) active = true;
    else if (['no', 'false', '0'].includes(rawActive)) active = false;
    else errors.push('activo debe ser SI o NO');
    const categoryName = normalize(row.categoria);
    const subcategoryName = normalize(row.subcategoria);
    const matches = categories.filter(item => !item.parentId && normalize(item.name) === categoryName);
    const category = categoryName && matches.length === 1 ? matches[0] : null;
    if (categoryName && !category) errors.push('categoria inexistente o ambigua');
    const subs = subcategoryName ? categories.filter(item => item.parentId && normalize(item.name) === subcategoryName && (!category || item.parentId === category.id)) : [];
    const subcategory = subs.length === 1 ? subs[0] : null;
    if (subcategoryName && !subcategory) errors.push('subcategoria inexistente o ambigua; indica su categoria');
    if (errors.length) return { valid: false, errors };
    return { valid: true, errors: [], payload: { name, description, price: money(price), stock,
      categoryId: category?.id || subcategory?.parentId || null, subcategoryId: subcategory?.id || null,
      imageUrl: imageUrl || null, active, unit: 'Unidad', discountPercent: 0 } };
  }
  root.KioscoCore = Object.freeze({ MAX_QTY, normalize, cents, money, timestamp, limaDate, periodRange, filterPeriod,
    decimal, safeImageUrl, productImage, variants, setOffer, basePrice, priceFor, cartKey, validateImport });
})(globalThis);
