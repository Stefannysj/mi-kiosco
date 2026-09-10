'use strict';

function allowedOrigins() {
  return String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

function applyCors(req, res, methods = 'GET,POST,OPTIONS') {
  const origin = req.headers.origin;
  const allowed = allowedOrigins();
  if (origin && (allowed.includes(origin) || allowed.includes('*'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, X-Receipt-Url, X-Receipt-Token');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const maximum = 2 * 1024 * 1024;
  const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
  let raw;
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    if (Array.isArray(req.body)) fail(400, 'Se esperaba un objeto JSON.');
    if (Buffer.byteLength(JSON.stringify(req.body)) > maximum) fail(413, 'Solicitud demasiado grande.');
    return req.body;
  }
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) raw = String(req.body);
  else {
    const chunks = []; let length = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += buffer.length;
      if (length > maximum) fail(413, 'Solicitud demasiado grande.');
      chunks.push(buffer);
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.byteLength(raw) > maximum) fail(413, 'Solicitud demasiado grande.');
  try {
    const data = raw ? JSON.parse(raw) : {};
    if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, 'Se esperaba un objeto JSON.');
    return data;
  } catch (error) { return fail(error.statusCode || 400, 'JSON no valido.'); }
}

function requireMethod(req, res, method) {
  if (req.method === method) return true;
  res.setHeader('Allow', method);
  json(res, 405, { error: `Method ${req.method} not allowed` });
  return false;
}

function safeError(error) {
  console.error(error);
  return Number(error?.statusCode) >= 400 && Number(error?.statusCode) < 500 ? error.message : 'No se pudo completar la solicitud. Intenta nuevamente.';
}

module.exports = { applyCors, json, readJson, requireMethod, safeError };
