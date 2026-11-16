"use client";

import { UtensilsCrossed } from "lucide-react";
import { useComidasAnteriores } from "@/lib/hooks/useComidasAnteriores";

/** Campo "Comida" con botones de lo que ya se comió otras veces */
export function CampoComida({
  valor,
  cambiar,
  claseInput,
}: {
  valor: string;
  cambiar: (v: string) => void;
  claseInput: string;
}) {
  const anteriores = useComidasAnteriores();
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-sm text-texto-suave">
          <UtensilsCrossed className="size-4" /> Comida (opcional)
        </span>
        <input
          maxLength={60}
          placeholder="Asado, pizza, sushi…"
          value={valor}
          onChange={(e) => cambiar(e.target.value)}
          className={claseInput}
        />
      </label>
      {anteriores.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {anteriores.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => cambiar(c)}
              className={`rounded-full px-3 py-1 text-sm ${
                valor.trim().toLowerCase() === c.toLowerCase()
                  ? "bg-acento font-semibold text-black"
                  : "bg-fondo text-texto-suave ring-1 ring-borde"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
