# Estudion

Pequeña aplicación privada para que Elena apunte sus exámenes y las asignaturas que más le cuestan, y para que **tú recibas recordatorios por correo** antes de cada examen y puedas escribirle o llamarla a tiempo.

- **Elena** (estudiante): ve sus próximos exámenes, añade/edita/elimina exámenes y asignaturas.
- **Tú** (ayudante): ves todo en solo lectura, configuras los plazos de aviso y consultas si los correos se han enviado.

Tecnologías: React + TypeScript + Vite, Tailwind CSS, Supabase (base de datos y login) y Vercel (web + tarea programada diaria). Correo con Resend.

---

## Cómo funciona

| Pieza | Archivo | Qué hace |
|---|---|---|
| Web | `src/` | Interfaz en español. Solo usa la clave **pública** de Supabase. |
| Base de datos | `supabase/migrations/*.sql` | Tablas, permisos y políticas RLS, todo en un esquema propio `estudion` (puede compartir proyecto de Supabase con otra app). |
| Tarea diaria | `api/cron/reminders.ts` + `vercel.json` | Vercel la ejecuta cada día a las 07:00 UTC (08:00–09:59 en Madrid). Calcula qué avisos tocan y envía **un solo correo** con todos ellos. |
| Reglas de avisos | `shared/reminders.ts` | Plazos, regla de asignaturas difíciles y ventanas de envío. |
| Correo | `api/_lib/email.ts` | Asignatura, fecha, días restantes, dificultad, nota, otros exámenes próximos y enlace a la app. |

**Plazos por defecto:** 14, 7, 3 y 1 día antes. Los cambias en la pestaña **Avisos** de tu cuenta.

**Regla para asignaturas difíciles:** si la asignatura tiene dificultad 4 o 5, se añade un aviso extra `X` días antes del primer plazo (por defecto 7, así que el primer aviso llega 21 días antes en lugar de 14). Puedes cambiar `X` (o ponerlo a 0) en **Avisos**.

**Sin duplicados:** cada aviso (examen + fecha + plazo) se guarda en la tabla `reminder_log` con una restricción única, así que nunca se envía dos veces, ni siquiera si Vercel lanza el cron dos veces. Si un envío falla, se reintenta al día siguiente mientras ese plazo siga vigente (máximo 5 intentos) y el error aparece en tu historial.

**Si falla un día o el examen se añade tarde:** cada plazo cubre los días hasta el siguiente. Si Elena apunta un examen que es dentro de 5 días, recibes el aviso de 7 días ese mismo día (uno solo, no tres).

**Seguridad:** no hay registro público. Todas las tablas tienen RLS. Los visitantes no autenticados no tienen acceso a nada. Tu cuenta solo puede leer los datos de Elena. La clave secreta de Supabase, la de Resend y `CRON_SECRET` solo existen en Vercel (servidor), nunca en el navegador. El endpoint del cron rechaza cualquier petición sin `Authorization: Bearer <CRON_SECRET>`.

---

## Coste

Todo funciona con planes gratuitos:

| Servicio | Plan | Límites relevantes |
|---|---|---|
| Supabase | Free | 2 proyectos gratis (Estudion puede ir dentro de uno que ya tengas, ver paso 3). ⚠️ Los proyectos gratuitos **se pausan tras 7 días sin actividad**; la consulta diaria del cron debería mantenerlo activo, pero si ves que se pausa, reactívalo desde el panel (o pasa a Pro, de pago). |
| Vercel | Hobby | Solo uso personal/no comercial. Cron **una vez al día** como máximo, con precisión de ±59 min. Suficiente para avisos por días. |
| Resend | Free | 3.000 correos/mes, 100/día. Sin dominio propio solo puedes enviarte correos **a ti mismo** (la dirección de tu cuenta de Resend). |
| Dominio propio | Opcional, **de pago** | Solo si quieres enviar a otras direcciones o desde un remitente propio. |

---

## Guía paso a paso

> 🔐 Nunca compartas contraseñas ni claves secretas en un chat, issue o captura de pantalla. Las claves secretas van solo en `.env.local` (que no se sube a GitHub) y en Vercel.

Pasos **obligatorios**: 1–13 y 14. **Opcionales**: los marcados como tal.

### 1. Qué instalar en tu ordenador

- **Node.js 22.12 o superior** (LTS): <https://nodejs.org>. Comprueba con `node -v`.
- **Git**: <https://git-scm.com>. Comprueba con `git --version`.
- Cuentas gratuitas en **GitHub**, **Supabase**, **Vercel** y **Resend**.
- Opcional: GitHub CLI (`gh`) y Vercel CLI (`npm i -g vercel`).

### 2. Instalar dependencias y ejecutar en local

```bash
npm install
cp .env.example .env.local     # en PowerShell: Copy-Item .env.example .env.local
```

Rellena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env.local` (pasos 3–6) y luego:

```bash
npm run dev        # abre http://localhost:5173
```

Otros comandos:

```bash
npm test           # pruebas (incluye las políticas RLS sobre un Postgres real en memoria)
npm run typecheck  # comprobación de TypeScript
npm run build      # compilación de producción (hace también el typecheck)
```

**Modo sin conexión (opcional):** para probar el frontend sin Supabase, pon `VITE_USE_MOCKS=true` en `.env.local` y reinicia `npm run dev`. La app usa datos de prueba guardados en el navegador (`src/lib/mockSupabase.ts`). Entra con `elena` (estudiante) o `david` (ayudante) y cualquier contraseña. El botón «Reiniciar datos» de la pantalla de acceso restaura los datos iniciales. No la actives en Vercel.

> `npm run dev` solo sirve la web. La tarea programada (`/api/cron/reminders`) solo se ejecuta en Vercel. Si quieres probarla en local, es opcional: `npx vercel dev` (requiere `npx vercel link`).

### 3. Elegir el proyecto de Supabase

**Opción A — reutilizar un proyecto que ya tienes** (lo normal si ya usas los 2 proyectos gratuitos):

Estudion guarda todo en su propio esquema `estudion`, así que no toca las tablas de `public` de la otra aplicación. Lo que **sí se comparte** con ella:

- **Los usuarios** (`auth.users`): las cuentas de Elena y la tuya aparecerán junto a las de la otra app, y sus usuarios podrían iniciar sesión en Estudion. Solo verían “Tu cuenta aún no está configurada”: sin perfil en `estudion.profiles`, RLS no les deja ver ni crear nada (está probado en `tests/db.test.ts`).
- **La configuración de Auth**: Site URL, plantillas de correo y si se permite el registro (ver paso 7).
- **La clave secreta**: la `SUPABASE_SERVICE_ROLE_KEY` que pondrás en Vercel da acceso total también a los datos de la otra app. Trátala con el mismo cuidado.
- **Los límites del plan gratuito** (500 MB de base de datos, etc.). Estudion ocupa muy poco. Como ventaja, la actividad de ambas apps evita que el proyecto se pause.
- **Triggers sobre `auth.users`:** si la otra app crea filas automáticamente al registrarse alguien (p. ej. una función `handle_new_user`), también se ejecutará al crear las cuentas de Elena y la tuya. Normalmente no pasa nada; revísalo en *Database → Triggers* si la otra app es delicada.

Antes de seguir, comprueba que el proyecto no tiene ya un esquema llamado `estudion` (*Database → Schemas*).

**Opción B — proyecto nuevo:** <https://supabase.com/dashboard> → **New project**, nombre `estudion`, contraseña de base de datos fuerte (la app no la necesita) y una región europea (*West EU (Ireland)* o *Central EU (Frankfurt)*).

### 4. Ejecutar la migración SQL y exponer el esquema

1. En el proyecto: **SQL Editor** → **New query**.
2. Abre `supabase/migrations/20261022000000_init.sql`, copia **todo** el contenido, pégalo y pulsa **Run**.
   Después, en una consulta nueva, haz lo mismo con `supabase/migrations/20261025000000_subject_color.sql` (añade el color de las asignaturas). **Si ya tenías la app instalada, ejecuta solo esta.**
   Y después, en este orden, `supabase/migrations/20261026000000_subject_icon.sql` y `supabase/migrations/20261027000000_subject_icon_colors.sql` (icono dibujado de cada asignatura, con varios colores).
3. Debe terminar con *Success. No rows returned*. En **Table Editor**, cambiando el selector de esquema de `public` a `estudion`, verás: `profiles`, `helper_links`, `subjects`, `exams`, `reminder_settings`, `reminder_log`.
4. **Expón el esquema en la API** (obligatorio): **Project Settings → Data API → Exposed schemas** (en algunos paneles, *Settings → API*), añade `estudion` a la lista **sin quitar los que ya hay** (la otra app los necesita) y guarda. Si te lo salta, la app mostrará “El esquema "estudion" no está expuesto…”.

> Ejecútalo una sola vez. Si lo repites, fallará con "already exists" (es normal; no hace falta volver a ejecutarlo).
>
> Opcional, con la CLI de Supabase: `npx supabase login`, `npx supabase link --project-ref <ref>` y `npx supabase db push`.

### 5. Obtener la URL y la clave pública

En **Project Settings → API Keys** (o con el botón **Connect** arriba):

- **Project URL**: `https://<ref>.supabase.co` → `VITE_SUPABASE_URL`.
- **Publishable key** (`sb_publishable_...`), o la antigua **anon** si tu proyecto la muestra → `VITE_SUPABASE_ANON_KEY`. Es pública: puede ir en el navegador porque RLS protege los datos.
- **Secret key** (`sb_secret_...`), o la antigua **service_role** → `SUPABASE_SERVICE_ROLE_KEY`. ⚠️ **Secreta**: salta RLS. Solo en Vercel, nunca con prefijo `VITE_`.

### 6. Variables de entorno

| Variable | Dónde | Secreta | Valor |
|---|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` y Vercel | No | URL del proyecto |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` y Vercel | No | Clave publishable/anon |
| `VITE_USE_MOCKS` | Solo `.env.local` (opcional) | No | `true` para usar datos de prueba sin Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo Vercel | **Sí** | Clave secret/service_role |
| `CRON_SECRET` | Solo Vercel | **Sí** | Cadena aleatoria de 32+ caracteres |
| `RESEND_API_KEY` | Solo Vercel | **Sí** | API key de Resend |
| `EMAIL_FROM` | Solo Vercel | No | `Estudion <onboarding@resend.dev>` o tu remitente verificado |
| `APP_URL` | Solo Vercel | No | `https://<tu-proyecto>.vercel.app` (enlace del correo) |

Para generar `CRON_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

En local solo necesitas las dos `VITE_*`. El cron lee la URL de `VITE_SUPABASE_URL` (o de `SUPABASE_URL` si la defines).

### 7. Configurar la autenticación y las URL de redirección

En **Authentication**:

1. **Sign In / Providers** (o *Providers → Email*): deja **Email** activado.
   - Proyecto solo para Estudion: **desactiva “Allow new users to sign up”**.
   - Proyecto compartido: déjalo como lo necesite la otra app. Aunque esté activado, Estudion no tiene pantalla de registro y una cuenta nueva no ve ningún dato hasta que la vinculas con `setup_accounts`.
2. **URL Configuration**:
   - **Site URL**: proyecto compartido → **no la cambies** (es la de la otra app). Proyecto nuevo → `https://<tu-proyecto>.vercel.app` (mientras tanto `http://localhost:5173`).
   - **Redirect URLs**: añade `http://localhost:5173` y `https://<tu-proyecto>.vercel.app` (sin borrar las de la otra app).

Estas URL las usa el enlace de “¿Has olvidado la contraseña?”.

> ⚠️ El servidor de correo integrado de Supabase solo envía correos a los **miembros de tu equipo de Supabase** y con un límite muy bajo por hora. Por tanto, el restablecimiento de contraseña funciona para ti, pero **no para Elena** salvo que configures un SMTP propio (opcional: *Authentication → Emails → SMTP Settings*, por ejemplo con Resend y un dominio verificado). Ver “Errores habituales” para cambiar una contraseña desde SQL.

### 8. Crear la cuenta de Elena y la tuya

En **Authentication → Users → Add user → Create new user**, dos veces:

- Correo de Elena + contraseña. Marca **Auto Confirm User**.
- Tu correo + contraseña. Marca **Auto Confirm User**.

Lo ideal es que Elena escriba su propia contraseña en ese momento (a tu lado), o que se la des en persona. No la mandes por chat.

Las contraseñas las guarda Supabase cifradas (bcrypt); la app nunca las almacena.

### 9. Vincular las cuentas y comprobar permisos

En **SQL Editor**, sustituye los correos y nombres y ejecuta:

```sql
select estudion.setup_accounts('correo-de-elena@ejemplo.com', 'tu-correo@ejemplo.com', 'Elena', 'Tu nombre');
```

Esto crea los perfiles (Elena = `student`, tú = `helper`), el vínculo entre ambos y tus preferencias de avisos con los plazos por defecto. Los avisos se envían al correo de tu cuenta (puedes cambiarlo en la pestaña **Avisos**). Esta función solo puede ejecutarse desde el SQL Editor; la app no tiene permiso para llamarla.

Comprueba:

```sql
select p.display_name, p.role, u.email from estudion.profiles p join auth.users u on u.id = p.id;
select * from estudion.reminder_settings;
```

Después, en `npm run dev`:

- Entra como Elena: crea una asignatura (p. ej. Historia, dificultad 5) y un examen.
- Cierra sesión y entra con tu cuenta: debes ver ese examen y la asignatura, sin botones para editarlos. Aunque alguien lo intentara desde la consola del navegador, la base de datos lo rechaza (RLS).

### 10. Crear el repositorio en GitHub y subir el proyecto

```bash
git init
git add .
git commit -m "Estudion: primera versión"
```

Crea un repositorio **privado** en <https://github.com/new> llamado `estudion` (sin README ni .gitignore) y:

```bash
git branch -M main
git remote add origin https://github.com/<tu-usuario>/estudion.git
git push -u origin main
```

(Opcional, con GitHub CLI: `gh repo create estudion --private --source=. --push`.)

Antes de subir, comprueba que `.env.local` **no** aparece en `git status` (está en `.gitignore`).

### 11. Importar en Vercel y desplegar

1. <https://vercel.com/new> → **Import** el repositorio `estudion`.
2. Vercel detecta **Vite**. Deja: Build Command `npm run build`, Output Directory `dist`.
3. Antes de pulsar **Deploy**, añade las variables del paso 12.
4. **Deploy**. Al terminar tendrás una URL tipo `https://estudion-xxxx.vercel.app`.
5. Vuelve a Supabase (paso 7) y añade esa URL en **Redirect URLs** (y como **Site URL** solo si el proyecto es exclusivo de Estudion). Ponla también en la variable `APP_URL` de Vercel.

### 12. Variables de entorno en Vercel

**Project → Settings → Environment Variables**, para el entorno **Production** (y Preview si lo usas):

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` (ver tabla del paso 6). Marca las secretas como **Sensitive**.

> Tras añadir o cambiar variables hay que **volver a desplegar** (Deployments → ⋯ → Redeploy). Las `VITE_*` se incrustan en la web al compilar.

### 13. Tarea programada (cron)

Ya está configurada en `vercel.json`:

```json
"crons": [{ "path": "/api/cron/reminders", "schedule": "0 7 * * *" }]
```

- Se ejecuta a diario a las 07:00 UTC, es decir, entre las **08:00 y 08:59 en invierno** y **09:00 y 09:59 en verano** (hora de Madrid; en el plan Hobby la hora exacta varía dentro de esa hora).
- Solo se ejecuta en el despliegue de **producción**.
- Compruébalo en **Project → Settings → Cron Jobs**: verás `/api/cron/reminders`. Desde ahí puedes pulsar **Run** para lanzarlo a mano y **View Logs** para ver el resultado.
- Vercel envía automáticamente `Authorization: Bearer <CRON_SECRET>`. Sin `CRON_SECRET` el endpoint responde 500 y no hace nada; con una cabecera incorrecta, 401.
- Si quieres otra hora, cambia el `schedule` (formato cron, en UTC) y vuelve a desplegar. En Hobby no se permite más de una ejecución al día.

### 14. Configurar el envío de correos y comprobar que funciona

1. Crea una cuenta en <https://resend.com> **con el mismo correo en el que quieres recibir los avisos** (sin dominio propio, Resend solo permite enviarte correos a esa dirección).
2. **API Keys → Create API Key** (permiso *Sending access*). Cópiala a `RESEND_API_KEY` en Vercel.
3. `EMAIL_FROM` = `Estudion <onboarding@resend.dev>`.
4. Asegúrate de que el correo de la pestaña **Avisos** de tu cuenta coincide con el de Resend.
5. Vuelve a desplegar.
6. Envía un **correo de prueba** (no registra ningún aviso). Desde PowerShell (usa `curl.exe`, no `curl`):

   ```powershell
   curl.exe -H "Authorization: Bearer PEGA_AQUI_TU_CRON_SECRET" "https://<tu-proyecto>.vercel.app/api/cron/reminders?test=1"
   ```

   Respuesta esperada: `{"today":"...","results":[{"test":true,"ok":true,...}]}` y un correo “[Prueba] …” en tu bandeja (mira también en spam).

7. Para ver **qué avisos tocarían hoy** sin enviar ni guardar nada:

   ```powershell
   curl.exe -H "Authorization: Bearer PEGA_AQUI_TU_CRON_SECRET" "https://<tu-proyecto>.vercel.app/api/cron/reminders?dry=1"
   ```

8. Prueba real: pide a Elena (o entra con su cuenta) que añada un examen para dentro de 3 días y pulsa **Run** en *Settings → Cron Jobs*. Recibirás el correo y en tu pestaña **Avisos → Historial de envíos** aparecerá como *Enviado*. Si vuelves a pulsar **Run**, no se envía otra vez.

*Opcional — enviar a cualquier dirección o con remitente propio:* en Resend, **Domains → Add Domain**, añade los registros DNS que te indique en tu proveedor de dominio (de pago) y cambia `EMAIL_FROM` a algo como `Estudion <avisos@tudominio.com>`.

> Mientras falte `RESEND_API_KEY` o `EMAIL_FROM`, los avisos **no se envían**: quedan como *Error* en el historial con el mensaje “Correo sin configurar…”, y se reintentan al día siguiente.

### 15. Verificar la privacidad y que no hace falta tener la web abierta

**Datos privados:**

- Sin iniciar sesión, la API no devuelve nada. Pruébalo con la clave pública:

  ```powershell
  curl.exe "https://<ref>.supabase.co/rest/v1/exams?select=*" -H "apikey: TU_CLAVE_PUBLISHABLE" -H "Accept-Profile: estudion"
  ```

  Debe responder con un error `permission denied for schema estudion` (código `42501`), nunca con datos.
- Con tu cuenta (ayudante), no hay botones de edición, y la base de datos rechaza cualquier escritura en `subjects` y `exams`.
- Las mismas comprobaciones están automatizadas en `tests/db.test.ts` (`npm test`): anónimo sin acceso, Elena solo con sus datos, ayudante en solo lectura, usuarios de la otra app sin acceso, sin acceso a datos no vinculados y sin duplicados en los avisos.
- En el navegador (F12 → Sources) solo aparece la clave publishable; nunca la secreta.

**Recordatorios sin la web abierta:** el envío lo hace el servidor de Vercel cada mañana. No depende de que Elena ni tú tengáis la app abierta. Para comprobarlo, cierra todas las pestañas, pulsa **Run** en *Settings → Cron Jobs* (o espera al día siguiente) y revisa **View Logs** y tu correo.

### 16. Errores habituales

| Síntoma | Causa probable y solución |
|---|---|
| La web muestra “Faltan VITE_SUPABASE_URL…” | Falta `.env.local` (local) o las variables en Vercel. En Vercel, tras añadirlas, **Redeploy**. |
| “Correo o contraseña incorrectos” | Revisa el correo. Si no recuerdas la contraseña, ver la fila siguiente. |
| Elena no recibe el correo de recuperación | El SMTP integrado de Supabase solo envía a miembros del equipo. Configura SMTP propio, o cambia su contraseña desde SQL Editor: `update auth.users set encrypted_password = extensions.crypt('NUEVA_CONTRASEÑA', extensions.gen_salt('bf')) where email = 'correo-de-elena@ejemplo.com';` (escríbela directamente en el editor, no la compartas). |
| “Tu cuenta existe pero aún no está configurada” | Falta el paso 9 (`setup_accounts`). Si es un usuario de la otra app, es lo esperado. |
| “El esquema "estudion" no está expuesto…” (o `PGRST106` / `Invalid schema`) | Añade `estudion` en *Project Settings → Data API → Exposed schemas* (paso 4). |
| La migración falla con `schema "estudion" already exists` | Ya existe ese esquema en el proyecto (quizá de un intento anterior). Si es de un intento anterior y está vacío, bórralo con `drop schema estudion cascade;` (⚠️ borra todo lo que contenga) y repite. |
| Error al ejecutar `estudion.setup_accounts`: “No existe ningún usuario…” | El correo no coincide con el de *Authentication → Users*. |
| “No tienes permiso para hacer esto” | Estás intentando editar con la cuenta de ayudante, o los roles se asignaron al revés: vuelve a ejecutar `setup_accounts` con los correos en el orden correcto (primero Elena). |
| El cron responde 401 | `CRON_SECRET` en Vercel no coincide con el de tu cabecera, o no se redesplegó tras crearlo. |
| El cron responde 500 “Faltan SUPABASE…” | Falta `SUPABASE_SERVICE_ROLE_KEY` (o la URL) en Vercel. |
| Historial: “Resend 403/422 … only send testing emails to your own email” | Sin dominio verificado solo puedes enviar al correo de tu cuenta de Resend. Pon ese correo en **Avisos → Enviar a**, o verifica un dominio. |
| Historial: “Correo sin configurar” | Falta `RESEND_API_KEY` o `EMAIL_FROM` en Vercel. |
| No aparece el cron en Vercel | Solo existe en producción. Comprueba que `vercel.json` está en el repositorio y que hay un despliegue de producción. |
| El deploy falla con “Hobby accounts are limited to daily cron jobs” | Has puesto un `schedule` de más de una vez al día. |
| No llega ningún aviso aunque hay exámenes | Mira **Avisos → Próximos recordatorios**: puede que aún no toque. Comprueba que los avisos están activados y revisa *Cron Jobs → View Logs*. Usa `?dry=1` para ver qué tocaría hoy. |
| El proyecto de Supabase está “Paused” | Plan gratuito sin actividad. Pulsa **Restore project** en el panel. |
| Al borrar una asignatura avisa de que se borrarán exámenes | Es intencionado: una asignatura con exámenes solo se puede borrar junto con ellos (la app lo pide confirmar). Si solo quieres cambiarle el nombre o la dificultad, edítala. |

---

## Estructura del proyecto

```
api/cron/reminders.ts     Endpoint del cron (Vercel Function)
api/_lib/                 Plan de avisos y plantilla del correo
shared/                   Fechas (Europe/Madrid, DD/MM/AAAA) y reglas de avisos, compartidas con la web
src/                      Aplicación React
  pages/student/          Pantallas de Elena (exámenes y asignaturas)
  pages/helper/           Pantallas del ayudante (resumen, avisos, historial)
supabase/migrations/      Esquema SQL, permisos y RLS
tests/                    Pruebas (Vitest + PGlite)
vercel.json               Configuración del cron
```

## Ampliar en el futuro

El esquema admite más de un ayudante por estudiante (tabla `helper_links`). Para añadir una funcionalidad, crea una nueva migración en `supabase/migrations/` en lugar de modificar la inicial.
#   a l e r t a e s t u d i o  
 