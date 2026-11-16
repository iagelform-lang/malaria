"use client";

import { useEffect, useMemo, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { fechaYHora } from "@/lib/tiempo";
import type { Perfil } from "@/lib/tipos";

type Cambio = {
  id: number;
  perfil_id: string | null;
  de: number;
  a: number;
  creado_en: string;
};

/** Quién cambió los puntos de la juntada, cuándo y de cuánto a cuánto */
export function HistorialPuntos({
  juntadaId,
  perfiles,
}: {
  juntadaId: string;
  perfiles: Pick<Perfil, "id" | "apodo">[];
}) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [cambios, setCambios] = useState<Cambio[]>([]);

  useEffect(() => {
    let vivo = true;
    supabase
      .from("cambios_puntos")
      .select("id, perfil_id, de, a, creado_en")
      .eq("juntada_id", juntadaId)
      .order("creado_en")
      .then(({ data }) => {
        if (vivo && data) setCambios(data as Cambio[]);
      });
    return () => {
      vivo = false;
    };
  }, [supabase, juntadaId]);

  if (cambios.length === 0) return null;
  const apodo = (id: string | null) =>
    (id && perfiles.find((p) => p.id === id)?.apodo) || "un admin";

  return (
    <ul className="flex flex-col gap-0.5 text-xs text-texto-suave">
      {cambios.map((c) => (
        <li key={c.id}>
          ⭐ {c.de} → {c.a} pts · lo cambió {apodo(c.perfil_id)} el{" "}
          {fechaYHora(c.creado_en)}
        </li>
      ))}
    </ul>
  );
}
