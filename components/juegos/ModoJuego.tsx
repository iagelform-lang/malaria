"use client";

import { useState } from "react";
import { CargarPuestos } from "@/components/juegos/CargarPuestos";
import { CargarDuelo } from "@/components/juegos/CargarDuelo";

/** Elegir cómo se cargó el juego: torneo (puestos y puntos) o duelo 1 vs 1 (historial cara a cara) */
export function ModoJuego(props: {
  juego: string;
  juntadaId: string | null;
  perfiles: { id: string; apodo: string }[];
}) {
  const [modo, setModo] = useState<"torneo" | "duelo">("torneo");
  const chip = (activo: boolean) =>
    `flex-1 rounded-xl py-2.5 text-sm font-semibold ${activo ? "bg-acento text-black" : "bg-superficie text-texto-suave ring-1 ring-borde"}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <button onClick={() => setModo("torneo")} className={chip(modo === "torneo")}>
          🏆 Torneo (puestos)
        </button>
        <button onClick={() => setModo("duelo")} className={chip(modo === "duelo")}>
          ⚔️ Duelo 1 vs 1
        </button>
      </div>
      {modo === "torneo" ? <CargarPuestos {...props} /> : <CargarDuelo {...props} />}
    </div>
  );
}
