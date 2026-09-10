# Entorno de pruebas

`core.test.mjs`: validación y cálculos sin dependencias externas.

`browser-smoke.py`: DOM/canvas/Bootstrap locales. Usa `firebase-double.js` para servicios y exportadores simulados. No toca producción y no es un emulador de Security Rules.

`vendor/`: Bootstrap 5.3.6 solo para pruebas aisladas, con su cabecera de licencia MIT. La versión de producción se declara en `web/index.html`. No contiene fuentes de terceros.

Alcance y pasos: `../docs/PRUEBAS.md`.
