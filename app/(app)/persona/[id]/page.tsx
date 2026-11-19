import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Quote } from "lucide-react";
import { usuarioActual } from "@/lib/sesion";
import { calcularInsignias } from "@/lib/insignias";
import { normalizarEstadistica } from "@/lib/numeros";
import { nivelDe, rankingJuegos, rankingPuntos, type JugadorR, type PartidaR } from "@/lib/juegos";
import { fechaCorta } from "@/lib/tiempo";
import { tablaTorneos } from "@/lib/torneo";
import { caraACara, esDuelo, type DueloLista } from "@/lib/duelos";
import type { Estadistica } from "@/lib/tipos";
import { CopiarAlias } from "@/components/juntada/CopiarAlias";

export default function PersonaPage({ params }: PageProps<"/persona/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/stats" className="-ml-2 w-fit rounded-full p-2 text-texto-suave">
        <ArrowLeft className="size-5" />
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-superficie" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, uid } = await usuarioActual();

  const [
    { data: persona },
    { data: perfs },
    { data: est },
    { data: jFin },
    { data: asis },
    { data: eventos },
    { data: voyEv },
    { data: partidas },
    { data: posT },
    { data: frases },
  ] = await Promise.all([
    supabase.from("perfiles").select("id, apodo, rol, alias, oculto").eq("id", id).maybeSingle(),
    supabase.from("perfiles").select("id, apodo, activo, oculto"),
    supabase.from("v_estadisticas").select("*"),
    supabase.from("juntadas").select("id, nombre, inicio_programado, puntos").eq("estado", "finalizada"),
    supabase.from("asistencias").select("juntada_id, perfil_id"),
    supabase.from("fechas_especiales").select("id, puntos"),
    supabase.from("fechas_asistencia").select("fecha_id, perfil_id, dia"),
    supabase.from("partidas").select("id, juego, resultado, torneo_id, partida_jugadores(perfil_id, gano)"),
    supabase.from("torneo_posiciones").select("perfil_id, puesto, puntos"),
    supabase
      .from("frases")
      .select("id, texto, juntada_id, frase_votos(perfil_id)")
      .eq("perfil_id", id),
  ]);
  if (!persona || persona.oculto) notFound();

  const apodos = Object.fromEntries((perfs ?? []).map((p) => [p.id, p.apodo]));
  const ocultos = new Set((perfs ?? []).filter((p) => p.oculto).map((p) => p.id));
  const stats = ((est as Estadistica[]) ?? []).filter((e) => !ocultos.has(e.perfil_id)).map(normalizarEstadistica);
  const mio = stats.find((s) => s.perfil_id === id);

  // puntos y puesto
  const idsFin = new Set((jFin ?? []).map((j) => j.id));
  const asisFin = (asis ?? []).filter((a) => idsFin.has(a.juntada_id));
  // eslint-disable-next-line react-hooks/purity
  const hoyBA = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const tabla = rankingPuntos(jFin ?? [], asisFin, eventos ?? [], voyEv ?? [], hoyBA).filter(
    (f) => !ocultos.has(f.perfil_id),
  );
  const filaPuntos = tabla.find((f) => f.perfil_id === id);
  const puntos = filaPuntos?.puntos ?? 0;
  const puesto = filaPuntos ? tabla.findIndex((f) => f.puntos === puntos) + 1 : null;

  // insignias que tiene
  const insignias = calcularInsignias(stats).filter((i) => i.ganadores.includes(persona.apodo));

  // juegos
  const lista = (partidas ?? []) as { id: number; juego: string; partida_jugadores: { perfil_id: string; gano: boolean }[] }[];
  const jugadores = lista.flatMap((p) => p.partida_jugadores.map((j) => ({ ...j, partida_id: p.id }))) as JugadorR[];
  const rj = rankingJuegos(lista as PartidaR[], jugadores);
  const totalJuegos = rj.total.find((r) => r.perfil_id === id);

  // con quién coincide más
  const susJuntadas = new Set(asisFin.filter((a) => a.perfil_id === id).map((a) => a.juntada_id));
  const coincide = new Map<string, Set<string>>();
  for (const a of asisFin) {
    if (a.perfil_id === id || !susJuntadas.has(a.juntada_id) || ocultos.has(a.perfil_id)) continue;
    if (!coincide.has(a.perfil_id)) coincide.set(a.perfil_id, new Set());
    coincide.get(a.perfil_id)!.add(a.juntada_id);
  }
  const compas = [...coincide.entries()]
    .map(([pid, s]) => ({ pid, n: s.size }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);

  // historial
  const historial = (jFin ?? [])
    .filter((j) => susJuntadas.has(j.id))
    .sort((a, b) => b.inicio_programado.localeCompare(a.inicio_programado));

  // duelos 1 vs 1: récord contra cada rival
  const susDuelos = caraACara(
    (lista as DueloLista[]).filter((d) => esDuelo(d) && d.partida_jugadores.some((j) => j.perfil_id === id)),
  ).map((p) => (p.a === id ? { rival: p.b, gano: p.ganA, perdio: p.ganB } : { rival: p.a, gano: p.ganB, perdio: p.ganA }));

  const susFrases = ((frases ?? []) as { id: number; texto: string; frase_votos: unknown[] }[]).sort(
    (a, b) => b.frase_votos.length - a.frase_votos.length,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="grid size-20 place-items-center rounded-full bg-acento text-3xl font-black text-white">
          {persona.apodo.slice(0, 1).toUpperCase()}
        </div>
        <h1 className="text-2xl font-bold">
          {persona.apodo} {persona.id === uid && <span className="text-sm text-acento">(vos)</span>}
        </h1>
        {persona.rol === "admin" && <span className="text-xs text-acento">Admin</span>}
        {persona.alias && <CopiarAlias alias={persona.alias} />}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Dato valor={String(puntos)} etiqueta={puesto ? `puntos · ${puesto}° puesto` : "puntos"} />
        <Dato
          valor={`${mio?.juntadas_asistidas ?? 0}/${mio?.juntadas_posibles ?? 0}`}
          etiqueta="juntadas"
        />
        <Dato valor={`${(mio?.horas_totales ?? 0).toLocaleString("es-AR")} h`} etiqueta="juntos" />
        <Dato valor={`${Math.round(mio?.pct_puntualidad ?? 0)}%`} etiqueta="puntualidad" />
        <Dato
          valor={String(tablaTorneos(posT ?? []).find((f) => f.perfil_id === id)?.puntos ?? 0)}
          etiqueta={`pts de juegos · ${totalJuegos?.ganadas ?? 0} ganadas`}
        />
        <Dato valor={String(mio?.veces_planto ?? 0)} etiqueta="plantones" />
      </div>

      <Bloque titulo="Insignias">
        {insignias.length ? (
          <div className="flex flex-wrap gap-2">
            {insignias.map((i) => (
              <span key={i.clave} className="rounded-full bg-superficie px-3 py-1.5 text-sm ring-1 ring-borde">
                {i.emoji} {i.titulo}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-texto-suave">Ninguna todavía</p>
        )}
      </Bloque>

      <Bloque titulo="Con quién coincide más">
        {compas.length ? (
          <div className="flex flex-col gap-1 text-sm">
            {compas.map((c) => (
              <Link key={c.pid} href={`/persona/${c.pid}`} className="flex justify-between rounded-xl bg-superficie px-3 py-2">
                <span>{apodos[c.pid] ?? "?"}</span>
                <span className="text-texto-suave">
                  {c.n} {c.n === 1 ? "juntada" : "juntadas"} juntos
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-texto-suave">Todavía no coincidió con nadie</p>
        )}
      </Bloque>

      {susDuelos.length > 0 && (
        <Bloque titulo="Duelos 1 vs 1">
          <div className="flex flex-col gap-1 text-sm">
            {susDuelos.map((d) => (
              <Link key={d.rival} href={`/persona/${d.rival}`} className="flex justify-between rounded-xl bg-superficie px-3 py-2">
                <span>vs {apodos[d.rival] ?? "?"}</span>
                <b className={d.gano > d.perdio ? "text-acento" : d.gano < d.perdio ? "text-red-600" : ""}>
                  {d.gano} - {d.perdio}
                </b>
              </Link>
            ))}
          </div>
        </Bloque>
      )}

      {susFrases.length > 0 && (
        <Bloque titulo="Sus frases">
          <div className="flex flex-col gap-1 text-sm">
            {susFrases.slice(0, 5).map((f) => (
              <p key={f.id} className="rounded-xl bg-superficie px-3 py-2">
                <Quote className="mr-1 inline size-3.5 text-texto-suave" />
                <span className="italic">{f.texto}</span>
                <span className="text-texto-suave"> · ❤️ {f.frase_votos.length}</span>
              </p>
            ))}
          </div>
        </Bloque>
      )}

      <Bloque titulo={`Historial · ${historial.length}`}>
        {historial.length ? (
          <div className="flex flex-col gap-1 text-sm">
            {historial.slice(0, 15).map((j) => (
              <Link key={j.id} href={`/juntada/${j.id}`} className="flex justify-between rounded-xl bg-superficie px-3 py-2">
                <span className="truncate">{j.nombre}</span>
                <span className="shrink-0 text-texto-suave">
                  {fechaCorta(j.inicio_programado)} · ⭐ {j.puntos ?? nivelDe(10).puntos}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-texto-suave">Todavía no fue a ninguna juntada terminada</p>
        )}
      </Bloque>
    </div>
  );
}

function Dato({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="rounded-2xl bg-superficie px-2 py-3">
      <p className="text-xl font-black">{valor}</p>
      <p className="text-[11px] leading-tight text-texto-suave">{etiqueta}</p>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">{titulo}</h2>
      {children}
    </section>
  );
}
