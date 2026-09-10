# Inventario de entrega

Base: ZIP proporcionado. El estado compara bytes contra ese ZIP; no implica que todos los recorridos funcionales hayan sido ejecutados. Los detalles de cobertura estan en PRUEBAS.md.

| Archivo | Estado | Control aplicado |
| --- | --- | --- |
| `.env` | Nuevo | Configuracion, documentacion o recurso conservado/revisado; ver estado. |
| `.firebaserc` | Sin cambios | Parseo JSON; parametros revisados segun uso. |
| `.gitignore` | Modificado | Configuracion, documentacion o recurso conservado/revisado; ver estado. |
| `README.md` | Modificado | Configuracion, documentacion o recurso conservado/revisado; ver estado. |
| `docs/DESPLIEGUE.md` | Nuevo | Configuracion, documentacion o recurso conservado/revisado; ver estado. |
| `docs/PRUEBAS.md` | Nuevo | Configuracion, documentacion o recurso conservado/revisado; ver estado. |
| `docs/REVISION.md` | Nuevo | Configuracion, documentacion o recurso conservado/revisado; ver estado. |
| `firebase.json` | Modificado | Parseo JSON; parametros revisados segun uso. |
| `firebase.storage.json` | Nuevo | Parseo JSON; parametros revisados segun uso. |
| `firestore.indexes.json` | Modificado | Parseo JSON; parametros revisados segun uso. |
| `firestore.rules` | Modificado | Revision de autorizacion; NO compilado ni ejecutado en emulador. |
| `kiosco-api/.gitignore` | Sin cambios | Configuracion, documentacion o recurso conservado/revisado; ver estado. |
| `kiosco-api/README.md` | Modificado | Configuracion, documentacion o recurso conservado/revisado; ver estado. |
| `kiosco-api/api/_lib/auth.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-api/api/_lib/env.js` | Nuevo | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-api/api/_lib/firebaseAdmin.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-api/api/_lib/http.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-api/api/_lib/orders.js` | Sin cambios | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-api/api/boleta.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-api/api/media.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-api/api/notify.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-api/api/stats.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-api/api/whatsapp.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-api/package-lock.json` | Modificado | Parseo JSON; parametros revisados segun uso. |
| `kiosco-api/package.json` | Modificado | Parseo JSON; parametros revisados segun uso. |
| `kiosco-api/vercel.json` | Sin cambios | Parseo JSON; parametros revisados segun uso. |
| `kiosco-app/.gitignore` | Sin cambios | Configuracion, documentacion o recurso conservado/revisado; ver estado. |
| `kiosco-app/App.jsx` | Nuevo | Parseo/transpilacion JSX; imports locales. Sin compilacion Expo. |
| `kiosco-app/README.md` | Modificado | Configuracion, documentacion o recurso conservado/revisado; ver estado. |
| `kiosco-app/app.json` | Sin cambios | Parseo JSON; parametros revisados segun uso. |
| `kiosco-app/index.js` | Sin cambios | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-app/package-lock.json` | Sin cambios | Parseo JSON; parametros revisados segun uso. |
| `kiosco-app/package.json` | Modificado | Parseo JSON; parametros revisados segun uso. |
| `kiosco-app/src/components/CartSheet.jsx` | Nuevo | Parseo/transpilacion JSX; imports locales. Sin compilacion Expo. |
| `kiosco-app/src/components/OrderModal.jsx` | Nuevo | Parseo/transpilacion JSX; imports locales. Sin compilacion Expo. |
| `kiosco-app/src/components/ProductCard.jsx` | Nuevo | Parseo/transpilacion JSX; imports locales. Sin compilacion Expo. |
| `kiosco-app/src/components/StatusBadge.jsx` | Nuevo | Parseo/transpilacion JSX; imports locales. Sin compilacion Expo. |
| `kiosco-app/src/components/VariantPicker.jsx` | Nuevo | Parseo/transpilacion JSX; imports locales. Sin compilacion Expo. |
| `kiosco-app/src/config.generated.js` | Nuevo | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-app/src/context/BrandingContext.jsx` | Nuevo | Parseo/transpilacion JSX; imports locales. Sin compilacion Expo. |
| `kiosco-app/src/core.generated.js` | Nuevo | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-app/src/screens/OrdersScreen.jsx` | Nuevo | Parseo/transpilacion JSX; imports locales. Sin compilacion Expo. |
| `kiosco-app/src/screens/StoreScreen.jsx` | Nuevo | Parseo/transpilacion JSX; imports locales. Sin compilacion Expo. |
| `kiosco-app/src/screens/TrackingScreen.jsx` | Nuevo | Parseo/transpilacion JSX; imports locales. Sin compilacion Expo. |
| `kiosco-app/src/services/firebase.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-app/src/services/orderService.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-app/src/services/receiptService.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-app/src/theme/colors.js` | Sin cambios | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-app/src/theme/theme.js` | Sin cambios | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `kiosco-app/src/utils/downloadReceipt.js` | Sin cambios | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `package-lock.json` | Modificado | Parseo JSON; parametros revisados segun uso. |
| `package.json` | Modificado | Parseo JSON; parametros revisados segun uso. |
| `scripts/apply-final-improvements.mjs` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `scripts/apply-upgrade.mjs` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `scripts/build-config.mjs` | Nuevo | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `scripts/seed-demo.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `scripts/verify-package.mjs` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `storage.rules` | Modificado | Revision de autorizacion; NO compilado ni ejecutado en emulador. |
| `test-results/admin-desktop.png` | Nuevo | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `test-results/admin-mobile.png` | Nuevo | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `test-results/browser.json` | Nuevo | Parseo JSON; parametros revisados segun uso. |
| `test-results/guest-desktop.png` | Nuevo | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `test-results/guest-mobile.png` | Nuevo | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `test-results/static.json` | Nuevo | Parseo JSON; parametros revisados segun uso. |
| `test-results/unit.tap` | Nuevo | Evidencia local de pruebas; no prueba de produccion. |
| `tests/README.md` | Nuevo | Configuracion, documentacion o recurso conservado/revisado; ver estado. |
| `tests/browser-smoke.py` | Nuevo | Ejecutado: 83 comprobaciones de navegador. |
| `tests/core.test.mjs` | Nuevo | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `tests/firebase-double.js` | Nuevo | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `tests/vendor/bootstrap.bundle.min.js` | Nuevo | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `tests/vendor/bootstrap.min.css` | Nuevo | Estilos y pruebas DOM responsive parciales; vendor preservado. |
| `web/404.html` | Sin cambios | Referencias locales; index ejercitado en DOM simulado, otras paginas inspeccion estatico. |
| `web/css/admin-sections.css` | Sin cambios | Estilos y pruebas DOM responsive parciales; vendor preservado. |
| `web/css/animations.css` | Sin cambios | Estilos y pruebas DOM responsive parciales; vendor preservado. |
| `web/css/app.css` | Modificado | Estilos y pruebas DOM responsive parciales; vendor preservado. |
| `web/css/components.css` | Sin cambios | Estilos y pruebas DOM responsive parciales; vendor preservado. |
| `web/css/dashboard-charts.css` | Sin cambios | Estilos y pruebas DOM responsive parciales; vendor preservado. |
| `web/css/extras.css` | Sin cambios | Estilos y pruebas DOM responsive parciales; vendor preservado. |
| `web/css/features.css` | Sin cambios | Estilos y pruebas DOM responsive parciales; vendor preservado. |
| `web/css/main.css` | Sin cambios | Estilos y pruebas DOM responsive parciales; vendor preservado. |
| `web/css/new-features.css` | Sin cambios | Estilos y pruebas DOM responsive parciales; vendor preservado. |
| `web/css/reset.css` | Sin cambios | Estilos y pruebas DOM responsive parciales; vendor preservado. |
| `web/css/responsive.css` | Nuevo | Estilos y pruebas DOM responsive parciales; vendor preservado. |
| `web/css/variables.css` | Sin cambios | Estilos y pruebas DOM responsive parciales; vendor preservado. |
| `web/docs/guia-caja.pdf` | Sin cambios | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `web/icons/creador.png` | Sin cambios | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `web/icons/favicon.png` | Sin cambios | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `web/icons/icon-128.png` | Sin cambios | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `web/icons/icon-144.png` | Sin cambios | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `web/icons/icon-152.png` | Sin cambios | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `web/icons/icon-192-maskable.png` | Sin cambios | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `web/icons/icon-192.png` | Sin cambios | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `web/icons/icon-32.png` | Sin cambios | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `web/icons/icon-384.png` | Sin cambios | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `web/icons/icon-512-maskable.png` | Sin cambios | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `web/icons/icon-512.png` | Sin cambios | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `web/icons/icon-72.png` | Sin cambios | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `web/icons/icon-96.png` | Sin cambios | Recurso incluido e integridad SHA-256; no auditoria funcional del contenido. |
| `web/index.html` | Modificado | Referencias locales; index ejercitado en DOM simulado, otras paginas inspeccion estatico. |
| `web/js/admin.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/js/app.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/js/auth.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/js/branding.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/js/cart.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/js/config.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/js/core.js` | Nuevo | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/js/dashboard.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/js/features.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/js/firebase.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/js/images.js` | Nuevo | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/js/invoice.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/js/notifications.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/js/orders.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/js/qr-adapter.js` | Nuevo | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/js/share.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/js/store.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/js/ui-helpers.js` | Sin cambios | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |
| `web/manifest.json` | Sin cambios | Parseo JSON; parametros revisados segun uso. |
| `web/offline.html` | Sin cambios | Referencias locales; index ejercitado en DOM simulado, otras paginas inspeccion estatico. |
| `web/sw.js` | Modificado | node --check; controles estaticos aplicables. Runtime solo donde lo identifica PRUEBAS.md. |

## Archivos retirados o reemplazados

Instalar en carpeta limpia evita mantener accidentalmente estas versiones anteriores.

- `kiosco-api/.env.example`
- `kiosco-app/.env.example`
- `kiosco-app/App.js`
- `kiosco-app/src/components/CartSheet.js`
- `kiosco-app/src/components/OrderModal.js`
- `kiosco-app/src/components/ProductCard.js`
- `kiosco-app/src/components/StatusBadge.js`
- `kiosco-app/src/context/BrandingContext.js`
- `kiosco-app/src/screens/OrdersScreen.js`
- `kiosco-app/src/screens/StoreScreen.js`
- `kiosco-app/src/screens/TrackingScreen.js`
- `web/js/config.example.js`

## Resumen

36 archivos nuevos, 45 modificados, 39 conservados, 12 rutas retiradas/reemplazadas. El propio inventario y CHECKSUMS.sha256 no se incluyen en este conteo.
