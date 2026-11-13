import { Suspense } from "react";
import Link from "next/link";
import { CalendarPlus, ChevronRight, Clock, MapPin, Plus, Radio, Users } from "lucide-react";
import { fechaYHora } from "@/lib/tiempo";
import type { Juntada } from "@/lib/tipos";
import type { FechaEspecial } from "@/lib/fechas";
import { ProximaFecha, type Voy } from "@/components/fechas/ProximaFecha";
import { usuarioActual } from "@/lib/sesion";

export default function InicioPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Malaria 3.0</h1>
        <Link
          href="/juntada/nueva"
          className="flex items-center gap-1.5 rounded-full bg-acento px-4 py-2 text-sm font-semibold text-black active:scale-95"
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

  const [{ data: activas }, { data: propuestas }, { data: pasadas }, { data: fechas }, { data: voy }, { data: perfs }] =
    await Promise.all([
      supabase.from("juntadas").select(campos).eq("estado", "activa").limit(1),
      supabase.from("juntadas").select(campos).eq("estado", "propuesta").order("inicio_programado"),
      supabase
        .from("juntadas")
        .select(campos)
        .eq("estado", "finalizada")
        .order("inicio_programado", { ascending: false })
        .limit(5),
      supabase.from("fechas_especiales").select("id, nombre, dia, mes, desde_anio, lugar, creado_por, duracion_dias"),
      supabase.from("fechas_asistencia").select("fecha_id, perfil_id, dia"),
      supabase.from("perfiles").select("id, apodo"),
    ]);

  const activa = (activas as JuntadaConConteo[] | null)?.[0];
  const prox = (propuestas as JuntadaConConteo[] | null) ?? [];
  const hist = (pasadas as JuntadaConConteo[] | null) ?? [];
  // juntadas abiertas a las que el usuario todavía no respondió (ni está presente)
  const pendientes = [...(activa ? [activa] : []), ...prox].filter(
    (j) => !j.confirmaciones.some((c) => c.perfil_id === uid) && !j.asistencias.some((a) => a.perfil_id === uid),
  );

  return (
    <div className="flex flex-col gap-8">
      <ProximaFecha
        fechas={(fechas as FechaEspecial[]) ?? []}
        voy={(voy as Voy[]) ?? []}
        apodos={Object.fromEntries((perfs ?? []).map((p) => [p.id, p.apodo]))}
        uid={uid ?? ""}
      />
      {pendientes.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-amber-400/60 bg-amber-400/10 p-4">
          <p className="font-bold text-amber-300">
            {pendientes.length === 1 ? "Te falta responder si vas" : `Te falta responder ${pendientes.length} juntadas`}
          </p>
          {pendientes.map((j) => (
            <Link
              key={j.id}
              href={`/juntada/${j.id}`}
              className="flex items-center justify-between rounded-xl bg-superficie px-3 py-2.5"
            >
              <span className="truncate font-medium">{j.nombre}</span>
              <span className="flex items-center gap-1 text-sm font-semibold text-acento">
                Voy / No voy <ChevronRight className="size-4" />
              </span>
            </Link>
          ))}
        </div>
      )}
      {activa ? (
        <Link
          href={`/juntada/${activa.id}`}
          className="block rounded-2xl border border-acento/40 bg-acento/10 p-5 active:scale-[0.99]"
        >
          <p className="mb-1 flex items-center gap-2 text-sm font-medium text-acento">
            <Radio className="size-4 animate-pulse" /> En curso
          </p>
          <p className="text-2xl font-bold">{activa.nombre}</p>
          {activa.lugar && (
            <p className="mt-1 flex items-center gap-1 text-texto-suave">
              <MapPin className="size-4" /> {activa.lugar}
            </p>
          )}
          <p className="mt-3 flex items-center justify-between text-sm">
            <span className="flex items-center gap-1">
              <Users className="size-4" /> {new Set(activa.asistencias.map((a) => a.perfil_id)).size} presentes
            </span>
            <span className="flex items-center text-acento">
              Entrar <ChevronRight className="size-4" />
            </span>
          </p>
        </Link>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-borde p-6 text-center">
          <CalendarPlus className="size-8 text-texto-suave" />
          <p className="text-texto-suave">No hay ninguna juntada en curso.</p>
        </div>
      )}

      <Seccion titulo="Propuestas" vacio="Nadie propuso nada todavía.">
        {prox.map((j) => (
          <FilaJuntada key={j.id} j={j} detalle={resumenRespuestas(j)} />
        ))}
      </Seccion>

      <Seccion titulo="Últimas" vacio="Todavía no terminó ninguna.">
        {hist.map((j) => (
          <FilaJuntada
            key={j.id}
            j={j}
            detalle={`fueron ${new Set(j.asistencias.map((a) => a.perfil_id)).size}`}
            apagada
          />
        ))}
      </Seccion>
    </div>
  );
}

function Seccion({ titulo, vacio, children }: { titulo: string; vacio: string; children: React.ReactNode[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">{titulo}</h2>
      {children.length ? children : <p className="text-sm text-texto-suave">{vacio}</p>}
    </section>
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
        <p className="truncate font-semibold">{j.nombre}</p>
        <p className="flex items-center gap-1 text-sm text-texto-suave">
          <Clock className="size-3.5" /> {fechaYHora(j.inicio_programado)}
        </p>
        <p className="text-xs text-texto-suave">{detalle}</p>
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
