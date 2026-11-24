"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, Trash2, X } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/errores";

export type PuntoExtra = {
  id: number;
  perfil_id: string;
  puntos: number;
  motivo: string;
  dado_por: string;
  creado_en: string;
};

const RAPIDOS = [5, 10, 20, 50];

/** Dar o sacar puntos a otro integrante (con motivo), y el historial de todos */
export function PuntosExtra({
  historial,
  perfiles,
  uid,
  esAdmin,
}: {
  historial: PuntoExtra[];
  perfiles: { id: string; apodo: string }[];
  uid: string;
  esAdmin: boolean;
}) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const router = useRouter();
  const [actualizando, iniciar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [quien, setQuien] = useState("");
  const [signo, setSigno] = useState<1 | -1>(1);
  const [cantidad, setCantidad] = useState(10);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verTodo, setVerTodo] = useState(false);

  const apodo = (id: string) => perfiles.find((p) => p.id === id)?.apodo ?? "?";
  const otros = perfiles.filter((p) => p.id !== uid);
  const valido = !!quien && cantidad >= 1 && cantidad <= 100 && motivo.trim().length > 0;
  const trabado = ocupado || actualizando;

  async function dar() {
    if (!valido || trabado) return;
    setOcupado(true);
    setError(null);
    const { error: e } = await supabase
      .from("puntos_extra")
      .insert({ perfil_id: quien, puntos: signo * cantidad, motivo: motivo.trim() });
    setOcupado(false);
    if (e) return setError(mensajeError(e));
    setAbierto(false);
    setQuien("");
    setMotivo("");
    setSigno(1);
    setCantidad(10);
    iniciar(() => router.refresh());
  }

  async function borrar(id: number) {
    if (trabado) return;
    setOcupado(true);
    const { error: e } = await supabase.from("puntos_extra").delete().eq("id", id);
    setOcupado(false);
    if (e) return setError(mensajeError(e));
    iniciar(() => router.refresh());
  }

  const lista = verTodo ? historial : historial.slice(0, 8);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Puntos extra</h2>
        {!abierto && (
          <button
            onClick={() => setAbierto(true)}
            className="flex items-center gap-1 rounded-xl bg-acento px-3 py-2 text-sm font-bold text-white"
          >
            <Plus className="size-4" /> Dar puntos
          </button>
        )}
      </div>

      {abierto && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-acento/40 bg-superficie p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">¿A quién?</p>
            <button onClick={() => setAbierto(false)} aria-label="Cerrar" className="p-1 text-texto-suave">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {otros.map((p) => (
              <button
                key={p.id}
                onClick={() => setQuien(p.id)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  quien === p.id ? "bg-acento font-semibold text-white" : "bg-fondo text-texto"
                }`}
              >
                {p.apodo}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-xl ring-1 ring-borde">
              <button
                onClick={() => setSigno(1)}
                className={`flex items-center gap-1 px-3 py-2 text-sm font-bold ${
                  signo === 1 ? "bg-acento text-white" : "bg-fondo text-texto-suave"
                }`}
              >
                <Plus className="size-4" /> Sumar
              </button>
              <button
                onClick={() => setSigno(-1)}
                className={`flex items-center gap-1 px-3 py-2 text-sm font-bold ${
                  signo === -1 ? "bg-red-600 text-white" : "bg-fondo text-texto-suave"
                }`}
              >
                <Minus className="size-4" /> Restar
              </button>
            </div>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={cantidad}
              onChange={(e) => setCantidad(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              className="w-20 rounded-xl border border-borde bg-fondo px-3 py-2 text-center font-bold outline-none focus:border-acento"
            />
            <span className="text-sm text-texto-suave">pts</span>
          </div>
          <div className="flex gap-1.5">
            {RAPIDOS.map((n) => (
              <button
                key={n}
                onClick={() => setCantidad(n)}
                className={`flex-1 rounded-lg py-1.5 text-sm ${
                  cantidad === n ? "bg-acento/20 font-bold text-acento" : "bg-fondo text-texto-suave"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <input
            type="text"
            maxLength={80}
            placeholder={signo === 1 ? "¿Por qué? Ej: llevó el fernet" : "¿Por qué? Ej: se fue sin saludar"}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="rounded-xl border border-borde bg-fondo px-3 py-3 outline-none focus:border-acento"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={dar}
            disabled={!valido || trabado}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-white disabled:opacity-50 ${
              signo === 1 ? "bg-acento" : "bg-red-600"
            }`}
          >
            {trabado && <Loader2 className="size-4 animate-spin" />}
            {quien
              ? `${signo === 1 ? "Darle" : "Sacarle"} ${cantidad} ${cantidad === 1 ? "punto" : "puntos"} a ${apodo(quien)}`
              : "Elegí a quién"}
          </button>
          <p className="text-xs text-texto-suave">Hasta 100 por vez. Nadie se puede dar puntos a sí mismo.</p>
        </div>
      )}

      {historial.length === 0 ? (
        <p className="rounded-2xl bg-superficie p-4 text-center text-sm text-texto-suave">
          Todavía nadie dio puntos extra.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {lista.map((h) => (
            <div key={h.id} className="flex items-center gap-3 rounded-xl bg-superficie p-3 text-sm">
              <span className={`w-12 shrink-0 text-right font-mono font-bold ${h.puntos > 0 ? "text-acento" : "text-red-600"}`}>
                {h.puntos > 0 ? "+" : ""}
                {h.puntos}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  <b>{apodo(h.perfil_id)}</b> · {h.motivo}
                </p>
                <p className="text-xs text-texto-suave">
                  de {apodo(h.dado_por)} ·{" "}
                  {new Date(h.creado_en).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    timeZone: "America/Argentina/Buenos_Aires",
                  })}
                </p>
              </div>
              {(h.dado_por === uid || esAdmin) && (
                <button
                  onClick={() => borrar(h.id)}
                  disabled={trabado}
                  aria-label="Borrar"
                  className="p-1.5 text-texto-suave"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
          {historial.length > 8 && (
            <button onClick={() => setVerTodo(!verTodo)} className="text-sm text-acento">
              {verTodo ? "Ver menos" : `Ver todos (${historial.length})`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
