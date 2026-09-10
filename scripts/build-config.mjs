import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) throw new Error('Falta .env en la raiz del proyecto.');
const values = { ...parseEnv(fs.readFileSync(envPath, 'utf8')), ...process.env };
const required = key => { const value = String(values[key] || '').trim(); if (!value) throw new Error(`Falta ${key} en .env`); return value; };
// Explicit whitelist: no Admin credentials, API tokens or private keys go to clients.
const firebase = {
  apiKey: required('FIREBASE_API_KEY'), authDomain: required('FIREBASE_AUTH_DOMAIN'),
  projectId: required('FIREBASE_PROJECT_ID'), storageBucket: required('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: required('FIREBASE_MESSAGING_SENDER_ID'), appId: required('FIREBASE_APP_ID')
};
const httpUrl = (key, optional = true) => {
  const value = String(values[key] || '').trim().replace(/\/$/, '');
  if (!value && optional) return '';
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${key} debe ser una URL HTTPS sin credenciales.`);
  return value;
};
const adminAuthMode = values.PUBLIC_ADMIN_AUTH_MODE || 'email';
const imageStorage = values.PUBLIC_IMAGE_STORAGE === 'firebase' ? 'firebase-storage' : (values.PUBLIC_IMAGE_STORAGE || 'product-inline-base64');
if (!['email', 'phone'].includes(adminAuthMode)) throw new Error('PUBLIC_ADMIN_AUTH_MODE invalido.');
if (!['product-inline-base64', 'firebase-storage'].includes(imageStorage)) throw new Error('PUBLIC_IMAGE_STORAGE invalido.');
const app = { storeName: values.PUBLIC_STORE_NAME || 'Mi Kiosco', currency: 'S/', currencyCode: 'PEN', phoneCountry: '+51' };
const upgrade = {
  apiBaseUrl: httpUrl('PUBLIC_API_URL'), mediaApiBaseUrl: httpUrl('PUBLIC_MEDIA_API_URL'),
  firebaseVapidKey: values.PUBLIC_FIREBASE_VAPID_KEY || '', enableCallMeBot: values.PUBLIC_ENABLE_CALLMEBOT === 'true',
  storeUrl: httpUrl('PUBLIC_STORE_URL', false), adminAuthMode, imageStorage, systemVersion: '1.27.3'
};
fs.writeFileSync(path.join(root, 'web/js/config.js'), '// Generated from the root .env. Only public client configuration.\n' +
  `window.FIREBASE_CONFIG = Object.freeze(${JSON.stringify(firebase, null, 2)});\n` +
  `window.APP_CONFIG = ${JSON.stringify(app, null, 2)};\n` +
  `window.KIOSCO_UPGRADE_CONFIG = Object.freeze(${JSON.stringify(upgrade, null, 2)});\n`);
fs.writeFileSync(path.join(root, 'kiosco-app/src/config.generated.js'), '// Generated from the root .env. No server secrets.\n' +
  `export const firebaseConfig = Object.freeze(${JSON.stringify(firebase, null, 2)});\n` +
  `export const publicConfig = Object.freeze(${JSON.stringify(upgrade, null, 2)});\n`);
console.log('Configuracion publica regenerada: web y Expo.');

fs.writeFileSync(path.join(root, 'kiosco-app/src/core.generated.js'),
  '// Generated from web/js/core.js. Edit the source, not this file.\n' +
  fs.readFileSync(path.join(root, 'web/js/core.js'), 'utf8') + '\nexport default globalThis.KioscoCore;\n');
