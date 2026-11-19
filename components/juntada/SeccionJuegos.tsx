"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Dices, Plus, Trash2 } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/errores";
import { emojiJuego } from "@/lib/juegos";
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
        <h2 className="flex items-center gap-1.5 text-lg font-bold">
          <Dices className="size-4" /> Juegos{" "}
          {partidas.length > 0 && `(${partidas.length})`}
        </h2>
        {puedeCargar && (
          <Link
            href="/juegos"
            className="flex items-center gap-1 rounded-full bg-acento px-3 py-1.5 text-sm font-semibold text-white"
          >
            <Plus className="size-4" /> Jugar
          </Link>
        )}
      </div>

      {enCurso && puedeCargar && (
        <Link
          href={`/juntada/${juntadaId}/bid`}
          className="flex items-center justify-between rounded-xl bg-superficie px-3 py-2.5 ring-1 ring-acento/40"
        >
          <span className="font-semibold">🔨 Jugar Bid Womens</span>
          <span className="text-xs text-texto-suave">subasta + torneo →</span>
        </Link>
      )}


      {partidas.length === 0 && (
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
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}

