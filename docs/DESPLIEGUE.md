# Despliegue y migración

## Preparación

Trabaja sobre una carpeta limpia. Esta revisión reemplaza varios archivos `.js` con JSX por `.jsx`; copiar encima del proyecto anterior puede dejar dos versiones y cargar la equivocada. Conserva por separado tu repositorio original y una copia de tus configuraciones y datos. No se incluyó ni ejecutó una migración de la base de producción.

El `.env` de la raíz es la única fuente local. `npm run build` genera `web/js/config.js`, `kiosco-app/src/config.generated.js` y la copia del núcleo compartido para Expo. No edites las copias generadas. Solo se exporta una lista explícita de valores públicos; las claves de servidor permanecen fuera de Hosting.

## Acceso en Spark

1. En Firebase Authentication activa Anónimo y Correo/contraseña. El formulario visible del panel usa celular + contraseña; Correo/contraseña se usa solo como proveedor técnico de Firebase.
2. Copia su UID y agrégalo al arreglo `uids` del documento `config/admin`. Conserva campos existentes como `phones` y `fcmTokens`. Un rol escrito en localStorage no concede permisos.
3. Autoriza `mi-kiosco-c7313.web.app` y el dominio adicional que utilices. Para propietario o personal, crea primero su cuenta técnica y registra su UID y permisos.

Ejemplo del campo que se agrega, sin reemplazar el documento completo:

```json
{ "uids": ["UID_REAL_DEL_ADMINISTRADOR"] }
```

El panel no usa SMS. Para un celular peruano `9XXXXXXXX`, crea en Firebase Authentication una cuenta Email/Password con el correo técnico `phone.519XXXXXXXX@mi-kiosco-c7313.firebaseapp.com` y la contraseña elegida. Luego autoriza su UID en `config/admin` o `config/staff`. Los clientes usan identidad anónima más nombre/teléfono de contacto.

## Historial e inventario existentes

Los pedidos nuevos llevan `ownerId`. Un cliente solo solicita sus pedidos por UID. Los pedidos antiguos sin propietario verificable permanecen visibles al personal autorizado, pero no se asignan a un cliente solo porque coincida su nombre o teléfono. Cualquier migración de esos pedidos necesita un mapeo confiable aprobado por el negocio.

La identidad anónima pertenece a la sesión/dispositivo; borrar los datos del navegador, cerrar esa sesión o usar otro equipo puede impedir recuperar ese historial. No se implementó vinculación de cuentas de cliente ni recuperación por SMS.

Los pedidos nuevos reservan unidades mediante `stockReservations`. Al completar se confirma la reserva; al rechazar se devuelve una sola vez; al reabrir se verifica y reserva nuevamente. Los pedidos previos sin reserva verificable no inflan el stock automáticamente: revisa manualmente su inventario. Antes de aprobar pedidos, verifica importes y el pago con el negocio.

La nueva web no activa persistencia de Firestore en IndexedDB. En equipos compartidos que usaron versiones anteriores, cierra la sesión y limpia los datos antiguos del sitio. Guarda primero cualquier carrito necesario; borrar datos puede eliminar la identidad anónima.

## Imágenes

En Spark se usa `PUBLIC_IMAGE_STORAGE=product-inline-base64`. La imagen se comprime y guarda con el producto; una URL externa también es válida. Esta modalidad consume almacenamiento, lecturas y transferencia de Firestore; no es almacenamiento ilimitado ni un sustituto para catálogos muy grandes.

Para un proyecto que YA tenga Blaze y un bucket operativo, la opción es `PUBLIC_IMAGE_STORAGE=firebase`. Sus reglas se publican separadamente, nunca en el despliegue Spark:

```bash
# Solo cuando se haya aprobado y configurado Blaze:
firebase deploy --config firebase.storage.json --only storage --project mi-kiosco-c7313
```

El progreso porcentual corresponde a bytes informados por el SDK de Storage. La compresión local se muestra como trabajo indeterminado, no como una transferencia ficticia. La limpieza física se limita a rutas propias de productos/logos y verifica referencias compartidas. No se eliminan archivos de servidores externos. Una limpieza remota fallida muestra aviso y no revierte un producto ya guardado.

Las imágenes externas pueden visualizarse y aun así impedir su lectura por canvas por CORS. El PDF indica las ausentes; no evade las restricciones del servidor remoto.

## Publicación

Instala Node.js 22.16 o superior y Firebase CLI. Desde la raíz:

```bash
npm ci
npm run build
npm run verify
npm test
firebase login
firebase deploy --project mi-kiosco-c7313
```

`firebase.json` publica solo `web/` y las reglas/índices de Firestore. El predeploy vuelve a generar la configuración y verifica el paquete. No copies `.env` a `web/`, no uses reglas abiertas para resolver un error y no ejecutes el seeder contra producción.

El compilador de reglas y la autorización real no se ejecutaron en esta entrega. Antes de publicar, prueba en un proyecto aislado o Emulator Suite las cuentas anónima, cliente, empleado y administrador; las consultas privadas; el checkout; y las transiciones de stock. La web no está conectada a emuladores por defecto: no abras la configuración de producción suponiendo que opera localmente.

Después de publicar, recarga la PWA para activar la nueva versión y prueba en dos sesiones separadas. Verifica una compra, una anulación, una imagen, una importación con filas erróneas y ambos exportadores con las bibliotecas reales.

## Backend y app móvil

Firebase Hosting no despliega automáticamente Vercel ni compila Expo. Ambos directorios conservan su propio README. El backend es opcional: dejar vacío `PUBLIC_API_URL` evita depender de él para la tienda básica. Las variables remotas del proveedor no son archivos `.env` adicionales.

## Reversión

Conserva la versión anterior del código y las reglas. No restaures reglas de lectura pública de pedidos como procedimiento de reversión. Los nuevos campos son aditivos; volver a una versión antigua exige revisar su compatibilidad con `ownerId`, variantes y reservas antes de aceptar pedidos.
