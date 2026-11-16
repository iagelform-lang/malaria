"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, Loader2, Quote, Trash2, X } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/errores";
import type { Perfil } from "@/lib/tipos";

type Frase = {
  id: number;
  perfil_id: string;
  texto: string;
  cargado_por: string;
  frase_votos: { perfil_id: string }[];
};

/** Frases célebres de la juntada: alguien carga lo que dijo otro y el resto le da ❤️ */
export function SeccionFrases({
  juntadaId,
  uid,
  puedeGestionar,
  perfiles,
  puedeCargar,
}: {
  juntadaId: string;
  uid: string;
  puedeGestionar: boolean;
  perfiles: Pick<Perfil, "id" | "apodo">[];
  puedeCargar: boolean;
}) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [frases, setFrases] = useState<Frase[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [quien, setQuien] = useState("");
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState<number | "nueva" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apodo = (id: string) => perfiles.find((p) => p.id === id)?.apodo ?? "?";

  const recargar = useCallback(async () => {
    const { data } = await supabase
      .from("frases")
      .select("id, perfil_id, texto, cargado_por, frase_votos(perfil_id)")
      .eq("juntada_id", juntadaId)
      .order("creado_en");
    if (data) setFrases(data as Frase[]);
  }, [supabase, juntadaId]);

  useEffect(() => {
    const t = setTimeout(recargar, 0);
    const canal = supabase
      .channel(`frases-${juntadaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "frases", filter: `juntada_id=eq.${juntadaId}` }, recargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "frase_votos" }, recargar)
      .subscribe();
    return () => {
      clearTimeout(t);
      supabase.removeChannel(canal);
    };
  }, [supabase, juntadaId, recargar]);

  async function guardar() {
    if (!quien || !texto.trim()) return;
    setOcupado("nueva");
    setError(null);
    const { error } = await supabase
      .from("frases")
      .insert({ juntada_id: juntadaId, perfil_id: quien, texto: texto.trim() });
    setOcupado(null);
    if (error) return setError(mensajeError(error));
    setTexto("");
    setQuien("");
    setAbierto(false);
    await recargar();
  }

  async function votar(f: Frase) {
    const mio = f.frase_votos.some((v) => v.perfil_id === uid);
    setOcupado(f.id);
    const { error } = mio
      ? await supabase.from("frase_votos").delete().eq("frase_id", f.id).eq("perfil_id", uid)
      : await supabase.from("frase_votos").insert({ frase_id: f.id });
    setOcupado(null);
    if (error) setError(mensajeError(error));
    else await recargar();
  }

  async function borrar(id: number) {
    setOcupado(id);
    const { error } = await supabase.from("frases").delete().eq("id", id);
    setOcupado(null);
    if (error) setError(mensajeError(error));
    else await recargar();
  }

  if (!puedeCargar && frases.length === 0) return null;
  const ordenadas = [...frases].sort((a, b) => b.frase_votos.length - a.frase_votos.length);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-texto-suave">
          <Quote className="size-4" /> Frases {frases.length > 0 && `(${frases.length})`}
        </h2>
        {puedeCargar && !abierto && (
          <button
            onClick={() => setAbierto(true)}
            className="flex items-center gap-1 rounded-full bg-acento px-3 py-1.5 text-sm font-semibold text-black"
          >
            + Frase
          </button>
        )}
      </div>

      {abierto && (
        <div className="flex flex-col gap-3 rounded-2xl border border-acento/40 bg-superficie p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">¿Quién dijo qué?</p>
            <button onClick={() => setAbierto(false)} className="p-1 text-texto-suave" aria-label="Cancelar">
              <X className="size-5" />
            </button>
          </div>
          <select
            value={quien}
            onChange={(e) => setQuien(e.target.value)}
            className="rounded-xl border border-borde bg-fondo px-3 py-2.5 outline-none focus:border-acento"
          >
            <option value="">¿Quién la dijo?</option>
            {perfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.apodo}
              </option>
            ))}
          </select>
          <textarea
            maxLength={200}
            rows={2}
            placeholder="La frase, tal cual"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="resize-none rounded-xl border border-borde bg-fondo px-3 py-2.5 outline-none focus:border-acento"
          />
          <button
            disabled={!quien || !texto.trim() || ocupado !== null}
            onClick={guardar}
            className="flex items-center justify-center gap-2 rounded-xl bg-acento py-3 font-semibold text-black disabled:opacity-50"
          >
            {ocupado === "nueva" && <Loader2 className="size-4 animate-spin" />} Guardar frase
          </button>
        </div>
      )}

      {frases.length === 0 && !abierto && (
        <p className="text-sm text-texto-suave">¿Alguien dijo algo para el recuerdo? Cargalo acá.</p>
      )}

      {ordenadas.map((f) => {
        const mio = f.frase_votos.some((v) => v.perfil_id === uid);
        return (
          <div key={f.id} className="flex items-start gap-2 rounded-xl bg-superficie px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="italic">“{f.texto}”</p>
              <Link href={`/persona/${f.perfil_id}`} className="text-xs text-texto-suave">
                — {apodo(f.perfil_id)}
              </Link>
            </div>
            <button
              disabled={ocupado !== null}
              onClick={() => votar(f)}
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-sm ${
                mio ? "bg-rose-500/20 text-rose-300" : "text-texto-suave"
              }`}
              aria-label={mio ? "Quitar me gusta" : "Me gusta"}
            >
              {ocupado === f.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Heart className={`size-4 ${mio ? "fill-current" : ""}`} />
              )}
              {f.frase_votos.length}
            </button>
            {(f.cargado_por === uid || puedeGestionar) && (
              <button
                disabled={ocupado !== null}
                onClick={() => borrar(f.id)}
                className="p-1 text-texto-suave"
                aria-label="Borrar frase"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        );
      })}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
