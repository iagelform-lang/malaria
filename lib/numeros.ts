import type { Estadistica } from "@/lib/tipos";

/** Cualquier valor raro (null, undefined, NaN, Infinity, texto) → 0 */
export function aNumero(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** División segura: si el divisor es 0 devuelve 0 en vez de NaN/Infinity */
export function dividir(a: number, b: number) {
  return b ? a / b : 0;
}

/** Todas las métricas de una persona como números (0 si no hay datos) */
export function normalizarEstadistica(s: Partial<Estadistica> & { perfil_id: string; apodo: string }): Estadistica {
  return {
    perfil_id: s.perfil_id,
    apodo: s.apodo,
    juntadas_asistidas: aNumero(s.juntadas_asistidas),
    juntadas_posibles: aNumero(s.juntadas_posibles),
    pct_asistencia: aNumero(s.pct_asistencia),
    horas_totales: aNumero(s.horas_totales),
    promedio_min_por_juntada: aNumero(s.promedio_min_por_juntada),
    pct_puntualidad: aNumero(s.pct_puntualidad),
    veces_dijo_hora: aNumero(s.veces_dijo_hora),
    veces_primero: aNumero(s.veces_primero),
    veces_ultimo: aNumero(s.veces_ultimo),
    veces_planto: aNumero(s.veces_planto),
    elegible_fantasma: Boolean(s.elegible_fantasma),
  };
}
