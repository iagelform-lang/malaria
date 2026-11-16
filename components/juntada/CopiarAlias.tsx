"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Muestra el alias de alguien con un botón para copiarlo */
export function CopiarAlias({ alias }: { alias: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(alias);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          /* sin permiso de portapapeles: el alias igual queda a la vista */
        }
      }}
      className="flex w-fit items-center gap-1 rounded-lg bg-fondo px-2 py-0.5 text-xs text-texto-suave ring-1 ring-borde"
    >
      {copiado ? <Check className="size-3 text-acento" /> : <Copy className="size-3" />}
      {copiado ? "Copiado" : `Alias: ${alias}`}
    </button>
  );
}
