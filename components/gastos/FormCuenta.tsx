"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/errores";

type PerfilS = { id: string; apodo: string };
type CuentaE = { id: string; nombre: string; emoji: string; miembros: string[] };

const EMOJIS = ["💸", "✈️", "🏖️", "🏕️", "🛒", "🎁", "🍻", "🚗"];

/** Crear una cuenta suelta (viaje, compra en común) o editar una existente */
export function FormCuenta({
  perfiles,
  uid,
  cuenta,
  puedeBorrar,
}: {
  perfiles: PerfilS[];
  uid: string;
  cuenta?: CuentaE;
  puedeBorrar?: boolean;
}) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(cuenta?.nombre ?? "");
  const [emoji, setEmoji] = useState(cuenta?.emoji ?? "✈️");
  const [miembros, setMiembros] = useState<string[]>(cuenta?.miembros ?? [uid]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);

  const valido = nombre.trim().length > 0 && miembros.length >= 2;

  async function guardar() {
    setOcupado(true);
    setError(null);
    const datos = { nombre: nombre.trim(), emoji, miembros };
    const res = cuenta
      ? await supabase.from("cuentas").update(datos).eq("id", cuenta.id).select("id").single()
      : await supabase.from("cuentas").insert(datos).select("id").single();
    setOcupado(false);
    if (res.error) return setError(mensajeError(res.error));
    setAbierto(false);
    if (cuenta) router.refresh();
    else router.push(`/gastos/${res.data.id}`);
  }

  async function borrar() {
    setOcupado(true);
    const { error: e } = await supabase.from("cuentas").delete().eq("id", cuenta!.id);
    setOcupado(false);
    if (e) return setError(mensajeError(e));
    router.replace("/gastos");
    router.refresh();
  }

  if (!abierto)
    return (
      <button
        onClick={() => setAbierto(true)}
        className={
          cuenta
            ? "rounded-full bg-superficie px-3 py-1.5 text-sm text-texto-suave ring-1 ring-borde"
            : "flex items-center justify-center gap-2 rounded-2xl border border-dashed border-borde py-4 text-texto-suave"
        }
      >
        {cuenta ? (
          "Editar"
        ) : (
          <>
            <Plus className="size-4" /> Nueva cuenta (viaje, compra en común…)
          </>
        )}
      </button>
    );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4">
      <div className="flex gap-1.5 overflow-x-auto">
        {EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => setEmoji(e)}
            className={`rounded-xl px-2.5 py-1.5 text-xl ${emoji === e ? "bg-acento/20 ring-1 ring-acento" : "bg-fondo"}`}
          >
            {e}
          </button>
        ))}
      </div>
      <input
        autoFocus
        maxLength={60}
        placeholder="Viaje a la costa"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className="rounded-xl border border-borde bg-fondo px-3 py-3 outline-none focus:border-acento"
      />
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-texto-suave">¿Quiénes están? (mínimo 2)</p>
        <div className="flex flex-wrap gap-1.5">
          {perfiles.map((p) => {
            const adentro = miembros.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => setMiembros(adentro ? miembros.filter((x) => x !== p.id) : [...miembros, p.id])}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  adentro ? "bg-acento/20 text-acento ring-1 ring-acento/40" : "bg-fondo text-texto-suave"
                }`}
              >
                {p.apodo}
              </button>
            );
          })}
        </div>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={!valido || ocupado}
          onClick={guardar}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-acento py-3 font-semibold text-black disabled:opacity-50"
        >
          {ocupado && <Loader2 className="size-4 animate-spin" />}
          {cuenta ? "Guardar" : "Crear cuenta"}
        </button>
        <button onClick={() => setAbierto(false)} className="rounded-xl border border-borde px-4">
          Cancelar
        </button>
      </div>
      {cuenta &&
        puedeBorrar &&
        (borrando ? (
          <div className="flex gap-2">
            <button
              onClick={borrar}
              className="flex-1 rounded-xl bg-red-500/90 py-2.5 text-sm font-semibold text-white"
            >
              Sí, borrar la cuenta con todos sus gastos
            </button>
            <button onClick={() => setBorrando(false)} className="rounded-xl border border-borde px-4 text-sm">
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setBorrando(true)}
            className="flex items-center justify-center gap-1.5 text-sm text-texto-suave"
          >
            <Trash2 className="size-4" /> Borrar cuenta
          </button>
        ))}
    </div>
  );
}
