"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Dices, Loader2, Plus, Star, Trash2, X } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/errores";
import { ejemploResultado, emojiJuego, type Modo } from "@/lib/juegos";
import { useJuegos } from "@/lib/hooks/useJuegos";
import type { Perfil } from "@/lib/tipos";

type Partida = {
  id: number;
  juego: string;
  resultado: string | null;
  cargado_por: string;
  partida_jugadores: { perfil_id: string; equipo: number; gano: boolean }[];
};

/** Partidas jugadas en la juntada (truco, poker, FIFA…): suman a las estadísticas */
export function SeccionJuegos({
  juntadaId,
  uid,
  puedeGestionar,
  perfiles,
  idsQueVinieron,
  enCurso = false,
}: {
  juntadaId: string;
  uid: string;
  puedeGestionar: boolean;
  perfiles: Perfil[];
  idsQueVinieron: string[];
  enCurso?: boolean;
}) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const { juegos: catalogo } = useJuegos();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apodo = (id: string) => perfiles.find((p) => p.id === id)?.apodo ?? "?";
  const puedeCargar = puedeGestionar || idsQueVinieron.includes(uid);

  const recargar = useCallback(async () => {
    const { data } = await supabase
      .from("partidas")
      .select(
        "id, juego, resultado, cargado_por, partida_jugadores(perfil_id, equipo, gano)",
      )
      .eq("juntada_id", juntadaId)
      .order("creado_en");
    if (data) setPartidas(data as Partida[]);
  }, [supabase, juntadaId]);

  useEffect(() => {
    const t = setTimeout(recargar, 0);
    const canal = supabase
      .channel(`partidas-${juntadaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "partidas",
          filter: `juntada_id=eq.${juntadaId}`,
        },
        recargar,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partida_jugadores" },
        recargar,
      )
      .subscribe();
    return () => {
      clearTimeout(t);
      supabase.removeChannel(canal);
    };
  }, [supabase, juntadaId, recargar]);

  async function borrar(id: number) {
    setError(null);
    const { error } = await supabase.from("partidas").delete().eq("id", id);
    if (error) setError(mensajeError(error));
    else await recargar();
  }

  if (!puedeCargar && partidas.length === 0) return null;

  return (
    <section id="juegos" className="flex scroll-mt-4 flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-texto-suave">
          <Dices className="size-4" /> Juegos{" "}
          {partidas.length > 0 && `(${partidas.length})`}
        </h2>
        {puedeCargar && (
          <Link
            href="/juegos"
            className="flex items-center gap-1 rounded-full bg-acento px-3 py-1.5 text-sm font-semibold text-black"
          >
            <Plus className="size-4" /> Jugar
          </Link>
        )}
      </div>

      {enCurso && puedeCargar && !abierto && (
        <Link
          href={`/juntada/${juntadaId}/bid`}
          className="flex items-center justify-between rounded-xl bg-superficie px-3 py-2.5 ring-1 ring-acento/40"
        >
          <span className="font-semibold">🔨 Jugar Bid Womens</span>
          <span className="text-xs text-texto-suave">subasta + torneo →</span>
        </Link>
      )}

      {abierto && (
        <FormPartida
          juntadaId={juntadaId}
          perfiles={perfiles}
          idsQueVinieron={idsQueVinieron}
          cerrar={() => setAbierto(false)}
          guardado={async () => {
            setAbierto(false);
            await recargar();
          }}
        />
      )}

      {partidas.length === 0 && !abierto && (
        <p className="text-sm text-texto-suave">
          ¿Jugaron algo? Tocá Jugar, elegí el juego y cargá los puestos para sumar puntos.
        </p>
      )}

      {partidas.map((p) => {
        const ganadores = p.partida_jugadores
          .filter((j) => j.gano)
          .map((j) => apodo(j.perfil_id));
        const perdedores = p.partida_jugadores
          .filter((j) => !j.gano)
          .map((j) => apodo(j.perfil_id));
        return (
          <div
            key={p.id}
            className="flex items-start gap-3 rounded-xl bg-superficie px-3 py-2.5"
          >
            <span className="text-2xl leading-none">
              {emojiJuego(p.juego, catalogo)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {p.juego}
                {p.resultado && (
                  <span className="font-normal text-texto-suave">
                    {" "}
                    · {p.resultado}
                  </span>
                )}
              </p>
              <p className="text-sm">
                🏆 <b>{ganadores.join(", ") || "—"}</b>
              </p>
              {perdedores.length > 0 && (
                <p className="text-xs text-texto-suave">
                  vs. {perdedores.join(", ")}
                </p>
              )}
            </div>
            {(p.cargado_por === uid || puedeGestionar) && (
              <button
                onClick={() => borrar(p.id)}
                className="p-1 text-texto-suave"
                aria-label="Borrar partida"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        );
      })}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}

function FormPartida({
  juntadaId,
  perfiles,
  idsQueVinieron,
  cerrar,
  guardado,
}: {
  juntadaId: string;
  perfiles: Perfil[];
  idsQueVinieron: string[];
  cerrar: () => void;
  guardado: () => void;
}) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const { juegos: catalogo } = useJuegos();
  const [juego, setJuego] = useState("Truco");
  const [otro, setOtro] = useState("");
  const [modo, setModo] = useState<Modo>("equipos");
  // perfil → equipo (1 o 2) en modo equipos, o 1 en individual
  const [jugadores, setJugadores] = useState<Record<string, number>>({});
  const [ganador, setGanador] = useState<string | number | null>(null); // equipo (número) o perfil (texto)
  const [resultado, setResultado] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // primero los que vinieron a la juntada
  const lista = [...perfiles].sort(
    (a, b) =>
      Number(idsQueVinieron.includes(b.id)) -
      Number(idsQueVinieron.includes(a.id)),
  );
  const nombreJuego = juego === "Otro" ? otro.trim() : juego;
  const ejemplo = ejemploResultado(juego);
  const ids = Object.keys(jugadores);

  function elegirJuego(nombre: string) {
    setJuego(nombre);
    const m = catalogo.find((j) => j.nombre === nombre)?.modo;
    if (m) cambiarModo(m);
  }
  function cambiarModo(m: Modo) {
    setModo(m);
    setGanador(null);
    setJugadores((js) =>
      Object.fromEntries(Object.keys(js).map((id) => [id, 1])),
    );
  }
  function tocar(id: string) {
    setGanador(null);
    setJugadores((js) => {
      const actual = js[id];
      const sig = { ...js };
      if (modo === "individual") {
        if (actual) delete sig[id];
        else sig[id] = 1;
      } else if (!actual) sig[id] = 1;
      else if (actual === 1) sig[id] = 2;
      else delete sig[id];
      return sig;
    });
  }

  const valido =
    nombreJuego &&
    ids.length >= 2 &&
    ganador !== null &&
    (modo === "individual" ||
      (ids.some((id) => jugadores[id] === 1) &&
        ids.some((id) => jugadores[id] === 2)));

  async function guardar() {
    if (!valido) return;
    setOcupado(true);
    setError(null);
    // un juego nuevo escrito a mano queda en el catálogo para la próxima
    if (
      juego === "Otro" &&
      !catalogo.some(
        (x) => x.nombre.toLowerCase() === nombreJuego.toLowerCase(),
      )
    ) {
      await supabase.from("juegos").insert({ nombre: nombreJuego, modo });
    }
    const { data, error } = await supabase
      .from("partidas")
      .insert({
        juntada_id: juntadaId,
        juego: nombreJuego,
        resultado: resultado.trim() || null,
      })
      .select("id")
      .single();
    if (error || !data) {
      setOcupado(false);
      return setError(mensajeError(error ?? { message: "" }));
    }
    const { error: e2 } = await supabase.from("partida_jugadores").insert(
      ids.map((id) => ({
        partida_id: data.id,
        perfil_id: id,
        equipo: modo === "equipos" ? jugadores[id] : 1,
        gano: modo === "equipos" ? jugadores[id] === ganador : id === ganador,
      })),
    );
    setOcupado(false);
    if (e2) {
      await supabase.from("partidas").delete().eq("id", data.id);
      return setError(mensajeError(e2));
    }
    guardado();
  }

  const chip = (activo: boolean) =>
    `rounded-full px-3 py-1.5 text-sm ${activo ? "bg-acento font-semibold text-black" : "bg-fondo text-texto-suave ring-1 ring-borde"}`;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-acento/40 bg-superficie p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Nueva partida</p>
        <button
          onClick={cerrar}
          className="p-1 text-texto-suave"
          aria-label="Cancelar"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[...catalogo.map((j) => j.nombre), "Otro"].map((n) => (
          <button
            key={n}
            onClick={() => elegirJuego(n)}
            className={chip(juego === n)}
          >
            {n === "Otro" ? "Otro…" : `${emojiJuego(n, catalogo)} ${n}`}
          </button>
        ))}
      </div>
      {juego === "Otro" && (
        <input
          autoFocus
          maxLength={30}
          placeholder="¿Qué jugaron?"
          value={otro}
          onChange={(e) => setOtro(e.target.value)}
          className="rounded-xl border border-borde bg-fondo px-3 py-2.5 outline-none focus:border-acento"
        />
      )}

      <div className="flex gap-2">
        <button
          onClick={() => cambiarModo("equipos")}
          className={chip(modo === "equipos")}
        >
          Por equipos
        </button>
        <button
          onClick={() => cambiarModo("individual")}
          className={chip(modo === "individual")}
        >
          Cada uno por su lado
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-texto-suave">
          {modo === "equipos"
            ? "Tocá a cada jugador: 1 toque = Equipo A, 2 toques = Equipo B, 3 = no juega."
            : "Tocá a los que jugaron."}
        </p>
        <div className="flex flex-wrap gap-2">
          {lista.map((p) => {
            const eq = jugadores[p.id];
            return (
              <button
                key={p.id}
                onClick={() => tocar(p.id)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  !eq
                    ? "bg-fondo text-texto-suave ring-1 ring-borde"
                    : modo === "individual" || eq === 1
                      ? "bg-sky-400 font-semibold text-black"
                      : "bg-amber-400 font-semibold text-black"
                }`}
              >
                {p.apodo}
                {modo === "equipos" && eq ? ` · ${eq === 1 ? "A" : "B"}` : ""}
              </button>
            );
          })}
        </div>
      </div>

      {ids.length >= 2 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-texto-suave">¿Quién ganó?</p>
          <div className="flex flex-wrap gap-2">
            {modo === "equipos"
              ? [1, 2].map((eq) => {
                  const del = ids.filter((id) => jugadores[id] === eq);
                  if (!del.length) return null;
                  return (
                    <button
                      key={eq}
                      onClick={() => setGanador(eq)}
                      className={chip(ganador === eq)}
                    >
                      <Star className="mr-1 inline size-3.5" />
                      Equipo {eq === 1 ? "A" : "B"}:{" "}
                      {del
                        .map((id) => perfiles.find((p) => p.id === id)?.apodo)
                        .join(" y ")}
                    </button>
                  );
                })
              : ids.map((id) => (
                  <button
                    key={id}
                    onClick={() => setGanador(id)}
                    className={chip(ganador === id)}
                  >
                    <Star className="mr-1 inline size-3.5" />
                    {perfiles.find((p) => p.id === id)?.apodo}
                  </button>
                ))}
          </div>
        </div>
      )}

      <input
        maxLength={40}
        placeholder={
          ejemplo ? `Resultado (ej: ${ejemplo})` : "Resultado (opcional)"
        }
        value={resultado}
        onChange={(e) => setResultado(e.target.value)}
        className="rounded-xl border border-borde bg-fondo px-3 py-2.5 text-sm outline-none focus:border-acento"
      />

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        disabled={!valido || ocupado}
        onClick={guardar}
        className="flex items-center justify-center gap-2 rounded-xl bg-acento py-3 font-semibold text-black disabled:opacity-50"
      >
        {ocupado && <Loader2 className="size-4 animate-spin" />} Guardar partida
      </button>
    </div>
  );
}
