"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarHeart, Loader2, Plus, Trash2, X } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { useAhora } from "@/lib/hooks/useAhora";
import { nombreRango, ordenarProximas, type FechaEspecial } from "@/lib/fechas";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const DIAS_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function FechasGrupo({ fechas, esAdmin, uid }: { fechas: FechaEspecial[]; esAdmin: boolean; uid: string }) {
  const router = useRouter();
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const ahora = useAhora(60_000);
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [dia, setDia] = useState(1);
  const [mes, setMes] = useState(1);
  const [desde, setDesde] = useState("");
  const [lugar, setLugar] = useState("");
  const [duracion, setDuracion] = useState(1);
  const [borrando, setBorrando] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lista = ahora ? ordenarProximas(fechas, new Date(ahora)) : [];

  async function guardar() {
    setOcupado(true);
    setError(null);
    const anio = desde.trim() ? Number(desde) : null;
    const { error } = await supabase.from("fechas_especiales").insert({
      nombre: nombre.trim(),
      dia: Math.min(dia, DIAS_MES[mes - 1]),
      mes,
      desde_anio: anio,
      lugar: lugar.trim() || null,
      duracion_dias: duracion,
    });
    setOcupado(false);
    if (error) return setError("No se pudo guardar. Revisá la fecha.");
    setAbierto(false);
    setNombre("");
    setDesde("");
    setLugar("");
    setDuracion(1);
    router.refresh();
  }

  async function borrar(id: number) {
    setOcupado(true);
    await supabase.from("fechas_especiales").delete().eq("id", id);
    setOcupado(false);
    setBorrando(null);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">Fechas del grupo</h2>
        {!abierto && (
          <button
            onClick={() => setAbierto(true)}
            className="flex items-center gap-1 rounded-full bg-acento px-3 py-1.5 text-sm font-semibold text-black"
          >
            <Plus className="size-4" /> Agregar
          </button>
        )}
      </div>

      {abierto && (
        <div className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4">
          <input
            autoFocus
            maxLength={40}
            placeholder="Ej: El Malariaso, Cumple de Juan"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="rounded-xl border border-borde bg-fondo px-3 py-3 outline-none focus:border-acento"
          />
          <div className="flex gap-2">
            <select
              value={dia}
              onChange={(e) => setDia(Number(e.target.value))}
              className="rounded-xl border border-borde bg-fondo px-3 py-3 outline-none"
            >
              {Array.from({ length: DIAS_MES[mes - 1] }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="flex-1 rounded-xl border border-borde bg-fondo px-3 py-3 outline-none"
            >
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <select
            value={duracion}
            onChange={(e) => setDuracion(Number(e.target.value))}
            className="rounded-xl border border-borde bg-fondo px-3 py-3 text-sm outline-none"
          >
            {Array.from({ length: 14 }, (_, k) => k + 1).map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "Dura 1 día" : `Dura ${n} días`}
              </option>
            ))}
          </select>
          <input
            maxLength={60}
            placeholder="Sede (opcional, ej: Hebraica)"
            value={lugar}
            onChange={(e) => setLugar(e.target.value)}
            className="rounded-xl border border-borde bg-fondo px-3 py-3 text-sm outline-none focus:border-acento"
          />
          <input
            inputMode="numeric"
            maxLength={4}
            placeholder="Desde qué año (opcional, para contar los años)"
            value={desde}
            onChange={(e) => setDesde(e.target.value.replace(/\D/g, ""))}
            className="rounded-xl border border-borde bg-fondo px-3 py-3 text-sm outline-none focus:border-acento"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={!nombre.trim() || ocupado || (desde !== "" && desde.length !== 4)}
              onClick={guardar}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-acento py-3 font-semibold text-black disabled:opacity-50"
            >
              {ocupado && <Loader2 className="size-4 animate-spin" />} Guardar
            </button>
            <button onClick={() => setAbierto(false)} className="rounded-xl border border-borde px-4">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {fechas.length === 0 && !abierto && (
        <p className="rounded-2xl border border-dashed border-borde p-4 text-center text-sm text-texto-suave">
          Agregá el día del grupo o tu cumpleaños y aparece la cuenta regresiva en el inicio.
        </p>
      )}

      {lista.map((f) => (
        <div key={f.id} className="flex items-center gap-3 rounded-2xl bg-superficie p-3">
          <CalendarHeart className="size-6 shrink-0 text-acento" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{f.nombre}</p>
            <p className="text-xs text-texto-suave">
              {nombreRango(f)}
              {f.desde_anio && ` · desde ${f.desde_anio}`}
              {f.lugar && ` · 📍 ${f.lugar}`}
            </p>
          </div>
          <span className={`text-sm font-semibold ${f.enCurso ? "text-acento" : ""}`}>
            {f.enCurso ? "¡En curso!" : `en ${f.dias} ${f.dias === 1 ? "día" : "días"}`}
          </span>
          {(esAdmin || f.creado_por === uid) &&
            (borrando === f.id ? (
              <button
                disabled={ocupado}
                onClick={() => borrar(f.id)}
                className="rounded-lg bg-red-500/90 px-2 py-1 text-xs font-semibold text-white"
              >
                Borrar
              </button>
            ) : (
              <button onClick={() => setBorrando(f.id)} className="p-1 text-texto-suave" aria-label="Borrar">
                <Trash2 className="size-4" />
              </button>
            ))}
        </div>
      ))}
    </section>
  );
}
