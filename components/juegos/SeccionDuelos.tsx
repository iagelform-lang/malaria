"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Swords, Trash2 } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/errores";
import { caraACara, type DueloLista } from "@/lib/duelos";
import { emojiJuego, type Juego } from "@/lib/juegos";

type Duelo = DueloLista & { cargado_por: string; juntadas: { nombre: string } | null };

/** Historial de duelos 1 vs 1: el cara a cara de cada par y los últimos duelos */
export function SeccionDuelos({
  duelos,
  apodos,
  catalogo,
  uid,
  esAdmin,
}: {
  duelos: Duelo[];
  apodos: Record<string, string>;
  catalogo: Pick<Juego, "nombre" | "emoji">[];
  uid: string;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [filtro, setFiltro] = useState<string>("todos");
  const [error, setError] = useState<string | null>(null);
  const juegos = [...new Set(duelos.map((d) => d.juego))];
  const lista = filtro === "todos" ? duelos : duelos.filter((d) => d.juego === filtro);
  const pares = caraACara(lista);
  const ap = (id: string) => apodos[id] ?? "?";

  async function borrar(id: number) {
    setError(null);
    const { error } = await supabase.from("partidas").delete().eq("id", id);
    if (error) return setError(mensajeError(error));
    router.refresh();
  }

  return (
    <section id="duelos" className="flex scroll-mt-4 flex-col gap-2">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-texto-suave">
        <Swords className="size-4" /> Duelos 1 vs 1
      </h2>
      {duelos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borde p-4 text-center text-sm text-texto-suave">
          Todavía no hay duelos. Entrá a un juego y elegí <b>Duelo 1 vs 1</b>.
        </p>
      ) : (
        <>
          {juegos.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {["todos", ...juegos].map((j) => (
                <button
                  key={j}
                  onClick={() => setFiltro(j)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    filtro === j ? "bg-acento font-semibold text-black" : "bg-superficie text-texto-suave ring-1 ring-borde"
                  }`}
                >
                  {j === "todos" ? "Todos" : `${emojiJuego(j, catalogo)} ${j}`}
                </button>
              ))}
            </div>
          )}

          <p className="text-xs font-semibold text-texto-suave">Cara a cara</p>
          {pares.map((p) => (
            <div key={`${p.a}|${p.b}`} className="flex items-center gap-2 rounded-xl bg-superficie px-3 py-2 text-sm">
              <span className={`flex-1 truncate text-right ${p.ganA > p.ganB ? "font-bold text-acento" : ""}`}>{ap(p.a)}</span>
              <span className="shrink-0 font-black tabular-nums">
                {p.ganA} - {p.ganB}
              </span>
              <span className={`flex-1 truncate ${p.ganB > p.ganA ? "font-bold text-acento" : ""}`}>{ap(p.b)}</span>
            </div>
          ))}

          <p className="mt-2 text-xs font-semibold text-texto-suave">Últimos duelos</p>
          {lista.slice(0, 15).map((d) => {
            const g = d.partida_jugadores.find((j) => j.gano);
            const per = d.partida_jugadores.find((j) => !j.gano);
            return (
              <div key={d.id} className="flex items-center gap-3 rounded-xl bg-superficie px-3 py-2.5">
                <span className="text-xl leading-none">{emojiJuego(d.juego, catalogo)}</span>
                <div className="min-w-0 flex-1 text-sm">
                  <p>
                    🏆 <b>{g ? ap(g.perfil_id) : "?"}</b> le ganó a {per ? ap(per.perfil_id) : "?"}
                    {d.resultado && <span className="text-texto-suave"> · {d.resultado}</span>}
                  </p>
                  <p className="text-xs text-texto-suave">
                    {d.juego}
                    {d.juntadas?.nombre ? ` · en ${d.juntadas.nombre}` : ""}
                  </p>
                </div>
                {(esAdmin || d.cargado_por === uid) && (
                  <button onClick={() => borrar(d.id)} className="p-1 text-texto-suave" aria-label="Borrar duelo">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
