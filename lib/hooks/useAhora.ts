"use client";

import { useEffect, useState } from "react";

/**
 * Date.now() actualizado cada `cadaMs` (para contadores en vivo).
 * Devuelve null en el primer render para que servidor y celular muestren lo mismo
 * y no haya desfase al cargar.
 */
export function useAhora(cadaMs = 1000) {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setAhora(Date.now());
    const primero = setTimeout(tick, 0);
    const id = setInterval(tick, cadaMs);
    return () => {
      clearTimeout(primero);
      clearInterval(id);
    };
  }, [cadaMs]);
  return ahora;
}
