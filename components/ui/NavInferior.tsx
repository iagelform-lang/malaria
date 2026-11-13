"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, Home, QrCode, Users } from "lucide-react";
import { useNoLeidos } from "@/lib/avisosStore";

const ITEMS = [
  { href: "/", etiqueta: "Inicio", Icono: Home },
  { href: "/grupo", etiqueta: "Grupo", Icono: Users },
  { href: "/perfil", etiqueta: "Mi QR", Icono: QrCode },
  { href: "/stats", etiqueta: "Stats", Icono: BarChart3 },
  { href: "/avisos", etiqueta: "Avisos", Icono: Bell },
];

export function NavInferior({ rutaFija }: { rutaFija?: string }) {
  return <Barra ruta={rutaFija ?? null} />;
}

function Barra({ ruta: fija }: { ruta: string | null }) {
  return fija !== null ? <Nav ruta={fija} /> : <NavDinamica />;
}

function NavDinamica() {
  return <Nav ruta={usePathname()} />;
}

function Nav({ ruta }: { ruta: string }) {
  const noLeidos = useNoLeidos();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-fondo/90 backdrop-blur pb-seguro">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {ITEMS.map(({ href, etiqueta, Icono }) => {
          const activo = href === "/" ? ruta === "/" : ruta.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 pt-3 text-xs ${
                  activo ? "text-acento" : "text-texto-suave"
                }`}
              >
                <span className="relative">
                  <Icono className="size-6" />
                  {href === "/avisos" && noLeidos > 0 && (
                    <span className="absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
                      {noLeidos > 9 ? "9+" : noLeidos}
                    </span>
                  )}
                </span>
                {etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
