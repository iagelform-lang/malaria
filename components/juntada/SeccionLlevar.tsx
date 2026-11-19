"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/errores";
import type { Perfil } from "@/lib/tipos";

type Item = { id: number; item: string; perfil_id: string | null; creado_por: string };

const SUGERENCIAS = ["Bebida", "Hielo", "Carbón", "Postre", "Pan", "Vasos", "Picada"];

/** "¿Quién lleva qué?": lista de cosas para llevar donde cada uno se anota */
export function SeccionLlevar({
  juntadaId,
  uid,
  puedeGestionar,
  perfiles,
  abierta,
}: {
  juntadaId: string;
  uid: string;
  puedeGestionar: boolean;
  perfiles: Perfil[];
  abierta: boolean;
}) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [items, setItems] = useState<Item[]>([]);
  const [nuevo, setNuevo] = useState("");
  const [ocupado, setOcupado] = useState<number | "nuevo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apodo = (id: string | null) => perfiles.find((p) => p.id === id)?.apodo ?? "?";

  const recargar = useCallback(async () => {
    const { data } = await supabase.from("llevar").select("*").eq("juntada_id", juntadaId).order("creado_en");
    if (data) setItems(data as Item[]);
  }, [supabase, juntadaId]);

  useEffect(() => {
    const t = setTimeout(recargar, 0);
    const canal = supabase
      .channel(`llevar-${juntadaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "llevar", filter: `juntada_id=eq.${juntadaId}` }, recargar)
      .subscribe();
    return () => {
      clearTimeout(t);
      supabase.removeChannel(canal);
    };
  }, [supabase, juntadaId, recargar]);

  async function correr(clave: number | "nuevo", fn: () => PromiseLike<{ error: { message?: string } | null }>) {
    setOcupado(clave);
    setError(null);
    const { error } = await fn();
    setOcupado(null);
    if (error) setError(mensajeError(error));
    else await recargar();
  }

  function agregar(texto: string, yoLoLlevo = false) {
    const limpio = texto.trim();
    if (!limpio) return;
    setNuevo("");
    correr("nuevo", () =>
      supabase.from("llevar").insert({ juntada_id: juntadaId, item: limpio, perfil_id: yoLoLlevo ? uid : null }),
    );
  }

  const yaEstan = new Set(items.map((i) => i.item.toLowerCase()));
  const sugeridas = SUGERENCIAS.filter((s) => !yaEstan.has(s.toLowerCase()));

  if (!abierta && items.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-1.5 text-lg font-bold">
        <ShoppingBag className="size-4" /> Qué llevar
      </h2>

      {items.length === 0 && (
        <p className="text-sm text-texto-suave">Agregá lo que hace falta y cada uno se anota con lo que lleva.</p>
      )}

      {items.map((i) => {
        const mio = i.perfil_id === uid;
        const libre = i.perfil_id === null;
        return (
          <div key={i.id} className="flex items-center gap-2 rounded-xl bg-superficie px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.item}</p>
              <p className={`text-xs ${libre ? "text-amber-700" : "text-texto-suave"}`}>
                {libre ? "Nadie lo lleva todavía" : mio ? "Lo llevás vos" : `Lo lleva ${apodo(i.perfil_id)}`}
              </p>
            </div>
            {abierta && (libre || mio) && (
              <button
                disabled={ocupado !== null}
                onClick={() =>
                  correr(i.id, () => supabase.from("llevar").update({ perfil_id: libre ? uid : null }).eq("id", i.id))
                }
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  libre ? "bg-acento text-white" : "bg-fondo text-texto-suave ring-1 ring-borde"
                }`}
              >
                {ocupado === i.id ? <Loader2 className="size-3.5 animate-spin" /> : libre ? "Lo llevo yo" : "Ya no"}
              </button>
            )}
            {abierta && (i.creado_por === uid || puedeGestionar) && (
              <button
                disabled={ocupado !== null}
                onClick={() => correr(i.id, () => supabase.from("llevar").delete().eq("id", i.id))}
                className="p-1 text-texto-suave"
                aria-label="Borrar"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        );
      })}

      {abierta && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              agregar(nuevo);
            }}
            className="flex gap-2"
          >
            <input
              maxLength={40}
              placeholder="Agregar algo (ej: fernet)"
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-borde bg-superficie px-3 py-2.5 text-sm outline-none focus:border-acento"
            />
            <button
              type="submit"
              disabled={!nuevo.trim() || ocupado !== null}
              className="rounded-xl bg-acento px-3 text-white disabled:opacity-50"
              aria-label="Agregar"
            >
              {ocupado === "nuevo" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            </button>
          </form>
          {sugeridas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sugeridas.map((s) => (
                <button
                  key={s}
                  disabled={ocupado !== null}
                  onClick={() => agregar(s)}
                  className="rounded-full bg-superficie px-2.5 py-1 text-xs text-texto-suave ring-1 ring-borde"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
