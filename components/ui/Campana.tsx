"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useNoLeidos } from "@/lib/avisosStore";

/** Campanita de avisos arriba a la derecha, con los no leídos */
export function Campana() {
  const noLeidos = useNoLeidos();
  const ruta = usePathname();
  const activa = ruta.startsWith("/avisos");
  return (
    <Link
      href="/avisos"
      aria-label={noLeidos ? `Avisos (${noLeidos} sin leer)` : "Avisos"}
      className={`fixed right-[max(1rem,calc((100vw-28rem)/2+1rem))] top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 grid size-10 place-items-center rounded-full bg-superficie/90 ring-1 ring-borde backdrop-blur ${
        activa ? "text-acento" : "text-texto"
      }`}
    >
      <Bell className="size-5" />
      {noLeidos > 0 && (
        <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-5 text-white">
          {noLeidos > 9 ? "9+" : noLeidos}
        </span>
      )}
    </Link>
  );
}
