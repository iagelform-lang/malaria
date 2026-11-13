"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Loader2, MapPin } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { useAhora } from "@/lib/hooks/useAhora";
import { etiquetaDia, nombreRango, ordenarProximas, type FechaEspecial, type Proxima } from "@/lib/fechas";

export type Voy = { fecha_id: number; perfil_id: string; dia: string };

type Props = { fechas: FechaEspecial[]; voy: Voy[]; apodos: Record<string, string>; uid: string };

// Tarjeta en el inicio: la próxima fecha del grupo (cuenta regresiva o "en curso") con el botón "Voy"
export function ProximaFecha({ fechas, voy, apodos, uid }: Props) {
  const ahora = useAhora(60_000);
  if (!ahora || fechas.length === 0) return null;
  const p = ordenarProximas(fechas, new Date(ahora))[0];
  return (
    <Tarjeta
      key={`${p.id}-${p.anio}`}
      p={p}
      voy={voy.filter((v) => v.fecha_id === p.id)}
      apodos={apodos}
      uid={uid}
      hoyIdx={p.enCurso ? (p.diaDelEvento ?? 1) - 1 : -1}
    />
  );
}

function Tarjeta({
  p,
  voy,
  apodos,
  uid,
  hoyIdx,
}: {
  p: Proxima;
  voy: Voy[];
  apodos: Record<string, string>;
  uid: string;
  hoyIdx: number;
}) {
  const router = useRouter();
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const delEvento = voy.filter((v) => p.diasEvento.includes(v.dia));
  const misDias = new Set(delEvento.filter((v) => v.perfil_id === uid).map((v) => v.dia));
  const personas = new Set(delEvento.map((v) => v.perfil_id));
  const cumple = p.cumple && p.cumple > 0 ? `${p.cumple} ${p.cumple === 1 ? "año" : "años"}` : null;
  const festejo = p.enCurso;

  async function alternar(dia: string) {
    setOcupado(dia);
    setError(null);
    const { error } = misDias.has(dia)
      ? await supabase.from("fechas_asistencia").delete().eq("fecha_id", p.id).eq("perfil_id", uid).eq("dia", dia)
      : await supabase.from("fechas_asistencia").insert({ fecha_id: p.id, dia });
    setOcupado(null);
    if (error) setError("No se pudo guardar. Probá de nuevo.");
    else router.refresh();
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl ${
        festejo
          ? "bg-gradient-to-br from-acento via-lime-300 to-amber-300 text-black"
          : "border border-borde bg-superficie"
      }`}
    >
      <div className="flex items-center gap-4 p-4">
        {festejo ? (
          <span className="text-4xl">🎉</span>
        ) : (
          <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-acento/15 text-center leading-none">
            <span className="text-2xl font-black text-acento">{p.dias}</span>
            <span className="text-[10px] text-texto-suave">{p.dias === 1 ? "día" : "días"}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-xs ${festejo ? "font-semibold uppercase tracking-wide" : "text-texto-suave"}`}>
            {festejo
              ? p.duracion > 1
                ? `Estamos en · día ${p.diaDelEvento} de ${p.duracion}`
                : "Hoy es"
              : p.dias === 1
                ? "Mañana empieza"
                : "Falta poco para"}
          </p>
          <p className={`truncate font-black leading-tight ${festejo ? "text-2xl" : "text-lg"}`}>{p.nombre}</p>
          <p className={`flex flex-wrap items-center gap-x-1 text-xs ${festejo ? "" : "text-texto-suave"}`}>
            {nombreRango(p)}
            {cumple && <span>· cumplen {cumple}</span>}
            {p.lugar && (
              <span className="flex items-center gap-0.5">
                · <MapPin className="size-3" /> {p.lugar}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 pb-4">
        <button
          onClick={() => setAbierto(!abierto)}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold ${
            misDias.size
              ? festejo
                ? "bg-black text-acento"
                : "bg-acento/15 text-acento"
              : festejo
                ? "bg-black text-white"
                : "bg-acento text-black"
          }`}
        >
          {misDias.size ? (
            <>
              <Check className="size-4" /> Voy {misDias.size} {misDias.size === 1 ? "día" : "días"}
            </>
          ) : (
            "Voy"
          )}
          {abierto ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        <span className={`text-xs ${festejo ? "" : "text-texto-suave"}`}>
          {personas.size
            ? `${personas.size} ${personas.size === 1 ? "confirmó" : "confirmaron"}`
            : "Nadie confirmó todavía"}
        </span>
      </div>

      {abierto && (
        <div
          className={`flex flex-col gap-3 border-t px-4 py-4 ${festejo ? "border-black/10 bg-black/5" : "border-borde"}`}
        >
          <p className={`text-xs ${festejo ? "" : "text-texto-suave"}`}>
            {p.duracion > 1 ? "Tocá los días que vas:" : "Tocá para confirmar:"}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {p.diasEvento.map((d, i) => {
              const marcado = misDias.has(d);
              const pasado = hoyIdx >= 0 && i < hoyIdx;
              const cuantos = delEvento.filter((v) => v.dia === d).length;
              return (
                <button
                  key={d}
                  disabled={pasado || ocupado !== null}
                  onClick={() => alternar(d)}
                  className={`flex flex-col items-center rounded-xl py-2 text-sm transition active:scale-95 disabled:opacity-40 ${
                    marcado
                      ? "bg-acento font-bold text-black ring-2 ring-black/20"
                      : festejo
                        ? "bg-white/60"
                        : "bg-fondo"
                  }`}
                >
                  {ocupado === d ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <span className="capitalize">{etiquetaDia(d)}</span>
                  )}
                  <span className="text-[10px] opacity-70">{cuantos ? `${cuantos} van` : "—"}</span>
                </button>
              );
            })}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}

          {personas.size > 0 && (
            <div className="flex flex-col gap-1 text-xs">
              {p.diasEvento.map((d) => {
                const quienes = delEvento.filter((v) => v.dia === d).map((v) => apodos[v.perfil_id] ?? "?");
                return quienes.length ? (
                  <p key={d}>
                    <b className="capitalize">{etiquetaDia(d)}:</b> {quienes.join(", ")}
                  </p>
                ) : null;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
