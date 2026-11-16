// Torneo eliminatorio con sorteo: (cuartos) → semis → tercer puesto → final.
// Puntos por puesto: 1º 100 · 2º 55 · 3º 40 · 4º 25 · 5º a 8º 10.

export const PUNTOS_PUESTO: Record<number, number> = { 1: 100, 2: 55, 3: 40, 4: 25, 5: 10 };
export const puntosDePuesto = (puesto: number) => PUNTOS_PUESTO[Math.min(puesto, 5)] ?? 0;
export const MAX_JUGADORES = 8;

export type Partido = {
  ronda: string; // "Cuartos de final", "Semifinal", "Tercer puesto", "Final"
  a: string | null;
  b: string | null;
  ganador: string | null;
};

export type Torneo = {
  rondas: Partido[][]; // rondas eliminatorias en orden
  tercero: Partido | null;
  final: Partido | null;
};

function nombreRonda(cantPartidos: number) {
  if (cantPartidos === 4) return "Cuartos de final";
  if (cantPartidos === 2) return "Semifinal";
  return "Final";
}

/** Sortea el cuadro. Los lugares vacíos (byes) pasan solos a la ronda siguiente. */
export function sortearTorneo(jugadores: string[], azar: () => number = Math.random): Torneo {
  const l = [...jugadores];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  const tam = l.length <= 2 ? 2 : l.length <= 4 ? 4 : 8;
  // reparto de byes: cada partido tiene al menos un jugador
  const slots: (string | null)[] = Array(tam).fill(null);
  const partidos = tam / 2;
  l.forEach((p, i) => {
    const partido = i % partidos;
    const lado = i < partidos ? 0 : 1;
    slots[partido * 2 + lado] = p;
  });
  const primera: Partido[] = [];
  for (let i = 0; i < tam; i += 2) {
    const a = slots[i];
    const b = slots[i + 1];
    primera.push({ ronda: nombreRonda(partidos), a, b, ganador: a && !b ? a : !a && b ? b : null });
  }
  return avanzar({ rondas: [primera], tercero: null, final: null });
}

/** Arma las rondas siguientes a medida que se completan */
function avanzar(t: Torneo): Torneo {
  let actual = t.rondas[t.rondas.length - 1];
  const rondas = [...t.rondas];
  let tercero = t.tercero;
  let final = t.final;
  // la final y el tercer puesto se arman a partir de las semis (o de la única ronda si son 2)
  while (actual.every((p) => p.ganador) && actual.length > 1) {
    const ganadores = actual.map((p) => p.ganador!);
    if (actual.length === 2) {
      // semis terminadas → tercer puesto + final
      const perdedores = actual
        .map((p) => (p.a && p.b ? (p.ganador === p.a ? p.b : p.a) : null))
        .filter((x): x is string => !!x);
      if (!tercero) {
        tercero = {
          ronda: "Tercer puesto",
          a: perdedores[0] ?? null,
          b: perdedores[1] ?? null,
          ganador: perdedores.length === 1 ? perdedores[0] : perdedores.length === 0 ? null : null,
        };
      }
      if (!final) final = { ronda: "Final", a: ganadores[0], b: ganadores[1], ganador: null };
      break;
    }
    const sig: Partido[] = [];
    for (let i = 0; i < ganadores.length; i += 2) {
      sig.push({ ronda: nombreRonda(ganadores.length / 2), a: ganadores[i], b: ganadores[i + 1], ganador: null });
    }
    rondas.push(sig);
    actual = sig;
  }
  // con 2 jugadores la única ronda ya es la final
  if (rondas.length === 1 && rondas[0].length === 1 && !final) final = rondas[0][0];
  return { rondas, tercero, final };
}

/** Próximo partido a jugar (en orden: rondas, después tercer puesto, después final) */
export function proximoPartido(t: Torneo): Partido | null {
  for (const r of t.rondas) for (const p of r) if (!p.ganador && p.a && p.b) return p;
  if (t.tercero && !t.tercero.ganador && t.tercero.a && t.tercero.b) return t.tercero;
  if (t.final && !t.final.ganador) return t.final;
  return null;
}

/** Marca el ganador de un partido y arma lo que sigue */
export function registrarGanador(t: Torneo, partido: Partido, ganador: string): Torneo {
  const marcar = (p: Partido) => (p === partido ? { ...p, ganador } : p);
  const nuevo: Torneo = {
    rondas: t.rondas.map((r) => r.map(marcar)),
    tercero: t.tercero ? marcar(t.tercero) : null,
    final: t.final ? (t.final === partido ? { ...t.final, ganador } : t.final) : null,
  };
  // si la final era el único partido de la primera ronda, quedan sincronizados
  if (t.rondas.length === 1 && t.rondas[0].length === 1) nuevo.final = nuevo.rondas[0][0];
  return avanzar(nuevo);
}

/** Puestos finales: 1º, 2º, 3º, 4º y 5º (los que perdieron en cuartos). Null si el torneo no terminó. */
export function posiciones(t: Torneo): { perfil: string; puesto: number }[] | null {
  if (!t.final?.ganador) return null;
  if (t.tercero && t.tercero.a && t.tercero.b && !t.tercero.ganador) return null;
  const res: { perfil: string; puesto: number }[] = [];
  const f = t.final;
  res.push({ perfil: f.ganador!, puesto: 1 });
  const subcampeon = f.a === f.ganador ? f.b : f.a;
  if (subcampeon) res.push({ perfil: subcampeon, puesto: 2 });
  if (t.tercero) {
    const tc = t.tercero;
    if (tc.ganador) res.push({ perfil: tc.ganador, puesto: 3 });
    const cuarto = tc.a && tc.b ? (tc.ganador === tc.a ? tc.b : tc.a) : null;
    if (cuarto) res.push({ perfil: cuarto, puesto: 4 });
  }
  // perdedores de cuartos
  if (t.rondas[0].length === 4) {
    for (const p of t.rondas[0]) {
      if (p.a && p.b && p.ganador) res.push({ perfil: p.ganador === p.a ? p.b : p.a, puesto: 5 });
    }
  }
  return res;
}

/** Tabla de puntos de los juegos: suma de lo que dio cada torneo. Define al campeón de los juegos. */
export function tablaTorneos(pos: { perfil_id: string; puesto: number; puntos: number }[]) {
  const m = new Map<string, { puntos: number; torneos: number; titulos: number }>();
  for (const p of pos) {
    const x = m.get(p.perfil_id) ?? { puntos: 0, torneos: 0, titulos: 0 };
    x.puntos += Number(p.puntos) || 0;
    x.torneos++;
    if (p.puesto === 1) x.titulos++;
    m.set(p.perfil_id, x);
  }
  return [...m.entries()]
    .map(([perfil_id, x]) => ({ perfil_id, ...x }))
    .sort((a, b) => b.puntos - a.puntos || b.titulos - a.titulos);
}
