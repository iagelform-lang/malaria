"use client";

import Link from "next/link";
import { useAhora } from "@/lib/hooks/useAhora";
import { nombreFecha, ordenarProximas, type FechaEspecial } from "@/lib/fechas";

// Tarjeta en el inicio: cuenta regresiva a la próxima fecha del grupo (o festejo si es hoy)
export function ProximaFecha({ fechas }: { fechas: FechaEspecial[] }) {
  const ahora = useAhora(60_000);
  if (!ahora || fechas.length === 0) return null;

  const p = ordenarProximas(fechas, new Date(ahora))[0];
  const cumple = p.cumple && p.cumple > 0 ? `${p.cumple} ${p.cumple === 1 ? "año" : "años"}` : null;

  if (p.dias === 0) {
    return (
      <Link
        href="/grupo"
        className="block overflow-hidden rounded-2xl bg-gradient-to-br from-acento via-lime-300 to-amber-300 p-5 text-black"
      >
        <p className="text-4xl">🎉🥳🎂</p>
        <p className="mt-2 text-sm font-semibold uppercase tracking-wide">Hoy es</p>
        <p className="text-3xl font-black leading-tight">{p.nombre}</p>
        {cumple && <p className="mt-1 font-semibold">¡{cumple}!</p>}
      </Link>
    );
  }

  return (
    <Link href="/grupo" className="flex items-center gap-4 rounded-2xl border border-borde bg-superficie p-4">
      <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-acento/15 text-center leading-none">
        <span className="text-2xl font-black text-acento">{p.dias}</span>
        <span className="text-[10px] text-texto-suave">{p.dias === 1 ? "día" : "días"}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-texto-suave">{p.dias === 1 ? "Mañana es" : "Falta poco para"}</p>
        <p className="truncate text-lg font-bold">{p.nombre}</p>
        <p className="text-xs text-texto-suave">
          {nombreFecha(p.dia, p.mes)}
          {cumple && ` · cumplen ${cumple}`}
        </p>
      </div>
    </Link>
  );
}
