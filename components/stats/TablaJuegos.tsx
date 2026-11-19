import Link from "next/link";
import { Crown } from "lucide-react";

type Fila = { perfil_id: string; puntos: number; torneos: number; titulos: number };

/** Puntos de los torneos: 1º 100 · 2º 55 · 3º 40 · 4º 25 · 5º a 8º 10. El primero es el campeón de los juegos. */
export function TablaJuegos({ filas, apodos }: { filas: Fila[]; apodos: Record<string, string> }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-1.5 text-lg font-bold">
        <Crown className="size-4" /> Puntos de juegos
      </h2>
      <div className="flex flex-col gap-1 rounded-2xl border border-borde bg-superficie p-3">
        {filas.length === 0 ? (
          <p className="p-2 text-sm text-texto-suave">
            Todos en 0. Cada torneo reparte: 1º 100 · 2º 55 · 3º 40 · 4º 25 · 5º a 8º 10.
          </p>
        ) : (
          filas.map((f, i) => {
            const puesto = filas.findIndex((x) => x.puntos === f.puntos);
            return (
              <div key={f.perfil_id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm">
                <span className="w-6 text-texto-suave">{puesto < 3 ? ["👑", "🥈", "🥉"][puesto] : `${puesto + 1}.`}</span>
                <Link href={`/persona/${f.perfil_id}`} className="flex-1 truncate font-medium">
                  {apodos[f.perfil_id] ?? "?"}
                </Link>
                <span className="text-xs text-texto-suave">
                  {f.titulos > 0 && `🏆${f.titulos} · `}
                  {f.torneos} {f.torneos === 1 ? "torneo" : "torneos"}
                </span>
                <span className="w-12 text-right text-base font-black tabular-nums text-acento">{f.puntos}</span>
                <span className="sr-only">{i}</span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
