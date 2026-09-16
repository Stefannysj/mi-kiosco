import { collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import Core from '../core.generated';

export function subscribeProducts(onData, onError) {
  let products = [], timer = null, loaded = false;
  const emit = () => { if (loaded) onData([...products]); };
  const stopOffer = onSnapshot(doc(db, 'config', 'offer'), snapshot => {
    const offer = snapshot.exists() ? snapshot.data() : null;
    Core.setOffer(offer); clearTimeout(timer);
    const remaining = Core.timestamp(offer?.endTime) - Date.now();
    if (remaining > 0 && remaining < 2147483647) timer = setTimeout(emit, remaining + 20);
    emit();
  }, onError);
  const stopProducts = onSnapshot(collection(db, 'products'), snapshot => {
    loaded = true;
    products = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
      .filter(item => item.active !== false)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));
    emit();
  }, onError);
  return () => { clearTimeout(timer); stopOffer(); stopProducts(); };
}
export function subscribeCustomerOrders(customer, phone, onData, onError) {
  const name = String(customer || '').trim(), digits = String(phone || '').replace(/\D/g, '');
  if (!name) { onData([]); return () => {}; }
  // Name/phone are unverified contact data, not authorization credentials.
  const ordersQuery = query(collection(db, 'orders'), where(digits ? 'customerPhone' : 'customer', '==', digits || name));
  return onSnapshot(ordersQuery, snapshot => {
    const orders = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
      .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
    onData(orders);
  }, onError);
}
export async function getPaymentConfig() {
  const snapshot = await getDoc(doc(db, 'config', 'payments'));
  return snapshot.exists() ? snapshot.data() : {};
}
export async function createOrder({ customer, phone = '', cart, paymentMethod = 'cash', notes = '', paymentProof }) {
  const name = String(customer || '').trim(), digits = String(phone || '').replace(/\D/g, '');
  if (!name || name.length > 120) throw new Error('Ingresa un nombre de hasta 120 caracteres.');
  if (digits && !/^9\d{8}$/.test(digits)) throw new Error('Ingresa un celular peruano de 9 digitos.');
  if (!Array.isArray(cart) || !cart.length || cart.length > 100) throw new Error('El carrito debe tener entre 1 y 100 lineas.');
  if (!['cash', 'card', 'yape', 'plin'].includes(paymentMethod)) throw new Error('Selecciona un medio de pago valido.');
  if (paymentProof && (!/^data:image\/(png|jpe?g|webp);base64,/i.test(paymentProof.imageData || '') || paymentProof.imageData.length > 420000)) throw new Error('La imagen de pago no es valida o es demasiado grande.');
  const orderReference = doc(collection(db, 'orders'));
  const quantities = {};
  for (const item of cart) {
    const productId = String(item.productId || item.id || '').split('::')[0];
    if (!productId || productId.includes('/') || !Number.isSafeInteger(item.qty) || item.qty < 1 || item.qty > 999) throw new Error('Hay un producto o cantidad no valido en el carrito.');
    quantities[productId] = (quantities[productId] || 0) + item.qty;
    if (quantities[productId] > 999) throw new Error('Un producto no puede superar 999 unidades.');
  }
  let createdOrder;
  await runTransaction(db, async transaction => {
    const offerSnapshot = await transaction.get(doc(db, 'config', 'offer'));
    const liveOffer = offerSnapshot.exists() ? offerSnapshot.data() : null;
    const products = new Map();
    for (const productId of Object.keys(quantities)) {
      const reference = doc(db, 'products', productId), snapshot = await transaction.get(reference);
      if (!snapshot.exists()) throw new Error('Un producto ya no existe. Actualiza tu carrito.');
      const product = snapshot.data();
      if (product.active === false) throw new Error(`${product.name} no esta disponible.`);
      const stock = product.stock == null || product.stock === '' ? null : Number(product.stock);
      if (stock !== null && (!Number.isSafeInteger(stock) || stock < quantities[productId])) throw new Error(`Stock insuficiente para ${product.name}.`);
      products.set(productId, { reference, product, stock });
    }
    const items = cart.map(item => {
      const productId = String(item.productId || item.id).split('::')[0], { product } = products.get(productId);
      const variants = Array.isArray(item.variantSelections) ? item.variantSelections : [];
      const price = Core.priceFor({ ...product, id: productId }, variants, liveOffer);
      return { productId, name: `${product.name}${variants.length ? ' - ' + variants.join(' / ') : ''}`, price, qty: item.qty,
        unit: product.unit || 'Unidad', variants, subtotal: Core.cents(price) * item.qty / 100 };
    });
    for (const [productId, { reference, stock, product }] of products) {
      if (stock !== null) transaction.update(reference, { stock: stock - quantities[productId], lastOrderId: orderReference.id,
        stockReservations: { ...(product.stockReservations || {}), [orderReference.id]: quantities[productId] }, updatedAt: serverTimestamp() });
    }
    createdOrder = { customer: name, customerPhone: digits || null,
      items, productQuantities: quantities, total: items.reduce((sum, item) => sum + Core.cents(item.subtotal), 0) / 100,
      itemCount: items.reduce((sum, item) => sum + item.qty, 0), status: 'pending', paymentMethod,
      paymentGroup: ['yape', 'plin'].includes(paymentMethod) ? 'wallet' : paymentMethod,
      paymentProofExpected: Boolean(paymentProof), notes: String(notes).trim().slice(0, 300) || null,
      deliveryType: 'pickup', deliveryAddress: null, scheduledDate: null, scheduledTime: null,
      source: 'expo', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    transaction.set(orderReference, createdOrder);
  });
  let proofWarning = '';
  if (paymentProof?.imageData) {
    try {
      await setDoc(doc(db, 'paymentProofs', orderReference.id), {
        orderId: orderReference.id, paymentMethod, imageData: paymentProof.imageData,
        fileName: String(paymentProof.fileName || 'comprobante.jpg').slice(0, 120),
        contentType: String(paymentProof.contentType || 'image/jpeg').slice(0, 80),
        encodedLength: Number(paymentProof.encodedLength || paymentProof.imageData.length), createdAt: serverTimestamp()
      });
    } catch (error) {
      console.warn('Comprobante de pago:', error);
      proofWarning = 'El pedido se registro, pero la imagen del pago no pudo guardarse.';
    }
  }
  // Do not call the protected backend from an unauthenticated customer or fabricate an ID token.
  // The existing administrative Firestore listener receives newly created orders.
  return { orderId: orderReference.id, proofWarning, order: { ...createdOrder, id: orderReference.id, createdAt: new Date() } };
}
export function timestampMillis(value) { return Core.timestamp(value); }
