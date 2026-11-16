"use client";

import { useCallback, useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import type { Juego } from "@/lib/juegos";

/** Catálogo de juegos del grupo (predeterminados primero) */
export function useJuegos() {
  const [juegos, setJuegos] = useState<Juego[]>([]);
  const recargar = useCallback(async () => {
    const { data } = await crearClienteNavegador()
      .from("juegos")
      .select("id, nombre, emoji, modo, predeterminado, creado_por")
      .order("predeterminado", { ascending: false })
      .order("creado_en");
    if (data) setJuegos(data as Juego[]);
  }, []);
  useEffect(() => {
    const t = setTimeout(recargar, 0);
    return () => clearTimeout(t);
  }, [recargar]);
  return { juegos, recargar };
}
