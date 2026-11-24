import { Suspense } from "react";
import Link from "next/link";
import { CalendarPlus, CalendarRange, ChevronRight, Clock, MapPin, Plus, Radio, Users } from "lucide-react";
import { fechaYHora } from "@/lib/tiempo";
import type { Juntada } from "@/lib/tipos";
import type { FechaEspecial } from "@/lib/fechas";
import { ProximaFecha, type Voy } from "@/components/fechas/ProximaFecha";
import { usuarioActual } from "@/lib/sesion";
import { CartelAvisos } from "@/components/inicio/CartelAvisos";
import { CartelNovedades } from "@/components/inicio/CartelNovedades";
import { QrLlegada } from "@/components/inicio/QrLlegada";
import { CuentaRegresiva } from "@/components/inicio/CuentaRegresiva";

export default function InicioPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between pr-12">
        <h1 className="text-2xl font-bold">Malaria 3.0</h1>
        <Link
          href="/juntada/nueva"
          className="flex items-center gap-1.5 rounded-full bg-acento px-4 py-2 text-sm font-semibold text-white active:scale-95"
        >
          <Plus className="size-4" /> Proponer
        </Link>
      </div>
      <Suspense fallback={<Esqueleto />}>
        <Listado />
      </Suspense>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-28 animate-pulse rounded-2xl bg-superficie" />
      <div className="h-20 animate-pulse rounded-2xl bg-superficie" />
      <div className="h-20 animate-pulse rounded-2xl bg-superficie" />
    </div>
  );
}

type JuntadaConConteo = Juntada & {
  confirmaciones: { perfil_id: string; va: boolean }[];
  asistencias: { perfil_id: string }[];
};

async function Listado() {
  const { supabase, uid } = await usuarioActual();
  const campos = "*, confirmaciones(perfil_id, va), asistencias(perfil_id)";

  const [
    { data: activas },
    { data: propuestas },
    { data: fechas },
    { data: voy },
    { data: perfs },
    { data: sondeos },
  ] = await Promise.all([
      supabase.from("juntadas").select(campos).eq("estado", "activa").limit(1),
      supabase.from("juntadas").select(campos).eq("estado", "propuesta").order("inicio_programado"),
      supabase.from("fechas_especiales").select("id, nombre, dia, mes, desde_anio, lugar, creado_por, duracion_dias, puntos"),
      supabase.from("fechas_asistencia").select("fecha_id, perfil_id, dia"),
      supabase.from("perfiles").select("id, apodo"),
      supabase
        .from("sondeos")
        .select("id, nombre, sondeo_opciones(id, sondeo_votos(perfil_id))")
        .eq("estado", "abierto")
        .order("creado_en", { ascending: false }),
    ]);

  const activa = (activas as JuntadaConConteo[] | null)?.[0];
  const prox = (propuestas as JuntadaConConteo[] | null) ?? [];
  // juntadas abiertas a las que el usuario todavía no respondió (ni está presente)
  const pendientes = [...(activa ? [activa] : []), ...prox].filter(
    (j) => !j.confirmaciones.some((c) => c.perfil_id === uid) && !j.asistencias.some((a) => a.perfil_id === uid),
  );

  // eslint-disable-next-line react-hooks/purity -- la fecha de hoy se calcula al pedir la página
  const hoyBA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const estoyAdentro = !!activa && activa.asistencias.some((a) => a.perfil_id === uid);
  // arrancó, dije que iba y todavía no me escanearon: el QR va primero
  const dijeQueVoy = !!activa && activa.confirmaciones.some((c) => c.perfil_id === uid && c.va);
  let miToken: string | null = null;
  if (activa && !estoyAdentro && dijeQueVoy && uid && activa.anfitrion_id !== uid) {
    const { data } = await supabase.from("credenciales_qr").select("token").eq("perfil_id", uid).single();
    miToken = data?.token ?? null;
  }
  const porResponder = pendientes.filter((j) => j.id !== activa?.id);
  const idsPendientes = new Set(porResponder.map((j) => j.id));
  const proximas = prox.filter((j) => !idsPendientes.has(j.id));
  const hayAlgo = !!activa || porResponder.length > 0 || (sondeos ?? []).length > 0 || proximas.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {activa && miToken && <QrLlegada uid={uid!} token={miToken} nombre={activa.nombre} />}
      {/* 1. Lo que está pasando ahora */}
      {activa && estoyAdentro && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-acento bg-acento/10 p-4">
          <Link href={`/juntada/${activa.id}`} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-lg font-bold text-acento">
              <Radio className="size-5 animate-pulse" /> Estás en {activa.nombre}
            </span>
            <span className="flex items-center text-sm font-semibold text-acento">
              Ver <ChevronRight className="size-4" />
            </span>
          </Link>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: `/juntada/${activa.id}?solapa=gastos`, emoji: "💸", texto: "Cargar gasto" },
              { href: "/juegos", emoji: "🎮", texto: "Jugar / anotar" },
              { href: `/juntada/${activa.id}?solapa=fotos`, emoji: "📸", texto: "Subir foto" },
              { href: `/juntada/${activa.id}?solapa=frases`, emoji: "💬", texto: "Frase de la noche" },
            ].map((b) => (
              <Link
                key={b.texto}
                href={b.href}
                className="flex flex-col items-center gap-1 rounded-xl bg-superficie py-4 text-base font-semibold shadow-sm active:scale-95"
              >
                <span className="text-3xl">{b.emoji}</span>
                {b.texto}
              </Link>
            ))}
          </div>
        </div>
      )}
      {activa && !estoyAdentro && (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-acento bg-acento/10 p-5">
          <Link href={`/juntada/${activa.id}`} className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-acento">
            <Radio className="size-4 animate-pulse" /> Juntada en curso
          </p>
          <p className="text-2xl font-bold">{activa.nombre}</p>
          <p className="flex items-center gap-3 text-texto-suave">
            {activa.lugar && (
              <span className="flex items-center gap-1">
                <MapPin className="size-4" /> {activa.lugar}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="size-4" /> {new Set(activa.asistencias.map((a) => a.perfil_id)).size} presentes
            </span>
          </p>
          </Link>
          {!miToken && (
            <Link
              href="/perfil"
              className="mt-1 rounded-xl bg-acento py-3 text-center font-bold text-white active:scale-[0.99]"
            >
              Llegué: mostrar mi QR
            </Link>
          )}
        </div>
      )}

      <CuentaRegresiva fechas={(fechas as FechaEspecial[]) ?? []} hoyBA={hoyBA} />
      <CartelAvisos />
      <CartelNovedades />

      {/* 2. Lo que tengo que responder */}
      {porResponder.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">Respondé si vas</h2>
          {porResponder.map((j) => (
            <Link
              key={j.id}
              href={`/juntada/${j.id}`}
              className="flex items-center gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold">{j.nombre}</p>
                <p className="text-sm text-texto-suave">{fechaYHora(j.inicio_programado)}</p>
              </div>
              <span className="rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-black">Voy / No voy</span>
            </Link>
          ))}
        </section>
      )}
      {(sondeos ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">Votá la fecha</h2>
          {(sondeos ?? []).map((s) => {
            const votantes = new Set(s.sondeo_opciones.flatMap((o) => o.sondeo_votos.map((v) => v.perfil_id)));
            const vote = votantes.has(uid ?? "");
            return (
              <Link
                key={s.id}
                href={`/sondeo/${s.id}`}
                className={`flex items-center gap-3 rounded-2xl p-4 active:scale-[0.99] ${
                  vote ? "border border-borde bg-superficie" : "border-2 border-violet-400 bg-violet-50"
                }`}
              >
                <CalendarRange className="size-6 shrink-0 text-violet-700" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold">{s.nombre}</p>
                  <p className="text-sm text-texto-suave">
                    {s.sondeo_opciones.length} fechas posibles · votaron {votantes.size}
                  </p>
                </div>
                <span
                  className={`rounded-xl px-3 py-2 text-sm font-bold ${
                    vote ? "text-violet-700" : "bg-violet-600 text-white"
                  }`}
                >
                  {vote ? "Ver" : "Votar"}
                </span>
              </Link>
            );
          })}
        </section>
      )}

      {/* 3. Lo que viene */}
      {proximas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">Próximas juntadas</h2>
          {proximas.map((j) => (
            <FilaJuntada key={j.id} j={j} detalle={resumenRespuestas(j)} />
          ))}
        </section>
      )}
      <ProximaFecha
        fechas={(fechas as FechaEspecial[]) ?? []}
        voy={(voy as Voy[]) ?? []}
        apodos={Object.fromEntries((perfs ?? []).map((p) => [p.id, p.apodo]))}
        uid={uid ?? ""}
      />

      <Link
        href="/juntadas"
        className="flex items-center justify-between rounded-2xl border border-borde bg-superficie p-4 font-semibold active:scale-[0.99]"
      >
        <span>📅 Juntadas anteriores y sus fotos</span>
        <ChevronRight className="size-5 text-texto-suave" />
      </Link>

      {!hayAlgo && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-borde bg-superficie p-6 text-center">
          <CalendarPlus className="size-8 text-texto-suave" />
          <p className="text-texto-suave">No hay nada armado. ¿Proponés una juntada?</p>
          <Link href="/juntada/nueva" className="rounded-xl bg-acento px-4 py-2.5 font-bold text-white">
            Proponer juntada
          </Link>
        </div>
      )}
    </div>
  );
}

function FilaJuntada({ j, detalle, apagada }: { j: Juntada; detalle: string; apagada?: boolean }) {
  return (
    <Link
      href={`/juntada/${j.id}`}
      className={`flex items-center gap-3 rounded-2xl border border-borde bg-superficie p-4 active:scale-[0.99] ${
        apagada ? "opacity-70" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold">{j.nombre}</p>
        <p className="flex items-center gap-1 text-sm text-texto-suave">
          <Clock className="size-3.5" /> {fechaYHora(j.inicio_programado)}
        </p>
        <p className="text-sm text-texto-suave">
          {j.comida && <>🍽️ {j.comida} · </>}
          {detalle}
        </p>
      </div>
      <ChevronRight className="size-5 text-texto-suave" />
    </Link>
  );
}

function resumenRespuestas(j: JuntadaConConteo) {
  const van = j.confirmaciones.filter((c) => c.va).length;
  const no = j.confirmaciones.length - van;
  return `${van} van${no ? ` · ${no} no van` : ""}`;
}
