# 🛍️ Kiosco PWA

> Aplicación web progresiva para gestionar tu tienda digital en tiempo real — hecha para Perú 🇵🇪

![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange?logo=firebase)
![PWA](https://img.shields.io/badge/PWA-Instalable-blue?logo=googlechrome)
![License](https://img.shields.io/badge/Licencia-MIT-green)

---

## 🌐 Demo en vivo

👉 **[https://mi-kiosco-c7313.web.app](https://mi-kiosco-c7313.web.app)**

---

## ✨ Funcionalidades

### Para clientes (público)
- 🗂️ Navegación por categorías y subcategorías en tiempo real
- 🔍 Buscador de productos instantáneo
- 🛒 Carrito de compras persistente
- 📤 Compartir pedido por WhatsApp (texto o recibo PDF)
- 📱 Instalable como app en celular y computadora (PWA)

### Para el administrador
- 🔐 Login seguro por número de teléfono peruano (+51), sin contraseña
- 📊 Dashboard con ventas del día, semana y mes
- 📈 Gráfico en tiempo real (ventas + pedidos)
- 📋 Gestión de pedidos: Pendiente → Hecho / Rechazado
- 🔔 Notificación instantánea de nuevos pedidos
- 🏷️ CRUD completo de productos con vista previa de imagen
- 📂 Categorías y subcategorías ilimitadas
- 📥 Descarga de reportes en CSV

---

## 🗂️ Estructura del proyecto

```
kiosco/
├── index.html              # App principal
├── offline.html            # Página sin conexión
├── manifest.json           # Config PWA
├── sw.js                   # Service Worker
├── firebase.json           # Config Firebase Hosting
├── firestore.rules         # Reglas de seguridad
├── firestore.indexes.json  # Índices de consultas
│
├── css/
│   ├── variables.css       # Tokens de diseño + tema claro/oscuro
│   ├── main.css            # Layout principal y responsive
│   ├── components.css      # Botones, cards, modales, carrito
│   ├── animations.css      # Animaciones y micro-interacciones
│   └── extras.css          # Notificaciones, PWA banner, print
│
└── js/
    ├── config.js           # 🔐 Credenciales Firebase (NO subir a GitHub)
    ├── firebase.js         # Inicialización Firebase
    ├── auth.js             # Autenticación por teléfono (multi-admin)
    ├── store.js            # Tienda pública en tiempo real
    ├── cart.js             # Carrito de compras
    ├── admin.js            # Panel de administración
    ├── dashboard.js        # Estadísticas y gráfico
    ├── orders.js           # Gestión de pedidos
    ├── notifications.js    # Alertas de nuevos pedidos
    ├── share.js            # Compartir por WhatsApp
    ├── ui-helpers.js       # Utilidades UI
    └── app.js              # Orquestador principal
```

---

## 🚀 Instalación local

### Requisitos
- Node.js v20 o superior
- Cuenta de Firebase (plan Spark gratuito)

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/Stefannysalsajimenez/mi-kiosco.git
cd mi-kiosco

# 2. Copiar y configurar credenciales
cp js/config.example.js js/config.js
# Editar js/config.js con tus credenciales de Firebase

# 3. Servir localmente
python -m http.server 8080
# Abrir http://localhost:8080
```

---

## ⚙️ Configuración Firebase

### 1. Crear proyecto en Firebase Console
- Activar **Firestore Database**
- Activar **Phone Authentication**
- Agregar dominio en Authentication → Dominios autorizados

### 2. Número de administrador en Firestore
Crea manualmente en Firestore:
```
Colección: config
Documento: admin
Campo:     phones (array)
Valores:   "+51XXXXXXXXX", "+51XXXXXXXXX"
```
> ⚠️ El número nunca se guarda en el código — solo en Firestore.

### 3. Números de prueba (sin SMS real)
En Authentication → Método de acceso → Teléfono → Números de prueba:
```
+51XXXXXXXXX  →  código: 123456
```

---

## 🔐 Seguridad

| Archivo | ¿Se sube a GitHub? |
|---|---|
| `js/config.js` | ❌ Nunca (está en `.gitignore`) |
| `js/config.example.js` | ✅ Sí (sin credenciales reales) |
| `firestore.rules` | ✅ Sí |
| `.firebaserc` | ✅ Sí |

---

## 🌐 Deploy en Firebase Hosting

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login y deploy
firebase login
firebase deploy
```

URL resultante: `https://TU-PROYECTO.web.app`

---

## 📊 Base de datos — Estructura Firestore

```
config/admin          → phones: ["+51...", "+51..."]
products/{id}         → name, price, categoryId, active, imageUrl...
categories/{id}       → name, emoji, parentId
orders/{id}           → customer, items[], total, status, createdAt
```

---

## 🛠️ Tecnologías usadas

| Tecnología | Uso |
|---|---|
| HTML5 / CSS3 / JS vanilla | Frontend sin frameworks |
| Firebase Firestore | Base de datos en tiempo real |
| Firebase Authentication | Login por teléfono |
| Firebase Hosting | Despliegue web |
| Chart.js | Gráfico del dashboard |
| Service Worker | Soporte offline (PWA) |
| WhatsApp API | Compartir pedidos |

---

## 📱 Instalar como app

**Android (Chrome):** Menú → "Agregar a pantalla de inicio"  
**iOS (Safari):** Compartir → "Agregar a pantalla de inicio"  
**PC (Chrome/Edge):** Ícono 📲 en la barra de dirección

---

## 📄 Licencia

MIT © 2026 — Hecho con ❤️ para emprendedores peruanos
