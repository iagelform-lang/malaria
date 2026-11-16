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

export type Juego = {
  id: number;
  nombre: string;
  emoji: string;
  modo: Modo;
  predeterminado: boolean;
  creado_por: string | null;
};

/** Emoji del juego según el catálogo (o el predeterminado, o 🏅) */
export const emojiJuego = (
  juego: string,
  catalogo: Pick<Juego, "nombre" | "emoji">[] = JUEGOS,
) =>
  [...catalogo, ...JUEGOS].find(
    (j) => j.nombre.toLowerCase() === juego.trim().toLowerCase(),
  )?.emoji ?? "🏅";

export const ejemploResultado = (juego: string) =>
  JUEGOS.find((j) => j.nombre.toLowerCase() === juego.trim().toLowerCase())
    ?.ejemplo ?? "";

export const EMOJIS_JUEGO = [
  "🏅",
  "🎱",
  "🏓",
  "⚽",
  "🏀",
  "🎯",
  "🎳",
  "♟️",
  "🀄",
  "🎤",
  "🍺",
  "🕹️",
];

// ---------- Puntos de cada juntada ----------
export const NIVELES = [
  { puntos: 1, nombre: "Normal", detalle: "1 punto" },
  { puntos: 5, nombre: "Media", detalle: "5 puntos" },
  { puntos: 10, nombre: "Importante", detalle: "10 puntos · ej: cumpleaños" },
] as const;
export const nivelDe = (puntos: number) =>
  NIVELES.find((n) => n.puntos === puntos) ?? NIVELES[0];

/** Puntos por ir: cada uno suma los puntos de las juntadas terminadas a las que fue */
export function rankingPuntos(
  juntadas: { id: string; puntos: number | null }[],
  asistencias: { juntada_id: string; perfil_id: string }[],
) {
  const puntos = new Map(juntadas.map((j) => [j.id, Number(j.puntos) || 1]));
  const vistos = new Set<string>();
  const total = new Map<string, { puntos: number; juntadas: number }>();
  for (const a of asistencias) {
    const p = puntos.get(a.juntada_id);
    const clave = `${a.juntada_id}|${a.perfil_id}`;
    if (p === undefined || vistos.has(clave)) continue;
    vistos.add(clave);
    const x = total.get(a.perfil_id) ?? { puntos: 0, juntadas: 0 };
    x.puntos += p;
    x.juntadas++;
    total.set(a.perfil_id, x);
  }
  return [...total.entries()]
    .map(([perfil_id, x]) => ({ perfil_id, ...x }))
    .sort((a, b) => b.puntos - a.puntos || b.juntadas - a.juntadas);
}

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
