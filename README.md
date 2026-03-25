# SIGELX — Sistema de Gestión y Localización de la Asociación Llano San José

Visor GIS interactivo para la gestión de socios y cartografía municipal de la pedanía **Llano San José** (Elche, Alicante). Combina un mapa vectorial con un panel privado de administración para la Junta Directiva.

**Producción:** https://llanosanjose.github.io/mapa

---

## Características

### Mapa interactivo
- Cartografía municipal vectorial de Elche (callejero, términos, partidas rurales, humedales…)
- Ortofotos PNOA del IGN como capa de fondo opcional
- Plano urbanístico A2 11-C (1997) georreferenciado
- Capas de fases del proyecto (Fase 1 y Fase 1B)
- Gestión de capas: visibilidad, opacidad y reordenación
- Herramienta de medición de distancias
- Buscador de calles y números de policía con zoom automático

### Área privada (Junta Directiva)
- Autenticación con Supabase Auth
- **Gestión de socios**: alta, edición, baja y reactivación
- **Filtro vinculado al mapa**: al filtrar en el panel, los marcadores del mapa se actualizan en tiempo real
- Visualización de socios sobre el mapa con código de colores (cuota pagada / pendiente / baja)
- Popup de información al hacer clic en un marcador
- Buscador de dirección con previsualización del socio en esa dirección
- **Gestión de usuarios** (rol Presidente): invitar, cambiar rol, revocar acceso
- **Generación de recibos** en PDF (individual, todos o en blanco)
- Importación y exportación de socios en CSV (delimitado por `|`)

### Diseño
- Interfaz adaptada a móvil y escritorio (paneles laterales → bottom sheets en móvil)
- Modo claro / oscuro con persistencia en `localStorage`
- Paleta Slate + acento Cyan

---

## Tecnologías

| Librería | Uso |
|---|---|
| [OpenLayers 10](https://openlayers.org/) | Motor GIS — capas vectoriales y ráster |
| [Supabase](https://supabase.com/) | Base de datos PostgreSQL + autenticación |
| [jsPDF](https://github.com/parallax/jsPDF) | Generación de recibos en PDF |
| [Vite 6](https://vitejs.dev/) | Bundler y servidor de desarrollo |
| Nunito / IBM Plex Mono | Tipografía (via Fontsource) |

---

## Estructura del proyecto

```
SIGELX/
├── public/
│   ├── cartografia_elche/   # GeoJSON de cartografía municipal
│   │   ├── viario.geojson       # Red viaria (callejero)
│   │   ├── ndpu.geojson         # Números de policía
│   │   └── …                    # Resto de capas temáticas
│   ├── plan_A2_11C_geo.jpg  # Plano georreferenciado
│   ├── recibos_logo.jpg     # Logo para recibos PDF
│   └── favicon.svg
├── src/
│   ├── main.js          # Punto de entrada: mapa, capas, eventos globales
│   ├── admin.js         # Panel de administración y gestión de socios
│   ├── layers.js        # Definición de capas GIS
│   ├── membersLayer.js  # Capa de socios sobre el mapa
│   ├── search.js        # Buscador de calles y números
│   ├── auth.js          # Helpers de autenticación y roles
│   ├── receipts.js      # Generación de PDFs de recibos
│   ├── measure.js       # Herramienta de medición de distancias
│   ├── georeference.js  # Utilidad de georreferenciación de planos
│   ├── toast.js         # Notificaciones toast
│   ├── supabase.js      # Cliente Supabase
│   └── style.css        # Estilos globales (modo oscuro/claro)
├── index.html
├── vite.config.js
└── .env                 # Variables de entorno (no incluido en git)
```

---

## Puesta en marcha en desarrollo

### 1. Requisitos previos

- **Node.js** ≥ 18
- **npm** ≥ 9
- Una instancia de **Supabase** con las tablas `socios` y `perfiles` (ver esquema más abajo)

### 2. Clonar e instalar dependencias

```bash
git clone https://github.com/llanosanjose/mapa.git
cd mapa
npm install
```

### 3. Configurar variables de entorno

Crea un fichero `.env` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_KEY=<tu-anon-public-key>
```

Ambos valores se obtienen en **Supabase → Project Settings → API**.

### 4. Arrancar el servidor de desarrollo

```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

> El servidor sirve automáticamente los ficheros GeoJSON de `public/cartografia_elche/` sin restricciones de sistema de ficheros.

---

## Comandos disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR en `localhost:3000` |
| `npm run build` | Genera el bundle de producción en `dist/` |
| `npm run preview` | Previsualiza el build de producción localmente |

### Build para GitHub Pages

La variable de entorno `GITHUB_PAGES=true` ajusta la base URL al repositorio:

```bash
GITHUB_PAGES=true npm run build
```

---

## Esquema de base de datos (Supabase)

### Tabla `socios`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` | Clave primaria (auto) |
| `nombre` | `text` | Nombre del socio |
| `apellidos` | `text` | Apellidos |
| `telefono` | `text` | Teléfono (opcional) |
| `email` | `text` | Email (opcional) |
| `kcalle` | `integer` | Código de calle (FK implícita a `viario.geojson`) |
| `num_poli` | `text` | Número de policía |
| `dir_display` | `text` | Dirección formateada para mostrar |
| `fecha_alta` | `date` | Fecha de alta en la asociación |
| `cuota_pagada` | `boolean` | Estado de pago de la cuota |
| `anno_cuota` | `integer` | Año al que corresponde la cuota |
| `fecha_baja` | `date` | Fecha de baja (null = activo) |
| `notas` | `text` | Notas libres (opcional) |

### Tabla `perfiles`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` | Clave primaria (coincide con `auth.users.id`) |
| `email` | `text` | Email del usuario |
| `rol` | `text` | `presidente` · `administrativo` · `vocal` |

### Roles y permisos

| Rol | Puede ver socios | Puede editar | Gestiona usuarios |
|---|:---:|:---:|:---:|
| `presidente` | ✓ | ✓ | ✓ |
| `administrativo` | ✓ | ✓ | — |
| `vocal` | ✓ (solo lectura) | — | — |

---

## Atajos de teclado

| Tecla | Acción |
|---|---|
| `L` | Abrir / cerrar panel de capas |
| `F` | Enfocar el buscador de calles |
| `Esc` | Cerrar popup del mapa |
