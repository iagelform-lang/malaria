// Juegos del grupo y cálculo de rankings

export type Modo = "equipos" | "individual";
export const JUEGOS: {
  nombre: string;
  emoji: string;
  modo: Modo;
  ejemplo: string;
}[] = [
  { nombre: "Truco", emoji: "🃏", modo: "equipos", ejemplo: "30 a 24" },
  {
    nombre: "Poker",
    emoji: "♠️",
    modo: "individual",
    ejemplo: "se llevó $20.000",
  },
  { nombre: "FIFA", emoji: "🎮", modo: "equipos", ejemplo: "3 a 1" },
  {
    nombre: "Cartas",
    emoji: "🂡",
    modo: "individual",
    ejemplo: "Chinchón, 100 puntos",
  },
  {
    nombre: "Juego de mesa",
    emoji: "🎲",
    modo: "individual",
    ejemplo: "Catan, 10 a 8",
  },
  { nombre: "Terminator", emoji: "🤖", modo: "individual", ejemplo: "" },
];

export const emojiJuego = (juego: string) =>
  JUEGOS.find((j) => j.nombre.toLowerCase() === juego.trim().toLowerCase())
    ?.emoji ?? "🏅";

export type PartidaR = { id: number; juego: string };
export type JugadorR = { partida_id: number; perfil_id: string; gano: boolean };
export type FilaRanking = {
  perfil_id: string;
  jugadas: number;
  ganadas: number;
  pct: number;
};

/** Ranking de victorias: por juego y en total. Sin partidas, listas vacías (nunca NaN). */
export function rankingJuegos(partidas: PartidaR[], jugadores: JugadorR[]) {
  const juegoDe = new Map(partidas.map((p) => [p.id, p.juego.trim()]));
  const tabla = (filtro: (juego: string) => boolean): FilaRanking[] => {
    const m = new Map<string, { jugadas: number; ganadas: number }>();
    for (const j of jugadores) {
      const juego = juegoDe.get(j.partida_id);
      if (juego === undefined || !filtro(juego)) continue;
      const x = m.get(j.perfil_id) ?? { jugadas: 0, ganadas: 0 };
      x.jugadas++;
      if (j.gano) x.ganadas++;
      m.set(j.perfil_id, x);
    }
    return [...m.entries()]
      .map(([perfil_id, x]) => ({
        perfil_id,
        ...x,
        pct: x.jugadas ? Math.round((x.ganadas / x.jugadas) * 100) : 0,
      }))
      .sort(
        (a, b) =>
          b.ganadas - a.ganadas || b.pct - a.pct || b.jugadas - a.jugadas,
      );
  };
  const nombres = [
    ...new Map(
      partidas.map((p) => [p.juego.trim().toLowerCase(), p.juego.trim()]),
    ).values(),
  ];
  const porJuego = nombres
    .map((nombre) => ({
      juego: nombre,
      partidas: partidas.filter(
        (p) => p.juego.trim().toLowerCase() === nombre.toLowerCase(),
      ).length,
      ranking: tabla((j) => j.toLowerCase() === nombre.toLowerCase()),
    }))
    .sort((a, b) => b.partidas - a.partidas);
  return { total: tabla(() => true), porJuego, partidas: partidas.length };
}
