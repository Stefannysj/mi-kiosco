'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    const filename = path.join(directory, item.name);
    return item.isDirectory() ? walk(filename) : [filename];
  });
}
function verify(root = ROOT) {
  const required = ['web/index.html', 'web/js/config.js', 'web/js/core.js', 'web/js/features.js', 'web/js/auth.js', 'web/js/cart.js', 'web/js/app.js', 'web/sw.js', 'firestore.rules', 'firebase.json'];
  for (const item of required) if (!fs.existsSync(path.join(root, item))) throw new Error(`Falta ${item}. El ZIP debe integrarse con el repositorio existente.`);
  let checked = 0;
  for (const filename of walk(path.join(root, 'web')).filter(name => name.endsWith('.js'))) {
    const source = fs.readFileSync(filename, 'utf8');
    new vm.Script(source, { filename });
    if (/(?:signInAnonymously|signInWithEmailAndPassword|createUserWithEmailAndPassword)\s*\(/.test(source)) throw new Error(`Se detecto autenticacion no permitida en ${filename}.`);
    if (/Activa el acceso An[o\u00f3]nimo/i.test(source)) throw new Error(`Queda el aviso antiguo en ${filename}.`);
    if (/Auth\.ensureClient\s*\(/.test(source)) throw new Error(`Queda una integracion antigua en ${filename}.`);
    checked++;
  }
  const config = fs.readFileSync(path.join(root, 'web/js/config.js'), 'utf8');
  if (!config.includes('mi-kiosco-c7313') || /REEMPLAZAR|YOUR_API_KEY|TU_API_KEY/.test(config)) throw new Error('Conserva web/js/config.js con la configuracion real de mi-kiosco-c7313. No se genera ni se reemplaza automaticamente.');
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  const exact = /match\s+\/orders\/\{id\}\s*\{\s*allow create: if true;\s*allow read: if true;\s*allow update, delete: if request\.auth != null;\s*\}/;
  if (!exact.test(rules)) throw new Error('El bloque orders no coincide con la politica solicitada.');
  const features = fs.readFileSync(path.join(root, 'web/js/features.js'), 'utf8');
  if (!features.includes('// KIOSCO_LOCAL_CLIENT_FIX_20260913_V1')) throw new Error('Ejecuta node scripts/prepare-local-client.cjs antes de verificar.');
  const firebase = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
  if (firebase.hosting.public !== 'web' || firebase.firestore.rules !== 'firestore.rules') throw new Error('El destino de Hosting o de reglas es incorrecto.');
  console.log(`${checked} archivos web JavaScript: sintaxis correcta; sin login por correo ni anonimo.`);
  console.log('Configuracion existente conservada; bloque orders verificado. Esto no reemplaza una prueba de reglas en el emulador.');
}
if (require.main === module) {
  try {
    verify();
    const result = spawnSync(process.execPath, ['--test', path.join(ROOT, 'tests/local-client.test.cjs')], { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('Fallaron las pruebas locales. No se debe publicar.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { verify };
