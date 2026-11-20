"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

/** La foto entera dentro de la tarjeta; al tocarla se abre en pantalla completa */
export function FotoAmpliable({ src, alt }: { src: string; alt: string }) {
  const [abierta, setAbierta] = useState(false);

  // con la foto abierta, la página de atrás no se mueve
  useEffect(() => {
    if (!abierta) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierta]);

  return (
    <>
      <button
        onClick={() => setAbierta(true)}
        aria-label="Ver la foto en grande"
        className="relative block aspect-[4/5] max-h-[65vh] w-full overflow-hidden bg-black"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- fondo decorativo */}
        <img src={src} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl" />
        {/* eslint-disable-next-line @next/next/no-img-element -- foto estática ya optimizada */}
        <img src={src} alt={alt} className="relative size-full object-contain" />
      </button>

      {abierta && (
        <div
          role="dialog"
          aria-label={alt}
          onClick={() => setAbierta(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2"
        >
          <button
            onClick={() => setAbierta(false)}
            aria-label="Cerrar"
            className="absolute right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] flex items-center gap-1 rounded-full bg-white/15 px-3 py-2 text-sm font-semibold text-white"
          >
            <X className="size-4" /> Cerrar
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- foto estática ya optimizada */}
          <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </>
  );
}
