# Pruebas ejecutadas

La evidencia corresponde a la copia local, sin operaciones sobre producción.

| Comprobación | Resultado |
| --- | --- |
| Verificación estática del paquete | 187 comprobaciones, 0 fallos |
| `node --check` | 46 archivos JS/MJS/CJS (45 propios y Bootstrap de prueba), 0 errores de sintaxis |
| JSX con TypeScript | 10 archivos, 0 errores de sintaxis |
| JSON/configuraciones | 13 archivos válidos |
| Pruebas unitarias de núcleo | 47 aprobadas, 0 fallos |
| Pruebas de navegador | 90 aprobadas, 0 fallos |

## Reproducir

```bash
npm ci
npm run build
npm run verify
npm test
```

Para la prueba aislada de navegador instala Python, Playwright y Chromium:

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
npm run test:browser
```

Se puede definir `CHROME_BIN` para usar un ejecutable Chromium instalado. El test usa `page.set_content`, datos en memoria y archivos locales. No navega a Firebase ni a localhost; no toca producción.

## Qué se ejecutó

Núcleo: decimales, centavos, fechas/períodos de Lima, variantes obligatorias, claves de carrito, URLs seguras, importaciones válidas/erróneas, descuentos y ofertas vigentes/vencidas.

Navegador: visitante, intento de privilegios desde localStorage y administrador. Anchos de 320, 375, 768, 991, 992, 1280 y 1440 px. Ausencia de scroll horizontal, ancho legible de tarjetas, sidebar bajo 992 px, posición sticky de ambos buscadores y búsqueda limitada al título del producto. También valida el formulario del propietario con celular + contraseña, Phone Authentication con reCAPTCHA y contraseña de 6 dígitos y la versión 1.30.3 en Soporte. Offcanvas móvil y listas de carrito sincronizadas, cantidades, variantes y checkout con UID, precio y stock.

Formularios: creación de producto y categoría, bloqueo de borrado de categoría usada, alta/baja de personal por UID, registro de gasto, guardado de horario, apertura/cierre de caja y montos negativos. Pedidos: completar, rechazar, repetir rechazo, reabrir y eliminar pendiente, comprobando stock.

Imágenes: callback porcentual del SDK simulado, borrado de ruta propia, no borrado de URL externa, fallback DOM sin bucle y conversión canvas real a JPEG base64. Exportaciones: filas de importación erróneas sin abortar, fallo de escritura simulado, periodo activo de Excel, lectura fresca para PDF y paso de imagen real al generador simulado. Cierre de sesión y consola sin errores/warnings inesperados en los recorridos ejecutados.

## Qué NO demuestra esta prueba

Firebase Auth, Firestore y Storage son **dobles locales**, no servicios reales. No ejecutan Security Rules, revocación real, concurrencia/reintentos de transacciones, cuotas, SMS ni CORS real de terceros. La prueba con rol administrativo verifica el recorrido de un usuario autorizado simulado; no sustituye la prueba real de ingreso por celular + contraseña.

XLSX y jsPDF también son dobles. Se prueba el flujo y los datos enviados, no la lectura binaria de un Excel ni el PDF final en un lector. La conversión de imagen con canvas sí usa el navegador real. Las dependencias externas, QR, cámara, GPS, notificaciones, impresión y reinstalación PWA requieren comprobación real.

Bootstrap local de prueba es 5.3.6; la web publicada por el paquete usa 5.3.8. Las fuentes/iconos remotos no se cargan en el entorno aislado. Las capturas pueden mostrar espacios de iconos o imágenes simuladas. No se ejecutó Safari, Firefox, dispositivos iOS/Android ni la compilación Expo. La comprobación sticky es de CSS calculado, no una prueba exhaustiva de desplazamiento en todos los navegadores.

La navegación a los once módulos no certifica todas sus acciones. Auditoría, recibos y apariencia se inspeccionaron en código y montaje; requieren ejercicio completo con identidad real y sus bibliotecas/proveedores.

## Evidencia incluida

Las pruebas generan `test-results/` localmente. Esa carpeta no se incluye en el paquete limpio ni en Git porque es evidencia temporal reproducible. `docs/INVENTARIO.md` distingue código, recursos y controles aplicados.

## Aceptación antes de producción

Verifica reglas con cuentas de distintos roles y accesos cruzados denegados; cuentas reales y cierre de sesión; compras concurrentes; precios/ofertas/variantes; reanudación del carrito; rechazo/reapertura; importación Excel real; PDF con imágenes locales/externas; permisos del personal; recibos compartidos; dos navegadores y un teléfono. No retires estas pruebas por el hecho de que la sintaxis pase.
