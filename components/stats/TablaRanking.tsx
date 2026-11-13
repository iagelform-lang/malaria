"use client";

import { useState } from "react";
import { duracion } from "@/lib/tiempo";
import type { Estadistica } from "@/lib/tipos";
import { Avatar } from "@/components/ui/Avatar";

type Orden = "horas" | "asistencia" | "puntualidad" | "promedio";

const ORDENES: { clave: Orden; etiqueta: string }[] = [
  { clave: "horas", etiqueta: "Horas" },
  { clave: "asistencia", etiqueta: "Asistencia" },
  { clave: "puntualidad", etiqueta: "Puntualidad" },
  { clave: "promedio", etiqueta: "Promedio" },
];

const valorDe: Record<Orden, (s: Estadistica) => number> = {
  horas: (s) => s.horas_totales,
  asistencia: (s) => s.pct_asistencia ?? 0,
  puntualidad: (s) => s.pct_puntualidad ?? 0,
  promedio: (s) => s.promedio_min_por_juntada ?? 0,
};

export function TablaRanking({ stats, uid }: { stats: Estadistica[]; uid: string }) {
  const [orden, setOrden] = useState<Orden>("horas");
  const lista = [...stats].sort((a, b) => valorDe[orden](b) - valorDe[orden](a));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">Ranking</h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ORDENES.map((o) => (
          <button
            key={o.clave}
            onClick={() => setOrden(o.clave)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
              orden === o.clave ? "bg-acento font-semibold text-black" : "bg-superficie text-texto-suave"
            }`}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>

      {lista.map((s, i) => (
        <div
          key={s.perfil_id}
          className={`flex flex-col gap-3 rounded-2xl bg-superficie p-4 ${s.perfil_id === uid ? "ring-1 ring-acento/50" : ""}`}
        >
          <div className="flex items-center gap-3">
            <span className="w-5 text-center font-mono text-texto-suave">{i + 1}</span>
            <Avatar apodo={s.apodo} />
            <p className="flex-1 font-semibold">
              {s.apodo} {s.perfil_id === uid && <span className="text-xs text-acento">(vos)</span>}
            </p>
            <p className="font-mono text-lg font-bold text-acento">
              {orden === "horas" && `${s.horas_totales.toLocaleString("es-AR")} h`}
              {orden === "asistencia" && `${s.pct_asistencia ?? 0}%`}
              {orden === "puntualidad" && `${s.pct_puntualidad ?? 0}%`}
              {orden === "promedio" && duracion(s.promedio_min_por_juntada ?? 0)}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <Mini etiqueta="fue" valor={`${s.juntadas_asistidas}/${s.juntadas_posibles}`} />
            <Mini etiqueta="promedio" valor={duracion(s.promedio_min_por_juntada ?? 0)} />
            <Mini etiqueta="a tiempo" valor={`${s.pct_puntualidad ?? 0}%`} />
            <Mini etiqueta="1° / últ." valor={`${s.veces_primero} / ${s.veces_ultimo}`} />
          </div>
        </div>
      ))}
    </section>
  );
}

function Mini({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg bg-fondo px-1 py-2">
      <p className="text-sm font-semibold">{valor}</p>
      <p className="text-[10px] uppercase tracking-wide text-texto-suave">{etiqueta}</p>
    </div>
  );
}
