import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Dices } from "lucide-react";
import { usuarioActual } from "@/lib/sesion";
import {
  rankingJuegos,
  type Juego,
  type JugadorR,
  type PartidaR,
} from "@/lib/juegos";
import { CatalogoJuegos } from "@/components/juegos/CatalogoJuegos";
import { SeccionJuegos } from "@/components/stats/SeccionJuegos";
import { TablaJuegos } from "@/components/stats/TablaJuegos";
import { SeccionDuelos } from "@/components/juegos/SeccionDuelos";
import { esDuelo } from "@/lib/duelos";
import { ListaTorneos, type TorneoLista } from "@/components/juegos/ListaTorneos";
import { tablaTorneos } from "@/lib/torneo";

export default function JuegosPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Juegos</h1>
      <Suspense
        fallback={
          <div className="flex flex-col gap-3">
            <div className="h-20 animate-pulse rounded-2xl bg-superficie" />
            <div className="h-40 animate-pulse rounded-2xl bg-superficie" />
          </div>
        }
      >
        <Contenido />
      </Suspense>
    </div>
  );
}

type PartidaLista = {
  id: number;
  juego: string;
  resultado: string | null;
  juntada_id: string | null;
  torneo_id: number | null;
  cargado_por: string;
  juntadas: { nombre: string } | null;
  partida_jugadores: { perfil_id: string; gano: boolean }[];
};

async function Contenido() {
  const { supabase, uid, esAdmin } = await usuarioActual();
  const [
    { data: juegos },
    { data: partidas },
    { data: perfs },
    { data: activas },
    { data: posTorneos },
    { data: torneos },
    { data: juegosJugados },
  ] = await Promise.all([
    supabase
      .from("juegos")
      .select("id, nombre, emoji, modo, predeterminado, creado_por")
      .order("predeterminado", { ascending: false })
      .order("creado_en"),
    supabase
      .from("partidas")
      .select(
        "id, juego, resultado, juntada_id, torneo_id, cargado_por, juntadas(nombre), partida_jugadores(perfil_id, gano)",
      )
      .order("creado_en", { ascending: false }),
    supabase.from("perfiles").select("id, apodo"),
    supabase
      .from("juntadas")
      .select("id, nombre")
      .eq("estado", "activa")
      .limit(1),
    supabase.from("torneo_posiciones").select("perfil_id, puesto, puntos"),
    supabase
      .from("torneos")
      .select("id, juego, creado_en, cargado_por, torneo_posiciones(perfil_id, puesto)")
      .order("creado_en", { ascending: false })
      .limit(10),
    supabase.from("torneos").select("juego"),
  ]);
  const catalogo = (juegos as Juego[]) ?? [];
  const tablaJ = tablaTorneos(posTorneos ?? []);
  const lista = (partidas as unknown as PartidaLista[]) ?? [];
  const apodos = Object.fromEntries((perfs ?? []).map((p) => [p.id, p.apodo]));
  const ranking = rankingJuegos(
    lista as PartidaR[],
    lista.flatMap((p) =>
      p.partida_jugadores.map((j) => ({ ...j, partida_id: p.id })),
    ) as JugadorR[],
  );
  // cuántos torneos se jugaron de cada juego
  const cuantas = (nombre: string) =>
    (juegosJugados ?? []).filter((t) => t.juego.toLowerCase() === nombre.toLowerCase()).length;
  const activa = activas?.[0];

  return (
    <div className="flex flex-col gap-8">
      {activa ? (
        <Link
          href={`/juntada/${activa.id}#juegos`}
          className="flex items-center gap-3 rounded-2xl border-2 border-acento/50 bg-acento/10 p-4 active:scale-[0.99]"
        >
          <Dices className="size-6 shrink-0 text-acento" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">¿Qué jugamos?</p>
            <p className="truncate text-sm text-texto-suave">
              Cargá la partida en {activa.nombre}
            </p>
          </div>
          <ChevronRight className="size-5 text-acento" />
        </Link>
      ) : (
        <p className="rounded-2xl border border-dashed border-borde p-4 text-center text-sm text-texto-suave">
          Las partidas se cargan durante o después de una juntada, en su sección{" "}
          <b>Juegos</b>.
        </p>
      )}

      <CatalogoJuegos
        juegos={catalogo.map((j) => ({ ...j, partidas: cuantas(j.nombre) }))}
        uid={uid ?? ""}
        esAdmin={esAdmin}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">
          Rankings
        </h2>
        <TablaJuegos filas={tablaJ} apodos={apodos} />
        <SeccionJuegos
          {...ranking}
          apodos={apodos}
          catalogo={catalogo}
          titulo={false}
          campeonPuntos={tablaJ[0] ?? null}
        />
      </section>

      <ListaTorneos
        torneos={(torneos as TorneoLista[]) ?? []}
        apodos={apodos}
        uid={uid ?? ""}
        esAdmin={esAdmin}
      />

      <SeccionDuelos
        duelos={lista.filter(esDuelo)}
        apodos={apodos}
        catalogo={catalogo}
        uid={uid ?? ""}
        esAdmin={esAdmin}
      />
    </div>
  );
}
