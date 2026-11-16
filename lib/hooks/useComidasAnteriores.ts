"use client";

import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

/** Lo que ya se comió en juntadas anteriores, de lo más repetido a lo menos (máx. 8) */
export function useComidasAnteriores() {
  const [anteriores, setAnteriores] = useState<string[]>([]);
  useEffect(() => {
    crearClienteNavegador()
      .from("juntadas")
      .select("comida")
      .not("comida", "is", null)
      .then(({ data }) => {
        const cuenta = new Map<string, { texto: string; n: number }>();
        for (const { comida: c } of data ?? []) {
          const clave = c.trim().toLowerCase();
          const prev = cuenta.get(clave);
          cuenta.set(clave, { texto: prev?.texto ?? c.trim(), n: (prev?.n ?? 0) + 1 });
        }
        setAnteriores([...cuenta.values()].sort((a, b) => b.n - a.n).slice(0, 8).map((x) => x.texto));
      });
  }, []);
  return anteriores;
}
