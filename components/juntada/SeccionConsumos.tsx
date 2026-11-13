"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, Undo2, UserMinus, UserPlus, X } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { calcularCuentas, pesos } from "@/lib/cuentas";
import { mensajeError } from "@/lib/errores";
import type { Perfil } from "@/lib/tipos";

export type TipoConsumo = "comida" | "postre" | "bebida" | "otro";

type Consumo = {
  id: number;
  tipo: TipoConsumo;
  descripcion: string;
  monto: number | null;
  pagado_por: string | null;
  cargado_por: string;
};
type PagoFila = { id: number; de_perfil: string; a_perfil: string; monto: number };

export const TIPOS: { clave: TipoConsumo; etiqueta: string; emoji: string }[] = [
  { clave: "comida", etiqueta: "Comida", emoji: "🍖" },
  { clave: "postre", etiqueta: "Postre", emoji: "🍰" },
  { clave: "bebida", etiqueta: "Bebida", emoji: "🍺" },
  { clave: "otro", etiqueta: "Otro", emoji: "🧾" },
];

type Props = {
  juntadaId: string;
  uid: string;
  puedeGestionar: boolean;
  perfiles: Perfil[];
  idsQueVinieron: string[];
};

export function SeccionConsumos({ juntadaId, uid, puedeGestionar, perfiles, idsQueVinieron }: Props) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [consumos, setConsumos] = useState<Consumo[]>([]);
  const [excluidos, setExcluidos] = useState<string[]>([]);
  const [pagos, setPagos] = useState<PagoFila[]>([]);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState<Consumo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const apodo = useCallback((id: string | null) => perfiles.find((p) => p.id === id)?.apodo ?? "?", [perfiles]);
  const fui = idsQueVinieron.includes(uid);
  const puedeCargar = fui || puedeGestionar;

  const recargar = useCallback(async () => {
    const [c, e, p] = await Promise.all([
      supabase.from("consumos").select("*").eq("juntada_id", juntadaId).order("creado_en"),
      supabase.from("exclusiones_gasto").select("perfil_id").eq("juntada_id", juntadaId),
      supabase.from("pagos").select("*").eq("juntada_id", juntadaId).order("creado_en"),
    ]);
    if (c.data)
      setConsumos(c.data.map((x) => ({ ...x, monto: x.monto == null ? null : Number(x.monto) })) as Consumo[]);
    if (e.data) setExcluidos(e.data.map((x) => x.perfil_id as string));
    if (p.data) setPagos(p.data.map((x) => ({ ...x, monto: Number(x.monto) })) as PagoFila[]);
  }, [supabase, juntadaId]);

  useEffect(() => {
    // primera carga diferida para no bloquear el render
    const t = setTimeout(recargar, 0);
    const filtro = `juntada_id=eq.${juntadaId}`;
    const canal = supabase
      .channel(`consumos-${juntadaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "consumos", filter: filtro }, recargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "pagos", filter: filtro }, recargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "exclusiones_gasto", filter: filtro }, recargar)
      .subscribe();
    return () => {
      clearTimeout(t);
      supabase.removeChannel(canal);
    };
  }, [supabase, juntadaId, recargar]);

  const participantes = idsQueVinieron.filter((p) => !excluidos.includes(p));
  const cuentas = calcularCuentas(participantes, consumos, pagos);
  const porTipo = TIPOS.map((t) => ({ ...t, items: consumos.filter((c) => c.tipo === t.clave) })).filter(
    (t) => t.items.length,
  );

  async function correr(fn: () => PromiseLike<{ error: { message?: string } | null }>, ok?: string) {
    setOcupado(true);
    setAviso(null);
    const { error } = await fn();
    setOcupado(false);
    if (error) setAviso(mensajeError(error));
    else {
      if (ok) setAviso(ok);
      await recargar();
    }
    return !error;
  }

  async function guardar(datos: Omit<Consumo, "id" | "cargado_por">) {
    const ok = await correr(() =>
      editando
        ? supabase.from("consumos").update(datos).eq("id", editando.id)
        : supabase.from("consumos").insert({ ...datos, juntada_id: juntadaId }),
    );
    if (ok) {
      setFormAbierto(false);
      setEditando(null);
    }
  }

  const puedeEditar = (c: Consumo) => c.cargado_por === uid || puedeGestionar;
  const puedeSaldar = (de: string, a: string) => uid === de || uid === a || puedeGestionar;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">Consumos</h2>
        {puedeCargar && !formAbierto && (
          <button
            onClick={() => {
              setEditando(null);
              setFormAbierto(true);
            }}
            className="flex items-center gap-1 rounded-full bg-acento px-3 py-1.5 text-sm font-semibold text-black"
          >
            <Plus className="size-4" /> Agregar
          </button>
        )}
      </div>

      {aviso && (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-borde bg-superficie p-3 text-sm">
          <span>{aviso}</span>
          <button onClick={() => setAviso(null)}>
            <X className="size-4 text-texto-suave" />
          </button>
        </div>
      )}

      {formAbierto && (
        <FormConsumo
          key={editando?.id ?? "nuevo"}
          inicial={editando}
          uid={uid}
          opcionesPago={perfiles.filter((p) => idsQueVinieron.includes(p.id) || p.id === editando?.pagado_por)}
          ocupado={ocupado}
          onGuardar={guardar}
          onCancelar={() => {
            setFormAbierto(false);
            setEditando(null);
          }}
        />
      )}

      {consumos.length === 0 && !formAbierto && (
        <p className="rounded-2xl border border-dashed border-borde p-4 text-center text-sm text-texto-suave">
          {puedeCargar ? "Anotá lo que comieron, el postre y lo que gastaron." : "Todavía no cargaron nada."}
        </p>
      )}

      {porTipo.map((t) => (
        <div key={t.clave} className="flex flex-col gap-1.5">
          <p className="text-xs text-texto-suave">
            {t.emoji} {t.etiqueta}
          </p>
          {t.items.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl bg-superficie px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.descripcion}</p>
                {c.monto != null && <p className="text-xs text-texto-suave">Pagó {apodo(c.pagado_por)}</p>}
              </div>
              {c.monto != null && <span className="font-mono text-sm">{pesos(c.monto)}</span>}
              {puedeEditar(c) && (
                <>
                  <button
                    onClick={() => {
                      setEditando(c);
                      setFormAbierto(true);
                    }}
                    className="p-1 text-texto-suave"
                    aria-label="Editar"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <BorrarConfirmando onBorrar={() => correr(() => supabase.from("consumos").delete().eq("id", c.id))} />
                </>
              )}
            </div>
          ))}
        </div>
      ))}

      {cuentas.total > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-acento/30 bg-acento/5 p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-texto-suave">Total</p>
              <p className="text-2xl font-bold">{pesos(cuentas.total)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-texto-suave">
                Cada uno ({participantes.length} {participantes.length === 1 ? "persona" : "personas"})
              </p>
              <p className="text-2xl font-bold text-acento">{pesos(cuentas.cuota)}</p>
            </div>
          </div>

          {/* Quiénes entran en la división */}
          <div className="flex flex-wrap gap-1.5">
            {idsQueVinieron.map((id) => {
              const fuera = excluidos.includes(id);
              const Icono = fuera ? UserPlus : UserMinus;
              return (
                <button
                  key={id}
                  disabled={!puedeGestionar || ocupado}
                  onClick={() =>
                    correr(() =>
                      fuera
                        ? supabase.from("exclusiones_gasto").delete().eq("juntada_id", juntadaId).eq("perfil_id", id)
                        : supabase.from("exclusiones_gasto").insert({ juntada_id: juntadaId, perfil_id: id }),
                    )
                  }
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                    fuera ? "bg-fondo text-texto-suave line-through" : "bg-superficie"
                  }`}
                >
                  {puedeGestionar && <Icono className="size-3" />}
                  {apodo(id)}
                </button>
              );
            })}
          </div>
          {puedeGestionar && (
            <p className="-mt-1 text-[11px] text-texto-suave">
              Tocá a alguien para sacarlo de la división (ej: no comió).
            </p>
          )}

          {/* Quién le debe a quién */}
          {cuentas.deudas.length > 0 ? (
            <div className="flex flex-col gap-1.5 border-t border-borde pt-3">
              {cuentas.deudas.map((d) => (
                <div key={`${d.de}-${d.a}`} className="flex items-center gap-2 text-sm">
                  <p className="flex-1">
                    <b>{apodo(d.de)}</b> le debe <b>{pesos(d.monto)}</b> a <b>{apodo(d.a)}</b>
                  </p>
                  {puedeSaldar(d.de, d.a) && (
                    <button
                      disabled={ocupado}
                      onClick={() =>
                        correr(
                          () =>
                            supabase
                              .from("pagos")
                              .insert({ juntada_id: juntadaId, de_perfil: d.de, a_perfil: d.a, monto: d.monto }),
                          `Listo: ${apodo(d.de)} le pagó ${pesos(d.monto)} a ${apodo(d.a)}.`,
                        )
                      }
                      className="flex items-center gap-1 rounded-lg bg-acento px-2.5 py-1 text-xs font-semibold text-black"
                    >
                      <Check className="size-3.5" /> Saldado
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="border-t border-borde pt-3 text-sm text-acento">✓ Cuentas claras, nadie le debe a nadie.</p>
          )}

          {pagos.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-borde pt-3">
              <p className="text-xs text-texto-suave">Pagos registrados</p>
              {pagos.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-xs text-texto-suave">
                  <span className="flex-1">
                    {apodo(p.de_perfil)} → {apodo(p.a_perfil)} · {pesos(p.monto)}
                  </span>
                  {puedeSaldar(p.de_perfil, p.a_perfil) && (
                    <button
                      onClick={() => correr(() => supabase.from("pagos").delete().eq("id", p.id))}
                      className="flex items-center gap-1"
                    >
                      <Undo2 className="size-3" /> Deshacer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function BorrarConfirmando({ onBorrar }: { onBorrar: () => void }) {
  const [seguro, setSeguro] = useState(false);
  return seguro ? (
    <button
      onClick={() => {
        setSeguro(false);
        onBorrar();
      }}
      className="rounded-lg bg-red-500/90 px-2 py-1 text-xs font-semibold text-white"
    >
      Borrar
    </button>
  ) : (
    <button onClick={() => setSeguro(true)} className="p-1 text-texto-suave" aria-label="Borrar">
      <Trash2 className="size-4" />
    </button>
  );
}

function FormConsumo({
  inicial,
  uid,
  opcionesPago,
  ocupado,
  onGuardar,
  onCancelar,
}: {
  inicial: Consumo | null;
  uid: string;
  opcionesPago: Perfil[];
  ocupado: boolean;
  onGuardar: (d: { tipo: TipoConsumo; descripcion: string; monto: number | null; pagado_por: string | null }) => void;
  onCancelar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoConsumo>(inicial?.tipo ?? "comida");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [monto, setMonto] = useState(inicial?.monto != null ? String(inicial.monto) : "");
  const [pagadoPor, setPagadoPor] = useState(
    inicial?.pagado_por ?? (opcionesPago.some((p) => p.id === uid) ? uid : (opcionesPago[0]?.id ?? "")),
  );

  const montoNum = monto.trim() === "" ? null : Number(monto.replace(/\./g, "").replace(",", "."));
  const valido = descripcion.trim().length > 0 && (montoNum === null || (!isNaN(montoNum) && montoNum >= 0));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4">
      <div className="grid grid-cols-4 gap-1.5">
        {TIPOS.map((t) => (
          <button
            key={t.clave}
            onClick={() => setTipo(t.clave)}
            className={`flex flex-col items-center rounded-xl py-2 text-xs ${
              tipo === t.clave ? "bg-acento font-semibold text-black" : "bg-fondo text-texto-suave"
            }`}
          >
            <span className="text-lg">{t.emoji}</span>
            {t.etiqueta}
          </button>
        ))}
      </div>
      <input
        autoFocus
        maxLength={80}
        placeholder={tipo === "postre" ? "Helado de Freddo" : tipo === "bebida" ? "Fernet y birras" : "Asado y choris"}
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        className="rounded-xl border border-borde bg-fondo px-3 py-3 outline-none focus:border-acento"
      />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-suave">$</span>
          <input
            inputMode="decimal"
            placeholder="Monto (opcional)"
            value={monto}
            onChange={(e) => setMonto(e.target.value.replace(/[^\d.,]/g, ""))}
            className="w-full rounded-xl border border-borde bg-fondo py-3 pl-7 pr-3 outline-none focus:border-acento"
          />
        </div>
        {montoNum !== null && (
          <select
            value={pagadoPor}
            onChange={(e) => setPagadoPor(e.target.value)}
            className="max-w-[45%] rounded-xl border border-borde bg-fondo px-2 text-sm outline-none"
          >
            {opcionesPago.map((p) => (
              <option key={p.id} value={p.id}>
                Pagó {p.apodo}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex gap-2">
        <button
          disabled={!valido || ocupado}
          onClick={() =>
            onGuardar({
              tipo,
              descripcion: descripcion.trim(),
              monto: montoNum,
              pagado_por: montoNum !== null ? pagadoPor || null : null,
            })
          }
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-acento py-3 font-semibold text-black disabled:opacity-50"
        >
          {ocupado && <Loader2 className="size-4 animate-spin" />}
          {inicial ? "Guardar cambios" : "Agregar"}
        </button>
        <button onClick={onCancelar} className="rounded-xl border border-borde px-4">
          Cancelar
        </button>
      </div>
    </div>
  );
}
