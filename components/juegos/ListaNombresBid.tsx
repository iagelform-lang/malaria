"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mensajeError } from "@/lib/errores";

export type NombreBid = { id: number; nombre: string };

/** Lista compartida de nombres de Bid Womens: cualquiera agrega o borra */
export function ListaNombresBid({
  supabase,
  lista,
  onCambio,
}: {
  supabase: SupabaseClient;
  lista: NombreBid[];
  onCambio: () => void;
}) {
  const [nuevo, setNuevo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function agregar() {
    const nombre = nuevo.trim();
    if (!nombre) return;
    setOcupado(true);
    setError(null);
    const { error: e } = await supabase
      .from("bid_nombres")
      .upsert({ nombre }, { onConflict: "clave", ignoreDuplicates: true });
    setOcupado(false);
    if (e) return setError(mensajeError(e));
    setNuevo("");
    onCambio();
  }

  async function borrar(id: number) {
    const { error: e } = await supabase.from("bid_nombres").delete().eq("id", id);
    if (e) return setError(mensajeError(e));
    onCambio();
  }

  return (
    <details className="rounded-2xl border border-borde bg-superficie p-3">
      <summary className="cursor-pointer font-semibold">
        📋 Lista de nombres <span className="font-normal text-texto-suave">({lista.length})</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-texto-suave">
          Cargá nombres cuando quieras. Lo que escriban en una partida se suma solo. Con 10 o más, al jugar se pueden
          tirar al azar desde acá.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={40}
            placeholder="Agregar un nombre"
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && agregar()}
            className="min-w-0 flex-1 rounded-xl border border-borde bg-fondo px-3 py-2.5 outline-none focus:border-acento"
          />
          <button
            onClick={agregar}
            disabled={!nuevo.trim() || ocupado}
            className="flex items-center gap-1 rounded-xl bg-acento px-3 font-semibold text-white disabled:opacity-50"
          >
            {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Agregar
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {lista.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[...lista]
              .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
              .map((n) => (
                <span key={n.id} className="flex items-center gap-1 rounded-full bg-fondo py-1 pl-3 pr-1 text-sm">
                  {n.nombre}
                  <button onClick={() => borrar(n.id)} aria-label={`Borrar ${n.nombre}`} className="rounded-full p-1 text-texto-suave">
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
          </div>
        )}
      </div>
    </details>
  );
}
