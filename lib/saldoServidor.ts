import type { SupabaseClient } from "@supabase/supabase-js";
import { saldoGeneral, type Contexto, type Pago } from "@/lib/cuentas";

export type CuentaSuelta = {
  id: string;
  nombre: string;
  emoji: string;
  miembros: string[];
  creado_por: string;
  creado_en: string;
};

type ConsumoS = {
  juntada_id: string | null;
  cuenta_id: string | null;
  monto: number | string | null;
  pagado_por: string | null;
  entre: string[] | null;
};
type PagoS = {
  id: number;
  juntada_id: string | null;
  cuenta_id: string | null;
  de_perfil: string;
  a_perfil: string;
  monto: number | string;
  creado_en: string;
};

/** Junta los gastos de todas las juntadas y cuentas sueltas y calcula el saldo general */
export async function cargarSaldoGeneral(supabase: SupabaseClient) {
  const [{ data: js }, { data: asis }, { data: excl }, { data: cons }, { data: pags }, { data: cts }] =
    await Promise.all([
      supabase
        .from("juntadas")
        .select("id, nombre, inicio_programado")
        .in("estado", ["activa", "finalizada"])
        .order("inicio_programado", { ascending: false }),
      supabase.from("asistencias").select("juntada_id, perfil_id"),
      supabase.from("exclusiones_gasto").select("juntada_id, perfil_id"),
      supabase.from("consumos").select("juntada_id, cuenta_id, monto, pagado_por, entre").not("monto", "is", null),
      supabase
        .from("pagos")
        .select("id, juntada_id, cuenta_id, de_perfil, a_perfil, monto, creado_en")
        .order("creado_en", { ascending: false }),
      supabase
        .from("cuentas")
        .select("id, nombre, emoji, miembros, creado_por, creado_en")
        .order("creado_en", { ascending: false }),
    ]);

  const consumos = (cons ?? []) as ConsumoS[];
  const pagos = ((pags ?? []) as PagoS[]).map((p) => ({ ...p, monto: Number(p.monto) }));
  const cuentas = (cts ?? []) as CuentaSuelta[];
  const aConsumo = (c: ConsumoS) => ({
    monto: c.monto == null ? null : Number(c.monto),
    pagado_por: c.pagado_por,
    entre: c.entre,
  });
  const aPago = (p: { de_perfil: string; a_perfil: string; monto: number }): Pago => ({
    de_perfil: p.de_perfil,
    a_perfil: p.a_perfil,
    monto: p.monto,
  });

  const contextos: Contexto[] = [];
  for (const j of (js ?? []) as { id: string; nombre: string }[]) {
    const cs = consumos.filter((c) => c.juntada_id === j.id);
    const ps = pagos.filter((p) => p.juntada_id === j.id);
    if (!cs.length && !ps.length) continue;
    const fuera = new Set((excl ?? []).filter((e) => e.juntada_id === j.id).map((e) => e.perfil_id as string));
    const participantes = [
      ...new Set((asis ?? []).filter((a) => a.juntada_id === j.id).map((a) => a.perfil_id as string)),
    ].filter((p) => !fuera.has(p));
    contextos.push({
      clave: `/juntada/${j.id}`,
      nombre: j.nombre,
      participantes,
      consumos: cs.map(aConsumo),
      pagos: ps.map(aPago),
    });
  }
  for (const c of cuentas) {
    contextos.push({
      clave: `/gastos/${c.id}`,
      nombre: `${c.emoji} ${c.nombre}`,
      participantes: c.miembros,
      consumos: consumos.filter((x) => x.cuenta_id === c.id).map(aConsumo),
      pagos: pagos.filter((p) => p.cuenta_id === c.id).map(aPago),
    });
  }
  const generales = pagos.filter((p) => !p.juntada_id && !p.cuenta_id);

  return { ...saldoGeneral(contextos, generales.map(aPago)), cuentas, pagosGenerales: generales };
}
