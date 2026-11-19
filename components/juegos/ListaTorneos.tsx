"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/errores";
import { puntosDePuesto } from "@/lib/torneo";

export type TorneoLista = {
  id: number;
  juego: string;
  creado_en: string;
  cargado_por: string;
  torneo_posiciones: { perfil_id: string; puesto: number }[];
};

/** Torneos jugados. El que lo armó (o un admin) lo puede borrar: se van también sus duelos y sus puntos. */
export function ListaTorneos({
  torneos,
  apodos,
  uid,
  esAdmin,
}: {
  torneos: TorneoLista[];
  apodos: Record<string, string>;
  uid: string;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function borrar(id: number) {
    setOcupado(true);
    setError(null);
    const { error } = await supabase.from("torneos").delete().eq("id", id);
    setOcupado(false);
    setConfirmando(null);
    if (error) return setError(mensajeError(error));
    router.refresh();
  }

  if (!torneos.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">Torneos</h2>
      {torneos.map((t) => {
        const pos = [...t.torneo_posiciones].sort((a, b) => a.puesto - b.puesto);
        const puede = esAdmin || t.cargado_por === uid;
        const fecha = new Date(t.creado_en).toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          timeZone: "America/Argentina/Buenos_Aires",
        });
        return (
          <div key={t.id} className="flex flex-col gap-2 rounded-xl bg-superficie px-3 py-2.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {t.juego} <span className="text-xs font-normal text-texto-suave">· {fecha}</span>
                </p>
                {pos.length ? (
                  <p className="text-sm">
                    {pos
                      .slice(0, 3)
                      .map((p) => `${["👑", "🥈", "🥉"][p.puesto - 1]} ${apodos[p.perfil_id] ?? "?"}`)
                      .join("  ")}
                  </p>
                ) : (
                  <p className="text-xs text-amber-700">Sin terminar · no suma puntos</p>
                )}
                {pos.length > 0 && (
                  <p className="text-[11px] text-texto-suave">
                    Repartió {pos.reduce((s, p) => s + puntosDePuesto(p.puesto), 0)} puntos entre {pos.length}
                  </p>
                )}
              </div>
              {puede && confirmando !== t.id && (
                <button onClick={() => setConfirmando(t.id)} className="p-1 text-texto-suave" aria-label="Borrar torneo">
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
            {confirmando === t.id && (
              <div className="flex items-center gap-2 text-sm">
                <p className="flex-1 text-xs">¿Borrar el torneo con sus duelos y puntos?</p>
                <button onClick={() => setConfirmando(null)} className="rounded-lg border border-borde px-2 py-1 text-xs">
                  No
                </button>
                <button
                  disabled={ocupado}
                  onClick={() => borrar(t.id)}
                  className="flex items-center gap-1 rounded-lg bg-red-500 px-2 py-1 text-xs font-semibold text-white"
                >
                  {ocupado && <Loader2 className="size-3 animate-spin" />} Borrar
                </button>
              </div>
            )}
          </div>
        );
      })}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
