import { Star } from "lucide-react";

type Fila = { perfil_id: string; puntos: number; juntadas: number };

/** Tabla de puntos: juntadas a las que fue (normal 10, salida 30, asado 50, viaje/cumple 70) + eventos donde marcó Voy */
export function RankingPuntos({
  filas,
  apodos,
  uid,
}: {
  filas: Fila[];
  apodos: Record<string, string>;
  uid: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-texto-suave">
        <Star className="size-4" /> Tabla de puntos
      </h2>
      <div className="flex flex-col gap-1 rounded-2xl border border-borde bg-superficie p-3">
        {filas.length === 0 && (
          <p className="p-2 text-sm text-texto-suave">
            Todos en 0. Ir a una juntada normal suma 10 puntos, a una salida
            30, a un asado 50 y a un viaje o cumpleaños 70.
          </p>
        )}
        {filas.map((f, i) => (
          <div
            key={f.perfil_id}
            className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm ${f.perfil_id === uid ? "bg-acento/10" : ""}`}
          >
            <span className="w-6 text-texto-suave">
              {i < 3 ? ["🥇", "🥈", "🥉"][i] : `${i + 1}.`}
            </span>
            <span className="flex-1 truncate font-medium">
              {apodos[f.perfil_id] ?? "?"}
            </span>
            <span className="text-xs text-texto-suave">
              {f.juntadas} {f.juntadas === 1 ? "vez" : "veces"}
            </span>
            <span className="w-14 text-right text-base font-black tabular-nums text-acento">
              {f.puntos}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
