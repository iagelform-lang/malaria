"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

// Cambiar la clave cuando haya novedades nuevas, así el cartel vuelve a aparecer una vez
const CLAVE = "malaria-novedades-2026-11";

const NOVEDADES = [
  { emoji: "💸", texto: "Gastos como en Splid: dividí solo entre algunos y mirá quién le debe a quién", href: "/gastos" },
  { emoji: "✈️", texto: "Cuentas sueltas para viajes o compras en común", href: "/gastos" },
  { emoji: "👠", texto: "Jugá Bid Womens desde la app y sumá puntos de torneo", href: "/juegos" },
  { emoji: "📸", texto: "En la juntada: subí fotos y votá la frase de la noche", href: null },
];

/** Aparece una sola vez por persona (en este celular) y se cierra con la X */
export function CartelNovedades() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- solo se sabe en el navegador
      setVisible(localStorage.getItem(CLAVE) !== "visto");
    } catch {
      // sin almacenamiento: no lo mostramos para no molestar cada vez
    }
  }, []);

  function cerrar() {
    setVisible(false);
    try {
      localStorage.setItem(CLAVE, "visto");
    } catch {}
  }

  if (!visible) return null;
  return (
    <div className="relative flex flex-col gap-3 rounded-2xl border border-violet-400/50 bg-violet-500/10 p-4">
      <button onClick={cerrar} aria-label="Cerrar" className="absolute right-2 top-2 rounded-full p-1.5 text-texto-suave">
        <X className="size-4" />
      </button>
      <p className="pr-8 font-bold text-violet-700">✨ Novedades para la próxima juntada</p>
      <ul className="flex flex-col gap-2 text-sm">
        {NOVEDADES.map((n) => (
          <li key={n.texto} className="flex gap-2">
            <span>{n.emoji}</span>
            {n.href ? (
              <Link href={n.href} onClick={cerrar} className="underline decoration-violet-400/50 underline-offset-2">
                {n.texto}
              </Link>
            ) : (
              <span>{n.texto}</span>
            )}
          </li>
        ))}
      </ul>
      <button onClick={cerrar} className="self-start text-xs text-texto-suave">
        Entendido
      </button>
    </div>
  );
}
