import type { Estadistica } from "@/lib/tipos";

export type Insignia = {
  clave: string;
  titulo: string;
  emoji: string;
  descripcion: string;
  ganadores: string[]; // apodos (puede haber empate)
  valor: string; // ej. "7 veces"
  pendiente?: string; // por qué todavía no hay ganador
};

const num = (v: unknown) => Number(v ?? 0);

/** Devuelve todos los que empatan en el mejor valor (si el mejor es 0, nadie gana) */
function mejores(stats: Estadistica[], valor: (s: Estadistica) => number, menorGana = false) {
  if (!stats.length) return { ganadores: [] as Estadistica[], v: 0 };
  const vals = stats.map(valor);
  const v = menorGana ? Math.min(...vals) : Math.max(...vals);
  if (!menorGana && v <= 0) return { ganadores: [], v };
  return { ganadores: stats.filter((s) => valor(s) === v), v };
}

export function calcularInsignias(stats: Estadistica[]): Insignia[] {
  const pionero = mejores(stats, (s) => num(s.veces_primero));
  const ultimo = mejores(stats, (s) => num(s.veces_ultimo));
  const aguante = mejores(stats, (s) => num(s.horas_totales));
  const chamuyero = mejores(stats, (s) => num(s.veces_planto));

  // Fantasma: menor % de asistencia entre los que tuvieron ≥ 3 juntadas posibles;
  // si empatan, el que menos se queda en promedio
  const elegibles = stats.filter((s) => s.elegible_fantasma);
  let fantasma = mejores(elegibles, (s) => num(s.pct_asistencia), true);
  if (fantasma.ganadores.length > 1) {
    fantasma = {
      ...mejores(fantasma.ganadores, (s) => num(s.promedio_min_por_juntada), true),
      v: fantasma.v,
    };
  }

  const nombres = (l: Estadistica[]) => l.map((s) => s.apodo);
  const veces = (n: number) => `${n} ${n === 1 ? "vez" : "veces"}`;

  return [
    {
      clave: "pionero",
      titulo: "El Pionero",
      emoji: "🚀",
      descripcion: "El que más veces llegó primero",
      ganadores: nombres(pionero.ganadores),
      valor: veces(pionero.v),
    },
    {
      clave: "aguante",
      titulo: "El Aguante",
      emoji: "🔋",
      descripcion: "Más horas acumuladas en juntadas",
      ganadores: nombres(aguante.ganadores),
      valor: `${aguante.v.toLocaleString("es-AR")} h`,
    },
    {
      clave: "ultimo",
      titulo: "Último en apagar la luz",
      emoji: "💡",
      descripcion: "El que más veces se fue último",
      ganadores: nombres(ultimo.ganadores),
      valor: veces(ultimo.v),
    },
    {
      clave: "fantasma",
      titulo: "El Fantasma",
      emoji: "👻",
      descripcion: "Menor asistencia (entre los que tuvieron 3+ juntadas)",
      ganadores: nombres(fantasma.ganadores),
      valor: `${fantasma.v.toLocaleString("es-AR")}% de asistencia`,
      pendiente: elegibles.length ? undefined : "Se define cuando haya 3 juntadas terminadas",
    },
    {
      clave: "chamuyero",
      titulo: "El Chamuyero",
      emoji: "🤥",
      descripcion: "Dijo a qué hora llegaba y nunca apareció",
      ganadores: nombres(chamuyero.ganadores),
      valor: veces(chamuyero.v),
    },
  ];
}
