// Estadísticas de gastos a partir de los datos crudos (juntadas finalizadas)
import { calcularCuentas } from "@/lib/cuentas";

export type JuntadaG = { id: string; nombre: string; inicio_programado: string };
export type AsistenciaG = { juntada_id: string; perfil_id: string };
export type ExclusionG = { juntada_id: string; perfil_id: string };
export type ConsumoG = {
  juntada_id: string;
  tipo: "comida" | "postre" | "bebida" | "otro";
  descripcion: string;
  monto: number | null;
  pagado_por: string | null;
};

export type Periodo = "mes" | "anio" | "siempre";

export type ResumenGastos = {
  totalGrupo: number;
  /** quién puso más plata (pagó consumos) */
  banco: { perfil_id: string; puesto: number }[];
  /** gasto propio: lo que le tocó pagar en total y en promedio por juntada */
  porPersona: { perfil_id: string; cuotas: number; juntadas: number; promedio: number }[];
  masCara: { nombre: string; cuota: number; fecha: string } | null;
  ultimaCena: { nombre: string; fecha: string; comidas: string[]; postres: string[] } | null;
  comidaFavorita: { nombre: string; veces: number } | null;
};

function enPeriodo(iso: string, periodo: Periodo, ahora: Date) {
  if (periodo === "siempre") return true;
  // comparar en hora argentina (UTC-3)
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000);
  const h = new Date(ahora.getTime() - 3 * 3600_000);
  if (d.getUTCFullYear() !== h.getUTCFullYear()) return false;
  return periodo === "anio" || d.getUTCMonth() === h.getUTCMonth();
}

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export function resumirGastos(
  juntadas: JuntadaG[],
  asistencias: AsistenciaG[],
  exclusiones: ExclusionG[],
  consumos: ConsumoG[],
  periodo: Periodo,
  ahora = new Date(),
): ResumenGastos {
  const js = juntadas
    .filter((j) => enPeriodo(j.inicio_programado, periodo, ahora))
    .sort((a, b) => a.inicio_programado.localeCompare(b.inicio_programado));

  const puesto = new Map<string, number>();
  const cuotas = new Map<string, { total: number; n: number }>();
  let totalGrupo = 0;
  let masCara: ResumenGastos["masCara"] = null;
  let ultimaCena: ResumenGastos["ultimaCena"] = null;
  const conteoComida = new Map<string, { nombre: string; veces: number }>();

  for (const j of js) {
    const cs = consumos.filter((c) => c.juntada_id === j.id);
    const fuera = new Set(exclusiones.filter((e) => e.juntada_id === j.id).map((e) => e.perfil_id));
    const participantes = [...new Set(asistencias.filter((a) => a.juntada_id === j.id).map((a) => a.perfil_id))].filter(
      (p) => !fuera.has(p),
    );
    const cuentas = calcularCuentas(participantes, cs, []);
    totalGrupo += cuentas.total;

    for (const c of cs)
      if (c.monto && c.pagado_por) puesto.set(c.pagado_por, (puesto.get(c.pagado_por) ?? 0) + c.monto);
    if (cuentas.total > 0) {
      for (const p of participantes) {
        const prev = cuotas.get(p) ?? { total: 0, n: 0 };
        cuotas.set(p, { total: prev.total + cuentas.cuota, n: prev.n + 1 });
      }
      if (!masCara || cuentas.cuota > masCara.cuota)
        masCara = { nombre: j.nombre, cuota: cuentas.cuota, fecha: j.inicio_programado };
    }

    const comidas = cs.filter((c) => c.tipo === "comida").map((c) => c.descripcion);
    if (comidas.length)
      ultimaCena = {
        nombre: j.nombre,
        fecha: j.inicio_programado,
        comidas,
        postres: cs.filter((c) => c.tipo === "postre").map((c) => c.descripcion),
      };
    for (const d of comidas) {
      const k = normalizar(d);
      const prev = conteoComida.get(k);
      conteoComida.set(k, { nombre: prev?.nombre ?? d, veces: (prev?.veces ?? 0) + 1 });
    }
  }

  const fav = [...conteoComida.values()].sort((a, b) => b.veces - a.veces)[0];

  return {
    totalGrupo,
    banco: [...puesto].map(([perfil_id, v]) => ({ perfil_id, puesto: v })).sort((a, b) => b.puesto - a.puesto),
    porPersona: [...cuotas]
      .map(([perfil_id, v]) => ({ perfil_id, cuotas: v.total, juntadas: v.n, promedio: v.total / v.n }))
      .sort((a, b) => b.cuotas - a.cuotas),
    masCara,
    ultimaCena,
    comidaFavorita: fav && fav.veces > 1 ? fav : null,
  };
}
