# Control de Extintores — App web

App web instalable (PWA) para trazabilidad, inspección con NFC y alarmas de vencimiento de extintores.
Funciona sin señal, se instala como ícono en Android y no tiene costo (Supabase + GitHub en planes gratuitos).

---

## 0. Probarla ya (modo demo)

Con `js/config.js` vacío, la app arranca en **modo demo**: trae datos de ejemplo y guarda todo solo en ese dispositivo.
Sirve para recorrer las pantallas antes de crear las cuentas.

---

## 1. Qué hay en esta carpeta

| Archivo | Para qué |
| --- | --- |
| `index.html`, `css/`, `js/` | La app |
| `js/config.js` | **Único archivo a editar**: datos de Supabase |
| `sw.js`, `manifest.webmanifest`, `icons/` | Instalación en el celular y funcionamiento sin señal |
| `supabase/schema.sql` | Crea la base de datos, permisos y checklist inicial |
| `scripts/alarmas.mjs` + `.github/workflows/alarmas.yml` | Mail diario de alarmas |

---

## 2. Crear la base de datos (Supabase) — 10 minutos

1. Entrar a <https://supabase.com> con una **cuenta de mail de la empresa** y crear un proyecto (plan Free).
   Región sugerida: São Paulo. Guardar la contraseña de la base.
2. Ir a **SQL Editor → New query**, pegar todo el contenido de `supabase/schema.sql` y tocar **Run**.
3. Ir a **Authentication → Sign In / Providers → Email** y **desactivar "Confirm email"**.
   (Así los usuarios que crea Seguridad pueden entrar al toque. Dejar habilitado "Allow new users to sign up": cualquier alta que no haga Seguridad queda inactiva y no ve nada.)
4. Crear el primer usuario de Seguridad:
   - **Authentication → Users → Add user**: mail + contraseña, marcar *Auto Confirm User*.
   - En **SQL Editor** ejecutar (con tu mail):
     ```sql
     update public.perfiles set rol = 'seguridad', activo = true where email = 'tu.mail@empresa.com';
     ```
5. Ir a **Project Settings → API** y copiar:
   - **Project URL**
   - **anon public key**
   - **service_role key** (secreta, solo para las alarmas; nunca va en la app)

## 3. Configurar la app

Abrir `js/config.js` y completar:

```js
SUPABASE_URL: "https://xxxxxxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...",
EMPRESA: "Nombre de la empresa",
```

La clave *anon* puede ser pública: la seguridad la dan las reglas de la base (usuarios inactivos no ven nada; operadores solo cargan inspecciones).

## 4. Publicarla en una URL (GitHub Pages, gratis)

1. Crear una cuenta en <https://github.com> (mail de la empresa).
2. **New repository** → nombre `extintores` → *Public* → Create.
3. **Add file → Upload files** → arrastrar **todo el contenido** de esta carpeta (incluida la carpeta oculta `.github`; si no se sube arrastrando, crearla a mano con *Add file → Create new file* y el nombre `.github/workflows/alarmas.yml`).
4. **Settings → Pages** → *Source: Deploy from a branch* → *Branch: main / root* → Save.
5. En 1–2 minutos queda en: `https://USUARIO.github.io/extintores/`
6. En Supabase: **Authentication → URL Configuration → Site URL** = esa URL (para los mails de "olvidé mi contraseña").

> Alternativa: Cloudflare Pages o Netlify (arrastrar la carpeta). Cualquier hosting con HTTPS sirve; NFC y cámara **necesitan HTTPS**.

## 5. Instalar en los celulares

1. Abrir la URL en **Chrome para Android**.
2. Menú ⋮ → **Agregar a pantalla principal / Instalar app**.
3. Ingresar con mail y contraseña (el primer ingreso necesita señal).
4. Activar el **NFC** del teléfono (Ajustes → Conexiones → NFC).

**NFC solo funciona en Chrome Android.** En iPhone o PC se usa todo lo demás buscando el extintor por código.
Etiquetas recomendadas: **NTAG213 o NTAG215** (para metal: versión *anti-metal / on-metal*).

## 6. Alarmas por mail (GitHub Actions, gratis)

Corre todos los días a las 08:07 (hora Argentina):
- **Vencidos y observados:** mail todos los días hasta que se actualice el dato.
- **Próximos a vencer (≤30 días) e inspecciones atrasadas:** resumen los lunes, y aviso el día que entran en los 30 días.
- Lo reciben los usuarios de **Seguridad** activos con "Recibe alarmas" tildado.

Configuración (en el repositorio: **Settings → Secrets and variables → Actions → New repository secret**):

| Secret | Valor |
| --- | --- |
| `SUPABASE_URL` | Project URL de Supabase |
| `SUPABASE_SERVICE_KEY` | service_role key |
| `SMTP_HOST` | `smtp.gmail.com` (u `smtp.office365.com`) |
| `SMTP_PORT` | `465` (Gmail) o `587` (Office 365) |
| `SMTP_USER` | mail que envía las alarmas |
| `SMTP_PASS` | contraseña de aplicación de ese mail* |
| `APP_URL` | URL de la app (opcional, va como link en el mail) |

\* Gmail: activar verificación en 2 pasos y crear una **contraseña de aplicación** en <https://myaccount.google.com/apppasswords>.

Para probarla: pestaña **Actions → Alarmas de extintores → Run workflow**.

Esta tarea diaria además mantiene activo el proyecto de Supabase (el plan gratuito pausa proyectos sin uso).
GitHub puede desactivar tareas programadas de repositorios sin cambios durante 60 días: si pasa, volver a habilitarla en *Actions*.

## 7. Uso diario

**Seguridad**
- *Más → Ubicaciones / Vehículos*: cargar bases, talleres (con GPS) y patentes.
- *Extintores → +*: dar de alta cada equipo y tocar **Leer** para vincular su etiqueta NFC.
- *Más → Usuarios → +*: crear operadores (mail + contraseña inicial). Editar para dar de baja o cambiar rol.
- *Ficha del extintor*: registrar recarga o PH, cambiar NFC, resolver observaciones.
- *Más → Exportar a Excel*: hojas Extintores, Inspecciones y Vencimientos.

**Operador**
- Botón rojo **Escanear** → apoyar el celular en la etiqueta → checklist → 1 o 2 fotos → Guardar.
- Sin señal se guarda igual; el indicador de arriba muestra "pendientes" y se suben solas al volver la cobertura.

## 8. Límites del plan gratuito (verificar al crear las cuentas)

- Fotos: se comprimen a ~200 KB. 200 extintores × 2 fotos × inspección mensual ≈ 1 GB/año, que es aproximadamente el espacio de archivos del plan Free de Supabase. Revisar el uso una vez por año (Supabase → Storage) y, si hace falta, borrar fotos viejas o pasar a un plan pago.
- Base de datos: sobra para este volumen.

## 9. Datos técnicos

- Frontend sin compilación: HTML + JS. Librerías por CDN: supabase-js, Leaflet (mapa, OpenStreetMap) y SheetJS (Excel).
- Offline: IndexedDB + cola de cambios; cada inspección lleva un ID generado en el celular, así no se duplica al reintentar.
- Vencimientos: recarga cada 12 meses y PH cada 60 meses por defecto, editables por extintor.
- Al publicar una versión nueva, cambiar `VERSION` en `sw.js` para que los celulares la actualicen.
