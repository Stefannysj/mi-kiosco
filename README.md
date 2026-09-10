# Mi Kiosco

PWA para vender productos, recibir pedidos y administrar una tienda desde computadora, tablet o celular.

| Tienda | Administración | Uso diario |
| --- | --- | --- |
| Buscador fijo por **título del producto**, catálogo y carrito. | Pedidos, productos, caja, gastos, personal y apariencia. | Excel, PDF, recibos y reportes. |

## Acceso

El cliente entra con nombre y teléfono de contacto. El propietario entra con **número de celular + contraseña**.

Para mantener Firebase Spark sin SMS reales, el propietario usa **Firebase Phone Authentication** con un número configurado en **Números de teléfono para la prueba** y su código fijo de 6 dígitos. La pantalla lo presenta como **celular + contraseña** y la verificación web mantiene reCAPTCHA habilitado.

En Firebase Authentication activa **Teléfono** y **Anónimo**. Configura el número de prueba y su código de 6 dígitos; después conserva su UID en `config/admin.uids` o el número E.164 en `config/admin.phones`. No se guarda ninguna contraseña en Firestore.

## Configuración y publicación

El proyecto usa **un solo `.env` en la raíz**. No lo subas a GitHub. Desde la raíz:

```bash
npm ci
npm run build
npm run verify
npm test
firebase deploy --project mi-kiosco-c7313
```

El buscador del cliente, del administrador y de la app móvil filtra únicamente por el título del producto. La barra se mantiene visible al desplazarse en la web.

## Soporte

En el panel administrativo abre **Soporte** para ver los datos de contacto del desarrollador.

**Versión del sistema: 1.30.3**
