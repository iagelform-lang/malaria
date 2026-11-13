// Cuentas de una juntada: total, cuota por persona, saldos y quién le debe a quién.
// Todo en pesos enteros para evitar centavos raros.

export type ConsumoMonto = { monto: number | null; pagado_por: string | null };
export type Pago = { de_perfil: string; a_perfil: string; monto: number };
export type Deuda = { de: string; a: string; monto: number };

export type Cuentas = {
  total: number;
  participantes: string[];
  cuota: number;
  /** positivo = le deben; negativo = debe */
  saldos: Map<string, number>;
  deudas: Deuda[];
};

export function calcularCuentas(participantes: string[], consumos: ConsumoMonto[], pagos: Pago[]): Cuentas {
  const total = consumos.reduce((s, c) => s + Number(c.monto ?? 0), 0);
  const n = participantes.length;
  const cuota = n ? total / n : 0;

  const saldos = new Map<string, number>();
  const sumar = (id: string, v: number) => saldos.set(id, (saldos.get(id) ?? 0) + v);

  for (const p of participantes) sumar(p, -cuota);
  for (const c of consumos) if (c.monto && c.pagado_por) sumar(c.pagado_por, Number(c.monto));
  // si A le pagó a B: A debe menos, B tiene menos a favor
  for (const p of pagos) {
    sumar(p.de_perfil, Number(p.monto));
    sumar(p.a_perfil, -Number(p.monto));
  }

  // Emparejar deudores con acreedores (de mayor a menor) para minimizar transferencias
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

  return { total, participantes, cuota, saldos, deudas };
}

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
export function pesos(v: number) {
  return fmt.format(Math.round(v));
}
