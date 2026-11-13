import { Suspense } from "react";
import { usuarioActual } from "@/lib/sesion";
import { calcularInsignias } from "@/lib/insignias";
import type { Estadistica } from "@/lib/tipos";
import { TablaRanking } from "@/components/stats/TablaRanking";
import { SeccionGastos } from "@/components/stats/SeccionGastos";
import type { ConsumoG } from "@/lib/gastos";

export default function StatsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Stats</h1>
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-superficie" />
            ))}
          </div>
        }
      >
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const { supabase, uid } = await usuarioActual();
  const [{ data }, { data: jFin }, { data: asis }, { data: excl }, { data: cons }, { data: perfs }] = await Promise.all(
    [
      supabase.from("v_estadisticas").select("*"),
      supabase.from("juntadas").select("id, nombre, inicio_programado").eq("estado", "finalizada"),
      supabase.from("asistencias").select("juntada_id, perfil_id"),
      supabase.from("exclusiones_gasto").select("juntada_id, perfil_id"),
      supabase.from("consumos").select("juntada_id, tipo, descripcion, monto, pagado_por"),
      supabase.from("perfiles").select("id, apodo"),
    ],
  );
  const finalizadas = jFin?.length ?? 0;
  const idsFin = new Set((jFin ?? []).map((j) => j.id));
  const apodos = Object.fromEntries((perfs ?? []).map((p) => [p.id, p.apodo]));
  const stats = ((data as Estadistica[]) ?? []).map((s) => ({
    ...s,
    horas_totales: Number(s.horas_totales),
    pct_asistencia: s.pct_asistencia == null ? null : Number(s.pct_asistencia),
    pct_puntualidad: s.pct_puntualidad == null ? null : Number(s.pct_puntualidad),
    promedio_min_por_juntada: s.promedio_min_por_juntada == null ? null : Number(s.promedio_min_por_juntada),
  }));
  const insignias = calcularInsignias(stats);
  const horasGrupo = stats.reduce((s, x) => s + x.horas_totales, 0);

  if (!finalizadas) {
    return (
      <p className="rounded-2xl border border-dashed border-borde p-8 text-center text-texto-suave">
        Las estadísticas aparecen cuando termine la primera juntada.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3">
        <Dato valor={String(finalizadas)} etiqueta="juntadas" />
        <Dato valor={`${Math.round(horasGrupo).toLocaleString("es-AR")} h`} etiqueta="juntos (sumadas)" />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">Insignias</h2>
        <div className="grid grid-cols-2 gap-3">
          {insignias.map((i) => (
            <div
              key={i.clave}
              className={`flex flex-col gap-1 rounded-2xl border p-4 ${
                i.clave === "fantasma" ? "border-violet-500/30 bg-violet-500/10" : "border-borde bg-superficie"
              } ${i.clave === "chamuyero" ? "col-span-2" : ""}`}
            >
              <span className="text-3xl">{i.emoji}</span>
              <p className="text-sm font-semibold">{i.titulo}</p>
              {i.ganadores.length ? (
                <>
                  <p className="text-xl font-bold leading-tight text-acento">{i.ganadores.join(" y ")}</p>
                  <p className="text-xs text-texto-suave">{i.valor}</p>
                </>
              ) : (
                <p className="text-sm text-texto-suave">{i.pendiente ?? "Vacante"}</p>
              )}
              <p className="mt-auto pt-2 text-[11px] leading-snug text-texto-suave">{i.descripcion}</p>
            </div>
          ))}
        </div>
      </section>

      <SeccionGastos
        juntadas={jFin ?? []}
        asistencias={(asis ?? []).filter((a) => idsFin.has(a.juntada_id))}
        exclusiones={(excl ?? []).filter((e) => idsFin.has(e.juntada_id))}
        consumos={((cons ?? []) as ConsumoG[])
          .filter((c) => idsFin.has(c.juntada_id))
          .map((c) => ({ ...c, monto: c.monto == null ? null : Number(c.monto) }))}
        apodos={apodos}
        uid={uid ?? ""}
      />

      <TablaRanking stats={stats} uid={uid ?? ""} />
    </div>
  );
}

function Dato({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="rounded-2xl bg-superficie p-4">
      <p className="text-3xl font-bold">{valor}</p>
      <p className="text-sm text-texto-suave">{etiqueta}</p>
    </div>
  );
}
