"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Swords } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/errores";

/** Duelo 1 vs 1 en cualquier juego: queda en el historial de duelos (cara a cara). No suma puntos de juegos. */
export function CargarDuelo({
  juego,
  juntadaId,
  perfiles,
}: {
  juego: string;
  juntadaId: string | null;
  perfiles: { id: string; apodo: string }[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [ganador, setGanador] = useState<string | null>(null);
  const [resultado, setResultado] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apodo = (id: string) => perfiles.find((p) => p.id === id)?.apodo ?? "?";

  async function guardar() {
    if (!a || !b || !ganador) return;
    setOcupado(true);
    setError(null);
    const { data, error } = await supabase
      .from("partidas")
      .insert({ juntada_id: juntadaId, juego, resultado: resultado.trim() || null })
      .select("id")
      .single();
    if (error || !data) {
      setOcupado(false);
      return setError(mensajeError(error ?? { message: "" }));
    }
    const { error: e2 } = await supabase.from("partida_jugadores").insert([
      { partida_id: data.id, perfil_id: a, equipo: 1, gano: ganador === a },
      { partida_id: data.id, perfil_id: b, equipo: 2, gano: ganador === b },
    ]);
    setOcupado(false);
    if (e2) {
      await supabase.from("partidas").delete().eq("id", data.id);
      return setError(mensajeError(e2));
    }
    router.push("/juegos#duelos");
    router.refresh();
  }

  const select = (valor: string, cambiar: (v: string) => void, otro: string) => (
    <select
      value={valor}
      onChange={(e) => {
        cambiar(e.target.value);
        setGanador(null);
      }}
      className="min-w-0 flex-1 rounded-xl border border-borde bg-superficie px-3 py-2.5 outline-none focus:border-acento"
    >
      <option value="">Elegí…</option>
      {perfiles
        .filter((p) => p.id !== otro)
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.apodo}
          </option>
        ))}
    </select>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {select(a, setA, b)}
        <Swords className="size-5 shrink-0 text-texto-suave" />
        {select(b, setB, a)}
      </div>
      {a && b && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-texto-suave">¿Quién ganó?</p>
          <div className="grid grid-cols-2 gap-2">
            {[a, b].map((id) => (
              <button
                key={id}
                onClick={() => setGanador(id)}
                className={`rounded-xl py-3 font-bold ${
                  ganador === id ? "bg-acento text-black" : "bg-superficie text-texto-suave ring-1 ring-borde"
                }`}
              >
                🏆 {apodo(id)}
              </button>
            ))}
          </div>
        </div>
      )}
      <input
        maxLength={40}
        placeholder="Resultado (opcional, ej: 3 a 1)"
        value={resultado}
        onChange={(e) => setResultado(e.target.value)}
        className="rounded-xl border border-borde bg-superficie px-3 py-2.5 text-sm outline-none focus:border-acento"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        disabled={!a || !b || !ganador || ocupado}
        onClick={guardar}
        className="flex items-center justify-center gap-2 rounded-xl bg-acento py-3 font-bold text-black disabled:opacity-50"
      >
        {ocupado && <Loader2 className="size-4 animate-spin" />} Guardar duelo
      </button>
      <p className="text-center text-xs text-texto-suave">Los duelos quedan en el historial cara a cara. No suman puntos de juegos.</p>
    </div>
  );
}
