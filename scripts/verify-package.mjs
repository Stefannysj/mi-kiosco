#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const skipped = new Set(['node_modules', '.git', '.expo', '.firebase', 'test-results']);
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => skipped.has(entry.name) ? [] : entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]); }
const files = walk(root), failures = [];
let checks = 0, js = 0, jsx = 0, json = 0;
const check = (condition, message) => { checks++; if (!condition) failures.push(message); };
let ts;
for (const candidate of ['typescript', '/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript']) { try { ts = require(candidate); break; } catch {} }
for (const file of files) {
  const relative = path.relative(root, file), ext = path.extname(file);
  if (['.js', '.mjs', '.cjs'].includes(ext)) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    js++; check(result.status === 0, `${relative}: ${result.stderr}`);
  }
  if (ext === '.jsx') {
    jsx++;
    if (!ts) { check(false, 'Ejecuta npm ci: TypeScript es necesario para validar JSX.'); continue; }
    const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, reportDiagnostics: true,
      compilerOptions: { allowJs: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
    const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
    check(!errors.length, `${relative}: ${errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n')}`);
  }
  if (ext === '.json' || path.basename(file) === '.firebaserc') {
    json++; try { JSON.parse(fs.readFileSync(file, 'utf8')); check(true, ''); } catch (e) { check(false, `${relative}: ${e.message}`); }
  }
  if (['.js','.jsx'].includes(ext) && !relative.startsWith('tests')) {
    const source = fs.readFileSync(file, 'utf8');
    check(!/\.orderBy\s*\(/.test(source), `${relative}: ordenamiento Firestore prohibido; usa JavaScript.`);
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
      const target = path.resolve(path.dirname(file), match[1]);
      check(['', '.js', '.jsx', '.json', '/index.js', '/index.jsx'].some(ext => fs.existsSync(target + ext)), `${relative}: import no resuelto ${match[1]}`);
    }
  }
}
const environments = files.filter(file => /^\.env(?:\.|$)/.test(path.basename(file)));
check(environments.length === 1 && path.basename(environments[0]) === '.env' && path.dirname(environments[0]) === root, 'Debe existir exactamente un .env, en la raiz.');
const firebase = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json')));
check(firebase.hosting.public === 'web', 'Hosting debe publicar solo web/.');
check(!firebase.storage, 'El deploy Spark no debe intentar desplegar Storage.');
const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
const authSource = fs.readFileSync(path.join(root, 'web/js/auth.js'), 'utf8');
const storeSource = fs.readFileSync(path.join(root, 'web/js/store.js'), 'utf8');
const featuresSource = fs.readFileSync(path.join(root, 'web/js/features.js'), 'utf8');
const mobileStoreSource = fs.readFileSync(path.join(root, 'kiosco-app/src/screens/StoreScreen.jsx'), 'utf8');
check(html.includes('id=\"adminPhonePasswordForm\"') && html.includes('id=\"adminPhone\"') && html.includes('id=\"adminPassword\"'), 'El acceso admin debe pedir celular y contrasena.');
check(!html.includes('id=\"adminEmail\"') && !html.includes('recaptchaContainer') && !html.includes('adminCode'), 'El acceso admin no debe mostrar correo ni OTP/SMS.');
check(authSource.includes('signInPhonePassword') && authSource.includes('phone.51'), 'Auth debe mapear celular+contrasena al alias tecnico de Firebase.');
check(/function productMatchesSearch\(product\)[\s\S]*?normalizeSearch\(product\.name \|\| ''\)\.includes\(searchQuery\)/.test(storeSource), 'La busqueda cliente debe usar solo el titulo del producto.');
check(featuresSource.includes("const productTitle = normalize(product.name || '');") && !featuresSource.includes('Buscar por nombre, descripcion o categoria'), 'La busqueda admin debe usar solo el titulo del producto.');
check(mobileStoreSource.includes("String(product.name || '').toLocaleLowerCase('es').includes(term)") && !mobileStoreSource.includes('[product.name, product.description]'), 'La busqueda movil debe usar solo el titulo del producto.');
check(featuresSource.includes("const VERSION = '1.30.3'") && featuresSource.includes("KIOSCO_SYSTEM_BUILD = '1.30.3'"), 'Soporte debe mostrar la version 1.30.3.');
for (const match of html.matchAll(/(?:src|href)="((?:js|css|icons|docs)\/[^"?#]+)[^"]*"/g)) check(fs.existsSync(path.join(root,'web',match[1])), `Recurso local faltante: ${match[1]}`);
for (const relative of ['web/js/config.js','kiosco-app/src/config.generated.js']) {
  const source = fs.readFileSync(path.join(root,relative),'utf8');
  check(!/BEGIN (?:RSA )?PRIVATE KEY|FIREBASE_SERVICE_ACCOUNT_BASE64|KIOSCO_GITHUB_TOKEN|CALLMEBOT_CLIENT_KEYS_JSON/.test(source), `${relative}: contiene secretos del servidor.`);
}
const summary = { checks, jsSyntax: js, jsxSyntax: jsx, json, failures };
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
fs.writeFileSync(path.join(root, 'test-results/static.json'), JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
if (failures.length) process.exitCode = 1;
