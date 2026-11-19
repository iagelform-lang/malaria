import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { usuarioActual } from "@/lib/sesion";
import { calcularInsignias } from "@/lib/insignias";
import type { Estadistica } from "@/lib/tipos";
import { TablaRanking } from "@/components/stats/TablaRanking";
import { SeccionGastos } from "@/components/stats/SeccionGastos";
import { Solapas } from "@/components/ui/Solapas";
import {
  rankingPuntos,
} from "@/lib/juegos";
import { RankingPuntos } from "@/components/stats/RankingPuntos";
import { TablaJuegos } from "@/components/stats/TablaJuegos";
import { tablaTorneos } from "@/lib/torneo";
import type { ConsumoG } from "@/lib/gastos";
import { aNumero, normalizarEstadistica } from "@/lib/numeros";

export default function StatsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Stats</h1>
      <Link
        href="/wrapped"
        className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-lime-300 via-lime-200 to-amber-200 px-4 py-3 font-bold text-black active:scale-[0.99]"
      >
        <span>🎁 Malaria Wrapped del año</span>
        <ChevronRight className="size-5" />
      </Link>
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-2xl bg-superficie"
              />
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
  const [
    { data },
    { data: jFin },
    { data: asis },
    { data: excl },
    { data: cons },
    { data: perfs },
    { data: parts },
    { data: eventos },
    { data: voyEv },
    { data: posTorneos },
  ] = await Promise.all([
    supabase.from("v_estadisticas").select("*"),
    supabase
      .from("juntadas")
      .select("id, nombre, inicio_programado, puntos")
      .eq("estado", "finalizada"),
    supabase.from("asistencias").select("juntada_id, perfil_id"),
    supabase.from("exclusiones_gasto").select("juntada_id, perfil_id"),
    supabase
      .from("consumos")
      .select("juntada_id, tipo, descripcion, monto, pagado_por, entre")
      .not("juntada_id", "is", null),
    supabase.from("perfiles").select("id, apodo, activo, oculto"),
    supabase.from("partidas").select("id, juego"),
    supabase.from("fechas_especiales").select("id, puntos"),
    supabase.from("fechas_asistencia").select("fecha_id, perfil_id, dia"),
    supabase.from("torneo_posiciones").select("perfil_id, puesto, puntos"),
  ]);
  // hoy en Buenos Aires: los eventos suman recién cuando ya pasaron
  // eslint-disable-next-line react-hooks/purity
  const hoyBA = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const finalizadas = jFin?.length ?? 0;
  const idsFin = new Set((jFin ?? []).map((j) => j.id));
  const apodos = Object.fromEntries((perfs ?? []).map((p) => [p.id, p.apodo]));
  // todo a número: sin juntadas terminadas, cada métrica vale 0 (nunca null/NaN)
  // las cuentas ocultas (ej: "Admin") no son integrantes: no van en las estadísticas
  const ocultos = new Set((perfs ?? []).filter((p) => p.oculto).map((p) => p.id));
  const stats = ((data as Estadistica[]) ?? [])
    .filter((e) => !ocultos.has(e.perfil_id))
    .map(normalizarEstadistica);
  const insignias = calcularInsignias(stats);
  const horasGrupo = stats.reduce((s, x) => s + aNumero(x.horas_totales), 0);

  return (
    <div className="flex flex-col gap-4">
      {finalizadas === 0 && (
        <p className="-mb-4 text-xs text-texto-suave">
          Todo arranca en 0: se va llenando cuando termine la primera juntada.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Dato valor={String(finalizadas)} etiqueta="juntadas" />
        <Dato
          valor={`${Math.round(horasGrupo).toLocaleString("es-AR")} h`}
          etiqueta="juntos (sumadas)"
        />
      </div>

      <Solapas
        solapas={[
          {
            clave: "puntos",
            titulo: "Puntos",
            contenido: (
              <>
      <RankingPuntos
        todos={(perfs ?? []).filter((p) => p.activo && !p.oculto).map((p) => p.id)}
        filas={rankingPuntos(
          jFin ?? [],
          (asis ?? []).filter((a) => idsFin.has(a.juntada_id)),
          eventos ?? [],
          voyEv ?? [],
          hoyBA,
        )}
        apodos={apodos}
        uid={uid ?? ""}
      />
              </>
            ),
          },
          {
            clave: "asistencia",
            titulo: "Asistencia",
            contenido: (
              <>
      <TablaRanking stats={stats} uid={uid ?? ""} />
              </>
            ),
          },
          {
            clave: "insignias",
            titulo: "Insignias",
            contenido: (
              <>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">
          Insignias
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {insignias.map((i) => (
            <div
              key={i.clave}
              className={`flex flex-col gap-1 rounded-2xl border p-4 ${
                i.clave === "fantasma"
                  ? "border-violet-500/30 bg-violet-500/10"
                  : "border-borde bg-superficie"
              } ${i.clave === "chamuyero" ? "col-span-2" : ""}`}
            >
              <span className="text-3xl">{i.emoji}</span>
              <p className="text-sm font-semibold">{i.titulo}</p>
              {i.ganadores.length ? (
                <>
                  <p className="text-xl font-bold leading-tight text-acento">
                    {i.ganadores.join(" y ")}
                  </p>
                  <p className="text-xs text-texto-suave">{i.valor}</p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold leading-tight text-texto-suave">
                    Nadie todavía
                  </p>
                  <p className="text-xs text-texto-suave">
                    {i.pendiente ?? i.valor}
                  </p>
                </>
              )}
              <p className="mt-auto pt-2 text-[11px] leading-snug text-texto-suave">
                {i.descripcion}
              </p>
            </div>
          ))}
        </div>
      </section>
              </>
            ),
          },
          {
            clave: "gastos",
            titulo: "Gastos",
            contenido: (
              <>
      <Link
        href="/gastos"
        className="flex items-center justify-between rounded-2xl bg-acento/10 px-4 py-3 text-sm font-semibold text-acento ring-1 ring-acento/30"
      >
        💸 Ver quién le debe a quién y las cuentas sueltas <span>→</span>
      </Link>
      <SeccionGastos
        juntadas={jFin ?? []}
        asistencias={(asis ?? []).filter((a) => idsFin.has(a.juntada_id))}
        exclusiones={(excl ?? []).filter((e) => idsFin.has(e.juntada_id))}
        consumos={((cons ?? []) as ConsumoG[])
          .filter((c) => idsFin.has(c.juntada_id))
          .map((c) => ({
            ...c,
            monto: c.monto == null ? null : aNumero(c.monto),
          }))}
        apodos={apodos}
        uid={uid ?? ""}
      />
              </>
            ),
          },
          {
            clave: "juegos",
            titulo: "Juegos",
            contenido: (
              <>
      <SeccionJuegosResumen
        partidas={(parts ?? []).length}
        campeon={tablaTorneos((posTorneos ?? []).filter((p) => !ocultos.has(p.perfil_id)))[0] ?? null}
        apodos={apodos}
      />
      <TablaJuegos
        filas={tablaTorneos((posTorneos ?? []).filter((p) => !ocultos.has(p.perfil_id)))}
        apodos={apodos}
      />
              </>
            ),
          },
        ]}
      />
    </div>
  );
}

function SeccionJuegosResumen({
  partidas,
  campeon,
  apodos,
}: {
  partidas: number;
  campeon: { perfil_id: string; puntos: number } | null;
  apodos: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Dato valor={String(partidas)} etiqueta="duelos jugados" />
      <div className="rounded-2xl bg-superficie p-4">
        <p className="truncate text-2xl font-bold">{campeon ? (apodos[campeon.perfil_id] ?? "?") : "Nadie todavía"}</p>
        <p className="text-sm text-texto-suave">👑 campeón de los juegos · {campeon ? campeon.puntos : 0} pts</p>
      </div>
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
