"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, QrCode } from "lucide-react";

const ITEMS = [
  { href: "/", etiqueta: "Inicio", Icono: Home },
  { href: "/perfil", etiqueta: "Mi QR", Icono: QrCode },
  { href: "/stats", etiqueta: "Stats", Icono: BarChart3 },
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

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-fondo/90 backdrop-blur pb-seguro">
      <ul className="mx-auto grid max-w-md grid-cols-3">
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
                <Icono className="size-6" />
                {etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
