import { rankingPuntos } from "@/lib/juegos";

// Cálculo del "Malaria Wrapped": el resumen del año del grupo. Todo da 0 / null si no hay datos.

export type JW = {
  id: string;
  nombre: string;
  lugar: string | null;
  comida: string | null;
  anfitrion_id: string;
  inicio_programado: string;
  puntos?: number | null;
  iniciada_en: string | null;
  finalizada_en: string | null;
};
export type AW = { juntada_id: string; perfil_id: string; entrada: string };
export type CW = {
  juntada_id: string;
  perfil_id: string;
  va: boolean;
  hora_prometida: string | null;
};
export type GW = {
  juntada_id: string;
  monto: number | string | null;
  pagado_por: string | null;
};

export type Persona = { id: string; valor: number };

export type Wrapped = {
  juntadas: number;
  horas: number;
  asistentes: Persona[]; // ranking de juntadas a las que fue
  puntual: Persona | null; // minutos promedio de diferencia (negativo = llegó antes)
  tardon: Persona | null;
  fantasma: Persona | null; // dijo que iba y no fue
  anfitrion: Persona | null; // el que más juntadas armó
  banco: Persona | null; // el que más pagó
  gastoTotal: number;
  comida: { texto: string; veces: number } | null;
  lugar: { texto: string; veces: number } | null;
  masLarga: { nombre: string; horas: number } | null;
  campeon: Persona | null; // el que más partidas ganó
  puntos: Persona[]; // tabla de puntos del año (ir a la juntada suma sus puntos)
};
export type PW = { id: number; juntada_id: string };
export type JugW = { partida_id: number; perfil_id: string; gano: boolean };

/** ¿La juntada fue en ese año (hora de Buenos Aires)? */
export function esDelAnio(iso: string, anio: number) {
  return (
    new Date(new Date(iso).getTime() - 3 * 3600_000).getUTCFullYear() === anio
  );
}

function masRepetido(valores: (string | null)[]) {
  const cuenta = new Map<string, { texto: string; veces: number }>();
  for (const v of valores) {
    if (!v?.trim()) continue;
    const clave = v.trim().toLowerCase();
    const prev = cuenta.get(clave);
    cuenta.set(clave, {
      texto: prev?.texto ?? v.trim(),
      veces: (prev?.veces ?? 0) + 1,
    });
  }
  return [...cuenta.values()].sort((a, b) => b.veces - a.veces)[0] ?? null;
}

function maximo(mapa: Map<string, number>, menor = false): Persona | null {
  let mejor: Persona | null = null;
  for (const [id, valor] of mapa) {
    if (!mejor || (menor ? valor < mejor.valor : valor > mejor.valor))
      mejor = { id, valor };
  }
  return mejor;
}

export function calcularWrapped(
  juntadas: JW[],
  asistencias: AW[],
  confirmaciones: CW[],
  gastos: GW[],
  partidas: PW[] = [],
  jugadores: JugW[] = [],
  eventos: { id: number; puntos: number | null }[] = [],
  voyEventos: { fecha_id: number; perfil_id: string; dia: string }[] = [],
  hoy = "9999-12-31",
  extras: { perfil_id: string; puntos: number }[] = [],
): Wrapped {
  const ids = new Set(juntadas.map((j) => j.id));
  const asis = asistencias.filter((a) => ids.has(a.juntada_id));
  const conf = confirmaciones.filter((c) => ids.has(c.juntada_id));
  const gas = gastos.filter((g) => ids.has(g.juntada_id));

  // horas juntos y la más larga
  let horas = 0;
  let masLarga: Wrapped["masLarga"] = null;
  for (const j of juntadas) {
    if (!j.iniciada_en || !j.finalizada_en) continue;
    const h = Math.max(
      0,
      (new Date(j.finalizada_en).getTime() -
        new Date(j.iniciada_en).getTime()) /
        3_600_000,
    );
    horas += h;
    if (!masLarga || h > masLarga.horas)
      masLarga = { nombre: j.nombre, horas: h };
  }

  // a cuántas fue cada uno, y su primera llegada en cada juntada
  const fue = new Map<string, Set<string>>();
  const llegada = new Map<string, number>(); // "juntada|perfil" → primera entrada
  for (const a of asis) {
    if (!fue.has(a.perfil_id)) fue.set(a.perfil_id, new Set());
    fue.get(a.perfil_id)!.add(a.juntada_id);
    const clave = `${a.juntada_id}|${a.perfil_id}`;
    const t = new Date(a.entrada).getTime();
    if (!llegada.has(clave) || t < llegada.get(clave)!) llegada.set(clave, t);
  }
  const asistentes = [...fue.entries()]
    .map(([id, s]) => ({ id, valor: s.size }))
    .sort((a, b) => b.valor - a.valor);

  // puntualidad: llegada real vs. la hora que dijo
  const demoras = new Map<string, number[]>();
  const plantones = new Map<string, number>();
  for (const c of conf) {
    if (!c.va || !c.hora_prometida) continue;
    const t = llegada.get(`${c.juntada_id}|${c.perfil_id}`);
    if (t === undefined) {
      plantones.set(c.perfil_id, (plantones.get(c.perfil_id) ?? 0) + 1);
      continue;
    }
    const min = (t - new Date(c.hora_prometida).getTime()) / 60_000;
    demoras.set(c.perfil_id, [...(demoras.get(c.perfil_id) ?? []), min]);
  }
  const promedio = new Map(
    [...demoras].map(([id, v]) => [
      id,
      Math.round(v.reduce((s, x) => s + x, 0) / v.length),
    ]),
  );

  const anfitriones = new Map<string, number>();
  for (const j of juntadas)
    anfitriones.set(j.anfitrion_id, (anfitriones.get(j.anfitrion_id) ?? 0) + 1);

  const pagado = new Map<string, number>();
  let gastoTotal = 0;
  for (const g of gas) {
    const m = Number(g.monto ?? 0) || 0;
    gastoTotal += m;
    if (g.pagado_por && m > 0)
      pagado.set(g.pagado_por, (pagado.get(g.pagado_por) ?? 0) + m);
  }

  const partidasDelAnio = new Set(
    partidas.filter((p) => ids.has(p.juntada_id)).map((p) => p.id),
  );
  const victorias = new Map<string, number>();
  for (const j of jugadores) {
    if (j.gano && partidasDelAnio.has(j.partida_id))
      victorias.set(j.perfil_id, (victorias.get(j.perfil_id) ?? 0) + 1);
  }

  const tablaPuntos = rankingPuntos(juntadas, asis, eventos, voyEventos, hoy, extras).map((f) => ({
    id: f.perfil_id,
    valor: f.puntos,
  }));

  return {
    puntos: tablaPuntos,
    campeon: maximo(victorias),
    juntadas: juntadas.length,
    horas: Math.round(horas),
    asistentes,
    puntual: maximo(promedio, true),
    tardon: promedio.size > 1 ? maximo(promedio) : null,
    fantasma: maximo(plantones),
    anfitrion: maximo(anfitriones),
    banco: maximo(pagado),
    gastoTotal,
    comida: masRepetido(juntadas.map((j) => j.comida)),
    lugar: masRepetido(juntadas.map((j) => j.lugar)),
    masLarga: masLarga
      ? { ...masLarga, horas: Math.round(masLarga.horas * 10) / 10 }
      : null,
  };
}
