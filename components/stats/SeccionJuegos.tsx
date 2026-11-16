import { Dices } from "lucide-react";
import { emojiJuego, type FilaRanking, type Juego } from "@/lib/juegos";

type Props = {
  total: FilaRanking[];
  porJuego: { juego: string; partidas: number; ranking: FilaRanking[] }[];
  partidas: number;
  apodos: Record<string, string>;
  catalogo?: Pick<Juego, "nombre" | "emoji">[];
  titulo?: boolean;
};

/** Stats de juegos: ranking general de victorias y uno por juego. Sin partidas, todo en 0. */
export function SeccionJuegos({
  total,
  porJuego,
  partidas,
  apodos,
  catalogo = [],
  titulo = true,
}: Props) {
  const campeon = total[0];
  return (
    <section className="flex flex-col gap-3">
      {titulo && (
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-texto-suave">
          <Dices className="size-4" /> Juegos
        </h2>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-superficie p-4">
          <p className="text-2xl font-bold">{partidas}</p>
          <p className="text-xs text-texto-suave">partidas jugadas</p>
        </div>
        <div className="rounded-2xl bg-superficie p-4">
          <p className="truncate text-2xl font-bold">
            {campeon ? (apodos[campeon.perfil_id] ?? "?") : "Nadie todavía"}
          </p>
          <p className="text-xs text-texto-suave">
            👑 el campeón ·{" "}
            {campeon ? `${campeon.ganadas} ganadas` : "0 ganadas"}
          </p>
        </div>
      </div>
      {porJuego.length === 0 && (
        <p className="text-xs text-texto-suave">
          Se llena cuando carguen partidas en una juntada (sección Juegos).
        </p>
      )}
      {porJuego.map((j) => (
        <div
          key={j.juego}
          className="rounded-2xl border border-borde bg-superficie p-4"
        >
          <p className="mb-2 font-semibold">
            {emojiJuego(j.juego, catalogo)} {j.juego}{" "}
            <span className="text-xs font-normal text-texto-suave">
              · {j.partidas} {j.partidas === 1 ? "partida" : "partidas"}
            </span>
          </p>
          <div className="flex flex-col gap-1 text-sm">
            {j.ranking.slice(0, 5).map((r, i) => (
              <div key={r.perfil_id} className="flex items-center gap-2">
                <span className="w-5 text-texto-suave">{i + 1}.</span>
                <span className="flex-1 truncate">
                  {apodos[r.perfil_id] ?? "?"}
                </span>
                <span className="tabular-nums">
                  <b>{r.ganadas}</b>
                  <span className="text-texto-suave">/{r.jugadas}</span>
                </span>
                <span className="w-11 text-right text-xs tabular-nums text-texto-suave">
                  {r.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
