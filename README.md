# Backend opcional

Funciones Node.js para notificaciones, estadísticas, PDF y compatibilidad con imágenes del repositorio. No es necesario para operar el flujo básico de la web en Spark y no se publica mediante `firebase deploy`.

## Configuración

Usa únicamente `../.env` en desarrollo. En Vercel configura las variables privadas equivalentes en el panel del proyecto; no crees otro archivo `.env` ni subas una cuenta de servicio al repositorio. La cuenta de servicio debe pertenecer al proyecto correcto y tener solo los permisos necesarios.

```bash
npm ci
npm run check
npm run dev
```

En el proveedor, la carpeta raíz es `kiosco-api`. Tras configurar y validar el servicio, actualiza `PUBLIC_API_URL` en el `.env` raíz y ejecuta `npm run build` desde la raíz. El despliegue remoto del backend es independiente.

## Rutas y acceso

| Ruta | Requisito |
| --- | --- |
| `POST /api/notify` | Token Firebase y propiedad del pedido; control de reintentos. |
| `POST /api/whatsapp` | Token, pedido propio y número autorizado expresamente en configuración privada. |
| `GET /api/stats` | Administrador reconocido. |
| `POST /api/boleta` | Administrador; genera representación PDF y correlativo. |
| `GET /api/boleta` | Enlace con token de recibo público habilitado. |
| `POST /api/media` | Administrador; compatibilidad con almacenamiento local/GitHub. |

Se reconocen claims administrativos, `ADMIN_UIDS` o la configuración autorizada de `config/admin`. La autorización no depende del rol guardado por el navegador.

No se ejecutaron aquí el servidor real, sus credenciales ni las llamadas externas. Este directorio conserva rutas opcionales, no una promesa de backend comercial gratuito. Revisa condiciones y cuotas del proveedor. Los PDF son informativos: no incorporan certificación tributaria ni envío a SUNAT.
