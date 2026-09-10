# Revisión técnica - 1.27.3

Base: ZIP `mi-kiosco-main(1).zip` proporcionado por el usuario. Trabajo realizado en una copia local. No se escribió en Firebase, GitHub, Vercel ni en la base de producción.

## Correcciones

| Área | Cambios principales |
| --- | --- |
| Configuración | Un `.env` raíz, generador con lista pública permitida, comandos de verificación reales y predeploy. |
| Sintaxis | Validación de todos los JS propios y separación de JSX; referencias locales verificadas. |
| Consultas | Sin `.orderBy()` en código productivo; ordenamiento local y filtros de periodo en horario de Lima. |
| Acceso | UID/claims/telefonía verificada para privilegios; cliente anónimo; opción administrativa por correo para Spark; limpieza de suscripciones al salir. |
| Permisos | Pedidos por propietario, configuraciones privadas, UID del personal y revocación de acceso; proyecciones públicas de recibos sin datos de contacto. |
| Carrito | Líneas independientes por variante, stock compartido, redondeo en centavos, persistencia y renderizado desktop/offcanvas coherentes. |
| Precios | Descuento sobre el precio base y adicionales de variante separados; oferta vigente sin sobreprecio; checkout relee productos y oferta. Repetir pedido usa variantes válidas y precios actuales. |
| Pedidos | Reserva transaccional, anulación idempotente, reapertura con validación de stock y eliminación de comprobantes asociados. |
| Excel de productos | Validación por fila, precios/cantidades/categorías/activo/URLs, errores aislados y resumen; evita repetir filas ya importadas en un reintento. |
| PDF de catálogo | Lectura fresca de productos, categorías y oferta; imagen raster real mediante canvas; fallback y conteo de imágenes no disponibles. |
| Excel de dashboard | Respeta el filtro activo; ingresos contabilizan pedidos completados. |
| Imágenes | Compatibilidad con base64/URLs/Storage, vista previa, fallback sin bucle, progreso del SDK y limpieza de activos propios no compartidos. |
| Responsive | Buscadores sticky, sidebar oculto bajo 992 px, offcanvas, columnas sin ancho Bootstrap duplicado, stock/precio sin recorte y modales adaptados. |
| Productos/categorías | Precios en centavos, selecciones actualizadas y bloqueo del borrado de categorías con productos asociados. |
| Caja/gastos/horario | Montos validados, fecha de Lima, totales numéricos, campos escapados, guardado del horario utilizado por la tienda. |
| Personal/auditoría | Permisos por UID o teléfono, eliminación que revoca índices y limpieza de listeners administrativos. |
| Recibos/apariencia | Lectura pública por token de proyección limitada, actualización de recibos existentes y gestión segura de logos. |
| Backend | Token Firebase para notificaciones, verificación de propiedad, idempotencia, límites de entrada y endurecimiento de imágenes remotas en PDF. |
| Expo | Configuración compartida, identidad anónima persistente, historial por UID, variantes, stock/precios transaccionales y separación JSX. |
| PWA/QR | Caché versionada, exclusión de APIs/autenticación/recibos sensibles y adaptador para la biblioteca QR de navegador. |

## Decisiones y límites

**Spark.** La entrega no habilita Blaze. Por defecto no usa Storage ni SMS reales; conserva sus rutas opcionales. No se promete gratuidad ilimitada: las cuotas de Firebase y las condiciones de servicios externos siguen aplicando. Vercel no es necesario para el flujo básico entregado.

**Clientes y pedidos antiguos.** El contacto no equivale a identidad verificada por teléfono. Los pedidos anteriores sin `ownerId` no se reasignan por coincidencia de nombres. Se conserva su acceso administrativo. La sesión anónima no ofrece historial entre dispositivos.

**Autorización.** Se endurecieron reglas, pero no se compiló ni ejecutó el emulador real aquí. El doble de pruebas NO certifica reglas. Las reglas de creación limitan la forma/propietario del pedido y relacionan decrementos con el pedido atómico; no demuestran todos los cálculos comerciales de cada línea contra un cliente manipulado. El administrador debe verificar pago/importes antes de completar. El bloqueo por teléfono de contacto no constituye una medida antifraude fuerte.

**Caja.** La apertura/cierre continúan guardándose en localStorage por dispositivo. No es una caja centralizada multiusuario ni conciliación bancaria. Las ventas mostradas incluyen todos los medios de pago; el efectivo contado debe interpretarse por separado. Se preservó esta arquitectura, no se agregó un sistema contable nuevo.

**Inventario previo.** Solo se restituyen automáticamente cantidades con reserva o confirmación verificable. Los pedidos antiguos requieren revisión manual; el proceso no inventa movimientos históricos.

**Imágenes.** Las URLs externas dependen de disponibilidad y CORS. El PDF no puede eludir las restricciones del servidor. El modo inline consume documentos/transferencia de Firestore; para grandes volúmenes se requiere reevaluar almacenamiento y lecturas. Fallos remotos al borrar un archivo pueden requerir limpieza manual, informada al usuario.

**Escalabilidad.** Ordenar solo en cliente obliga a descargar las coincidencias y algunos reportes leen colecciones completas. Cumple la restricción solicitada, pero no equivale a paginación eficiente para catálogos o historiales masivos. No se realizó carga contra producción.

**Recibos.** Son representaciones informativas. No se implementó emisión electrónica certificada, XML firmado ni integración tributaria. El token de recibo permite compartirlo; trátalo como enlace sensible.

**Dependencias.** Bootstrap de producción apunta a 5.3.8 y jsPDF a 4.2.1. El SDK web compat 10.7.1 y la familia Expo 54/React Native 0.81.5 se conservaron para evitar una migración mayor no probada. No se ejecutaron `npm audit`, instalación completa de dependencias ni compilación nativa. No se afirma que cada dependencia sea la última versión disponible.

**Cobertura.** Se revisó el código local y se incluyó un inventario. Una comprobación de sintaxis o un botón visible no equivale a validación exhaustiva de cada combinación de datos. `PRUEBAS.md` separa lo ejecutado de lo pendiente.

## Referencias de plataforma

Consultadas el 10 de septiembre de 2026:

- Firebase Authentication: https://firebase.google.com/docs/auth/limits
- Firebase Storage: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- Reglas y despliegue: https://firebase.google.com/docs/rules/manage-deploy
- Bootstrap: https://getbootstrap.com/docs/5.3/getting-started/introduction/
- jsPDF: https://github.com/parallax/jsPDF/releases
- Canvas/CORS: https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/CORS_enabled_image
