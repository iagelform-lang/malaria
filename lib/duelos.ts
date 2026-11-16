// Duelos 1 vs 1: partidas sin torneo con exactamente 2 jugadores

export type DueloLista = {
  id: number;
  juego: string;
  resultado: string | null;
  torneo_id?: number | null;
  partida_jugadores: { perfil_id: string; gano: boolean }[];
};

export const esDuelo = (p: DueloLista) => !p.torneo_id && p.partida_jugadores.length === 2;

/** Historial cara a cara: por cada par, cuántos ganó cada uno (en todos los juegos) */
export function caraACara(duelos: DueloLista[]) {
  const m = new Map<string, { a: string; b: string; ganA: number; ganB: number }>();
  for (const d of duelos.filter(esDuelo)) {
    const [x, y] = [...d.partida_jugadores].sort((p, q) => p.perfil_id.localeCompare(q.perfil_id));
    const clave = `${x.perfil_id}|${y.perfil_id}`;
    const r = m.get(clave) ?? { a: x.perfil_id, b: y.perfil_id, ganA: 0, ganB: 0 };
    if (x.gano) r.ganA++;
    if (y.gano) r.ganB++;
    m.set(clave, r);
  }
  return [...m.values()].sort((p, q) => q.ganA + q.ganB - (p.ganA + p.ganB));
}
