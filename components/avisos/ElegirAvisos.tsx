"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";

// Grupos de avisos que cada uno puede apagar en el celular (siguen apareciendo en esta lista)
const GRUPOS = [
  { clave: "nuevas", titulo: "Juntadas nuevas, votaciones y eventos", tipos: ["creada", "sondeo", "evento"] },
  { clave: "voto", titulo: "Cada vez que alguien vota Voy / No voy", tipos: ["voto"] },
  { clave: "recordatorios", titulo: "Recordatorios (falta tu voto, 1 hora antes)", tipos: ["recordatorio", "llegada"] },
  { clave: "cambio", titulo: "Cambios de hora o lugar", tipos: ["cambio"] },
  { clave: "arranque", titulo: "Arranque y fin de la juntada", tipos: ["iniciada", "finalizada"] },
  { clave: "wrapped", titulo: "Wrapped del año", tipos: ["wrapped"] },
];

/** Interruptores para elegir qué avisos suenan en el celular */
export function ElegirAvisos({ uid }: { uid: string }) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [off, setOff] = useState<string[] | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("perfiles")
      .select("avisos_off")
      .eq("id", uid)
      .single()
      .then(({ data }) => setOff((data?.avisos_off as string[]) ?? []));
  }, [supabase, uid]);

  async function alternar(g: (typeof GRUPOS)[number]) {
    if (!off) return;
    const apagado = g.tipos.every((t) => off.includes(t));
    const nuevo = apagado ? off.filter((t) => !g.tipos.includes(t)) : [...new Set([...off, ...g.tipos])];
    setOcupado(g.clave);
    const { error } = await supabase.from("perfiles").update({ avisos_off: nuevo }).eq("id", uid);
    setOcupado(null);
    if (!error) setOff(nuevo);
  }

  const apagados = off ? GRUPOS.filter((g) => g.tipos.every((t) => off.includes(t))).length : 0;

  return (
    <div className="rounded-2xl border border-borde bg-superficie">
      <button onClick={() => setAbierto(!abierto)} className="flex w-full items-center justify-between p-4 text-left">
        <span>
          <span className="font-semibold">Qué avisos me suenan</span>
          <span className="block text-xs text-texto-suave">
            {apagados ? `${apagados} silenciados · igual quedan en esta lista` : "Todos activados"}
          </span>
        </span>
        <ChevronDown className={`size-5 text-texto-suave transition ${abierto ? "rotate-180" : ""}`} />
      </button>
      {abierto && (
        <div className="flex flex-col gap-1 border-t border-borde p-2">
          {!off ? (
            <Loader2 className="m-3 size-5 animate-spin text-texto-suave" />
          ) : (
            GRUPOS.map((g) => {
              const prendido = !g.tipos.every((t) => off.includes(t));
              return (
                <button
                  key={g.clave}
                  disabled={ocupado !== null}
                  onClick={() => alternar(g)}
                  className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-left text-sm"
                >
                  <span className={prendido ? "" : "text-texto-suave"}>{g.titulo}</span>
                  <span className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${prendido ? "bg-acento" : "bg-borde"}`}>
                    {ocupado === g.clave ? (
                      <Loader2 className="size-5 animate-spin text-white" />
                    ) : (
                      <span className={`block size-5 rounded-full bg-white transition ${prendido ? "translate-x-5" : ""}`} />
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
