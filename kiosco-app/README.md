# App móvil - Expo

Cliente React Native para la misma tienda. Incluye búsqueda, carrito con variantes, pedidos y seguimiento por identidad Firebase.

## Preparar

No crees otro `.env`. Desde la raíz del repositorio ejecuta `npm run build`; la app recibe solo configuración pública y el núcleo compartido generado.

```bash
cd kiosco-app
npm ci
npm run doctor
npm start
```

Utiliza un dispositivo o emulador compatible con el SDK Expo declarado. `prestart` regenera la configuración desde el único `.env` raíz.

## Firebase

Activa el proveedor Anónimo y publica las reglas revisadas. El nombre y teléfono son datos de contacto; el historial se consulta por UID, no por coincidencia de nombre. La identidad se conserva en AsyncStorage, pero no migra automáticamente entre dispositivos.

Los pedidos releen precios, ofertas y stock en una transacción y registran reservas. Las notificaciones del backend son opcionales y usan token Firebase; dejar `PUBLIC_API_URL` vacío evita depender de Vercel. Un error al guardar el comprobante después de crear el pedido se informa sin duplicar la compra.

## Validación pendiente

Se revisaron archivos e imports y se validó la sintaxis JSX; no se instaló ni compiló Expo en esta entrega. Ejecuta `expo-doctor`, prueba Android/iOS, selector de imágenes, compartir PDF y persistencia antes de distribuirla. Firebase Hosting no compila ni publica esta app.
