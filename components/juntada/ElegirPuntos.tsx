"use client";

import { NIVELES } from "@/lib/juegos";

/** Qué tan importante es la juntada: normal 1 punto, media 5, importante 10 (ej: cumpleaños) */
export function ElegirPuntos({
  valor,
  cambiar,
}: {
  valor: number;
  cambiar: (p: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-texto-suave">
        ¿Qué tan importante es? (el que va suma estos puntos)
      </span>
      <div className="grid grid-cols-3 gap-2">
        {NIVELES.map((n) => (
          <button
            key={n.puntos}
            type="button"
            onClick={() => cambiar(n.puntos)}
            className={`flex flex-col items-center rounded-xl px-2 py-2.5 text-center ${
              valor === n.puntos
                ? "bg-acento text-black"
                : "bg-superficie text-texto-suave ring-1 ring-borde"
            }`}
          >
            <span className="font-bold">{n.nombre}</span>
            <span className="text-[11px] leading-tight">{n.detalle}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
