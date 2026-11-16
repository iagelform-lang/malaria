"use client";

import { Share2 } from "lucide-react";

/** Manda el resumen de la juntada al grupo de WhatsApp */
export function CompartirResumen({ texto }: { texto: string }) {
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 font-bold text-black active:scale-[0.99]"
    >
      <Share2 className="size-5" /> Mandar el resumen al grupo
    </a>
  );
}
