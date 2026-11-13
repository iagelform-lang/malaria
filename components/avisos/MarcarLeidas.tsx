"use client";

import { useEffect, useMemo } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { setNoLeidos } from "@/lib/avisosStore";

// Al entrar a Avisos, todo queda leído (se siguen viendo resaltados hasta salir de la pantalla)
export function MarcarLeidas({ hayNoLeidas }: { hayNoLeidas: boolean }) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  useEffect(() => {
    if (!hayNoLeidas) return;
    const t = setTimeout(async () => {
      await supabase.from("notificaciones").update({ leida: true }).eq("leida", false);
      setNoLeidos(0);
    }, 1500);
    return () => clearTimeout(t);
  }, [supabase, hayNoLeidas]);
  return null;
}
