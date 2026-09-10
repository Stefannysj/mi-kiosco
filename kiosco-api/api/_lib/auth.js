'use strict';
const { getAdmin, getDb } = require('./firebaseAdmin');
function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
async function requireUser(req) {
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) fail(401, 'Inicia sesion para continuar.');
  try { return await getAdmin().auth().verifyIdToken(match[1], true); }
  catch { return fail(401, 'La sesion no es valida o ha vencido.'); }
}
async function isAdmin(user) {
  if (user.admin === true) return true;
  const configured = String(process.env.ADMIN_UIDS || '').split(',').map(value => value.trim());
  if (configured.includes(user.uid)) return true;
  const snapshot = await getDb().collection('config').doc('admin').get();
  const config = snapshot.exists ? snapshot.data() : {};
  return (Array.isArray(config.uids) && config.uids.includes(user.uid)) ||
    (Boolean(user.phone_number) && Array.isArray(config.phones) && config.phones.includes(user.phone_number));
}
async function requireAdmin(req) {
  const user = await requireUser(req);
  if (!await isAdmin(user)) fail(403, 'Necesitas permiso de administrador.');
  return user;
}
function assertOrderOwner(user, order) {
  // Notification triggers belong to the buyer. Admin jobs can use the admin claim.
  if (order.ownerId !== user.uid && user.admin !== true) fail(403, 'No tienes acceso a este pedido.');
}
module.exports = { requireUser, requireAdmin, isAdmin, assertOrderOwner };
