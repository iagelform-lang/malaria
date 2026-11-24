// Cuentas: total, cuánto le toca a cada uno, saldos y quién le debe a quién.
// Cada gasto se divide entre todos los participantes o, si se eligió, solo entre algunos.
// Las deudas se redondean a pesos enteros para evitar centavos raros.

export type ConsumoMonto = {
  monto: number | null;
  pagado_por: string | null;
  /** entre quiénes se divide este gasto; vacío o null = entre todos los participantes */
  entre?: string[] | null;
};
export type Pago = { de_perfil: string; a_perfil: string; monto: number };
export type Deuda = { de: string; a: string; monto: number };

export type Cuentas = {
  total: number;
  participantes: string[];
  /** promedio por participante (si todo se divide parejo, es lo que paga cada uno) */
  cuota: number;
  /** true si todos los gastos se dividen entre todos */
  parejo: boolean;
  /** cuánto le toca pagar a cada uno en total */
  aPagar: Map<string, number>;
  /** positivo = le deben; negativo = debe */
  saldos: Map<string, number>;
  deudas: Deuda[];
};

/** Entre quiénes se reparte un gasto */
export function repartoDe(c: ConsumoMonto, participantes: string[]) {
  return c.entre && c.entre.length ? c.entre : participantes;
}

export function calcularCuentas(participantes: string[], consumos: ConsumoMonto[], pagos: Pago[]): Cuentas {
  const total = consumos.reduce((s, c) => s + Number(c.monto ?? 0), 0);
  const n = participantes.length;

  const saldos = new Map<string, number>();
  const aPagar = new Map<string, number>();
  const sumar = (m: Map<string, number>, id: string, v: number) => m.set(id, (m.get(id) ?? 0) + v);

  for (const p of participantes) {
    saldos.set(p, 0);
    aPagar.set(p, 0);
  }
  let parejo = true;
  for (const c of consumos) {
    const monto = Number(c.monto ?? 0);
    if (!monto) continue;
    const entre = repartoDe(c, participantes);
    if (entre !== participantes) parejo = false;
    if (!entre.length) continue;
    const parte = monto / entre.length;
    for (const p of entre) {
      sumar(saldos, p, -parte);
      sumar(aPagar, p, parte);
    }
    if (c.pagado_por) sumar(saldos, c.pagado_por, monto);
  }
  // si A le pagó a B: A debe menos, B tiene menos a favor
  for (const p of pagos) {
    sumar(saldos, p.de_perfil, Number(p.monto));
    sumar(saldos, p.a_perfil, -Number(p.monto));
  }

  return {
    total,
    participantes,
    cuota: n ? total / n : 0,
    parejo,
    aPagar,
    saldos,
    deudas: minimizarDeudas(saldos),
  };
}

/** Empareja deudores con acreedores (de mayor a menor) para hacer la menor cantidad de transferencias */
export function minimizarDeudas(saldos: Map<string, number>): Deuda[] {
  const deudores = [...saldos].filter(([, v]) => v <= -1).map(([id, v]) => ({ id, v: -v }));
  const acreedores = [...saldos].filter(([, v]) => v >= 1).map(([id, v]) => ({ id, v }));
  deudores.sort((a, b) => b.v - a.v);
  acreedores.sort((a, b) => b.v - a.v);

  const deudas: Deuda[] = [];
  let i = 0;
  let j = 0;
  while (i < deudores.length && j < acreedores.length) {
    const monto = Math.min(deudores[i].v, acreedores[j].v);
    const redondo = Math.round(monto);
    if (redondo >= 1) deudas.push({ de: deudores[i].id, a: acreedores[j].id, monto: redondo });
    deudores[i].v -= monto;
    acreedores[j].v -= monto;
    if (deudores[i].v < 1) i++;
    if (acreedores[j].v < 1) j++;
  }
  return deudas;
}

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
export function pesos(v: number) {
  return fmt.format(Math.round(v));
}
