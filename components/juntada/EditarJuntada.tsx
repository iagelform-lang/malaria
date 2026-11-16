"use client";

import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { aInputLocal, desdeInputLocal } from "@/lib/tiempo";
import { mensajeError } from "@/lib/errores";
import type { Juntada, Perfil } from "@/lib/tipos";
import { CampoComida } from "@/components/juntada/CampoComida";

/**
 * Editar una juntada (quien la creó o un admin).
 * Propuesta: todo. En curso: nombre, lugar y comida. Terminada: solo la comida.
 */
export function EditarJuntada({
  juntada,
  perfiles,
  cerrar,
  guardado,
}: {
  juntada: Juntada;
  perfiles: Perfil[];
  cerrar: () => void;
  guardado: () => void;
}) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const propuesta = juntada.estado === "propuesta";
  const terminada = juntada.estado === "finalizada";
  const [nombre, setNombre] = useState(juntada.nombre);
  const [lugar, setLugar] = useState(juntada.lugar ?? "");
  const [comida, setComida] = useState(juntada.comida ?? "");
  const inicioOriginal = useMemo(() => aInputLocal(new Date(juntada.inicio_programado)), [juntada.inicio_programado]);
  const [inicio, setInicio] = useState(inicioOriginal);
  const [tolerancia, setTolerancia] = useState(juntada.tolerancia_min);
  const [anfitrion, setAnfitrion] = useState(juntada.anfitrion_id);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiaHora = propuesta && inicio !== inicioOriginal;
  const cambiaLugar = !terminada && (lugar.trim() || null) !== (juntada.lugar ?? null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (cambiaHora && new Date(desdeInputLocal(inicio)).getTime() <= Date.now()) {
      return setError("La hora tiene que ser en el futuro.");
    }
    setOcupado(true);
    setError(null);
    const cambios: Partial<Juntada> = { comida: comida.trim() || null };
    if (!terminada) {
      cambios.nombre = nombre.trim();
      cambios.lugar = lugar.trim() || null;
      if (anfitrion !== juntada.anfitrion_id) cambios.anfitrion_id = anfitrion;
    }
    if (propuesta) cambios.tolerancia_min = tolerancia;
    if (cambiaHora) cambios.inicio_programado = desdeInputLocal(inicio);
    const { error } = await supabase.from("juntadas").update(cambios).eq("id", juntada.id);
    setOcupado(false);
    if (error) return setError(mensajeError(error));
    guardado();
  }

  const estiloInput =
    "w-full rounded-xl border border-borde bg-fondo px-3 py-3 outline-none focus:border-acento disabled:opacity-50";

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4 rounded-2xl border border-acento/40 bg-superficie p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Editar juntada</p>
        <button type="button" onClick={cerrar} className="p-1 text-texto-suave" aria-label="Cancelar">
          <X className="size-5" />
        </button>
      </div>

      {!terminada && (
        <>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-texto-suave">¿Qué es?</span>
            <input
              required
              maxLength={60}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={estiloInput}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-texto-suave">Anfitrión (pone la casa y escanea los QR)</span>
            <select value={anfitrion} onChange={(e) => setAnfitrion(e.target.value)} className={estiloInput}>
              {perfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.apodo}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-texto-suave">¿Dónde? (opcional)</span>
            <input maxLength={80} value={lugar} onChange={(e) => setLugar(e.target.value)} className={estiloInput} />
          </label>
        </>
      )}

      <CampoComida valor={comida} cambiar={setComida} claseInput={estiloInput} />

      {propuesta && (
        <>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-texto-suave">¿Cuándo arranca?</span>
            <input
              required
              type="datetime-local"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className={estiloInput}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-texto-suave">Tolerancia para llegar tarde: {tolerancia} min</span>
            <input
              type="range"
              min={0}
              max={60}
              step={5}
              value={tolerancia}
              onChange={(e) => setTolerancia(Number(e.target.value))}
              className="w-full accent-[var(--acento)]"
            />
          </label>
        </>
      )}

      {propuesta && (cambiaHora || cambiaLugar) && (
        <p className="text-xs text-amber-300">Al guardar, a todos les llega un aviso con la hora y el lugar nuevos.</p>
      )}
      {terminada && <p className="text-xs text-texto-suave">La juntada ya terminó: solo se puede completar la comida.</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={ocupado || (!terminada && !nombre.trim())}
        className="flex items-center justify-center gap-2 rounded-xl bg-acento py-3 font-semibold text-black disabled:opacity-50"
      >
        {ocupado && <Loader2 className="size-4 animate-spin" />} Guardar cambios
      </button>
    </form>
  );
}
