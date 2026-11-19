"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Solapas arriba para ver una sección por vez. `inicial` abre una directo (y la trae a la vista). */
export function Solapas({
  solapas,
  inicial,
}: {
  solapas: { clave: string; titulo: string; contenido: ReactNode }[];
  inicial?: string;
}) {
  const existe = inicial && solapas.some((s) => s.clave === inicial);
  const [activa, setActiva] = useState(existe ? inicial : solapas[0]?.clave);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (existe) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [existe]);
  return (
    <div ref={ref} className="flex scroll-mt-2 flex-col gap-5">
      <div className="sticky top-0 z-10 -mx-4 overflow-x-auto bg-fondo/95 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-4 py-2 backdrop-blur">
        <div className="flex w-max gap-1.5">
          {solapas.map((s) => (
            <button
              key={s.clave}
              onClick={() => setActiva(s.clave)}
              className={`rounded-full px-3.5 py-1.5 text-sm ${
                activa === s.clave ? "bg-acento font-semibold text-white" : "bg-superficie text-texto-suave ring-1 ring-borde"
              }`}
            >
              {s.titulo}
            </button>
          ))}
        </div>
      </div>
      {solapas.map((s) => (
        <div key={s.clave} hidden={activa !== s.clave} className="flex flex-col gap-8">
          {s.contenido}
        </div>
      ))}
    </div>
  );
}
