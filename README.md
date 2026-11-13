# Malaria 3.0

PWA para registrar asistencia a las juntadas con QR, tiempos de estadía y estadísticas del grupo.
Next.js 16 (App Router) + Supabase + Tailwind 4.

## Puesta en marcha

### 1. Supabase
1. Crear un proyecto en https://supabase.com (región São Paulo, la más cercana).
2. Aplicar la migración `supabase/migrations/20261113000000_esquema_inicial.sql`:
   - Opción A (CLI): `npx supabase login` → `npx supabase link --project-ref <REF>` → `npx supabase db push`
   - Opción B (a mano): pegar el archivo en Dashboard → SQL Editor → Run.
3. **Plantilla de mail (obligatorio para el login por código):**
   Dashboard → Authentication → Emails → Templates → **Magic Link**. Reemplazar el cuerpo por algo como:
   ```html
   <h2>Tu código para Juntadas</h2>
   <p style="font-size:32px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
   <p>Vence en 1 hora.</p>
   ```
   Sin `{{ .Token }}` el mail llega con un link y no con el código.
4. Habilitar `pg_cron` (Database → Extensions) y correr en el SQL Editor:
   ```sql
   select cron.schedule('cerrar-juntadas-vencidas', '*/15 * * * *', $$select public.cerrar_vencidas()$$);
   ```
5. Después de entrar por primera vez, hacerte admin:
   ```sql
   update public.perfiles set rol = 'admin' where apodo = 'TU_APODO';
   ```

> El servidor de mail incluido en Supabase manda pocos mails por hora (pensado para pruebas).
> Para que entre todo el grupo el mismo día conviene configurar SMTP propio
> (Authentication → Emails → SMTP Settings; por ejemplo Resend o Brevo, ambos con plan gratis).

### 2. App
```bash
cp .env.example .env.local   # completar URL y publishable key
npm install
npm run dev
```

La cámara del celular solo funciona con HTTPS. Para probar el escaneo en el teléfono, publicá una
vista previa (por ejemplo en Vercel) o usá un túnel; `localhost` sirve solo en la compu.

## Cómo se usa
1. Cualquiera **propone** una juntada (Inicio → Proponer) y comparte el link por WhatsApp.
2. Cada uno entra y dice **a qué hora llega** (se puede cambiar hasta esa hora).
3. El que la propuso (o un admin) toca **Arrancar** y después **Escanear QR**.
4. Primer escaneo = llegada · segundo = salida. Si alguien se olvida: botón de puerta → salida manual (ahora o con hora).
5. **Finalizar** cierra las salidas pendientes. Si nadie la finaliza, a las 12 h del inicio se cierra sola
   (esas horas no cuentan para las estadísticas).
6. Link fijo para el grupo: `https://TU-DOMINIO/activa` → abre la juntada en curso.

## Estructura
```
app/
  login/                     ingreso con código de 6 dígitos
  activa/route.ts            link fijo a la juntada en curso
  (app)/                     todo lo que requiere sesión (protegido en proxy.ts)
    page.tsx                 inicio: en curso, propuestas, últimas
    juntada/nueva/           proponer
    juntada/[id]/            vista en vivo (tiempo real) + panel del anfitrión
    juntada/[id]/escanear/   cámara y registro de entradas/salidas
    perfil/                  mi QR, apodo, regenerar QR, cerrar sesión
    stats/                   insignias y ranking
  manifest.ts                manifiesto PWA
components/                  UI (juntada, perfil, stats, ui)
lib/                         Supabase, fechas (hora de Buenos Aires), insignias, tipos
proxy.ts                     refresca sesión y redirige a /login
supabase/migrations/         esquema SQL (tablas, permisos, funciones, vista de stats)
public/icons/                íconos de la app
```

## Publicar (Vercel)
1. Subir el proyecto a GitHub.
2. En vercel.com → Add New Project → importar el repo.
3. Cargar las dos variables de `.env.example`.
4. En Supabase → Authentication → URL Configuration: poner la URL de Vercel como Site URL.
