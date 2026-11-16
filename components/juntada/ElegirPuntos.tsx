"use client";

import { NIVELES } from "@/lib/juegos";

/** Qué tipo de juntada es: normal 10 puntos, salida 30, asado 50, viaje / cumpleaños 70 */
export function ElegirPuntos({
  valor,
  cambiar,
  etiqueta = "¿Qué tipo de juntada es? (el que va suma estos puntos)",
}: {
  valor: number;
  cambiar: (p: number) => void;
  etiqueta?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-texto-suave">{etiqueta}</span>
      <div className="grid grid-cols-2 gap-2">
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
