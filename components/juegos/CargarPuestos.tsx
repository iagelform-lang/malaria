"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2 } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/errores";
import { MAX_JUGADORES, puntosDePuesto } from "@/lib/torneo";

// del 5º en adelante todos comparten el puesto 5 (5º a 8º = 10 puntos)
const puesto = (i: number) => Math.min(i + 1, 5);
const etiquetaPuesto = (i: number) => (i < 4 ? `${i + 1}º` : "5º-8º");

/**
 * Tabla de puestos de un juego que se juega fuera del celular (truco, poker, FIFA…):
 * se eligen los jugadores y se tocan en el orden en que terminaron.
 * 1º 100 · 2º 55 · 3º 40 · 4º 25 · del 5º al 8º 10.
 */
export function CargarPuestos({
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
  const apodo = (id: string) => perfiles.find((p) => p.id === id)?.apodo ?? "?";
  const [jugadores, setJugadores] = useState<string[]>([]);
  const [paso, setPaso] = useState<"jugadores" | "puestos" | "listo">("jugadores");
  const [orden, setOrden] = useState<string[]>([]); // orden de llegada: 1º, 2º, 3º…
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const faltan = jugadores.filter((j) => !orden.includes(j));

  async function guardar() {
    setOcupado(true);
    setError(null);
    const { data, error } = await supabase
      .from("torneos")
      .insert({ juego, juntada_id: juntadaId })
      .select("id")
      .single();
    if (error || !data) {
      setOcupado(false);
      return setError(mensajeError(error ?? { message: "" }));
    }
    const { error: e2 } = await supabase.from("torneo_posiciones").insert(
      orden.map((id, i) => ({ torneo_id: data.id, perfil_id: id, puesto: puesto(i), puntos: puntosDePuesto(puesto(i)) })),
    );
    setOcupado(false);
    if (e2) {
      await supabase.from("torneos").delete().eq("id", data.id);
      return setError(mensajeError(e2));
    }
    setPaso("listo");
  }

  const chip = (activo: boolean) =>
    `rounded-full px-3 py-1.5 text-sm ${activo ? "bg-acento font-semibold text-black" : "bg-superficie text-texto-suave ring-1 ring-borde"}`;

  if (paso === "listo") {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-acento/10 p-4 text-center ring-1 ring-acento/40">
          <p className="text-sm uppercase tracking-widest text-texto-suave">Campeón</p>
          <p className="text-3xl font-black">{apodo(orden[0])}</p>
        </div>
        <TablaFinal orden={orden} apodo={apodo} />
        <button onClick={() => router.push("/juegos")} className="rounded-xl bg-acento py-3 font-bold text-black">
          Listo
        </button>
      </div>
    );
  }

  if (paso === "jugadores") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-texto-suave">¿Quiénes jugaron?</p>
        <div className="flex flex-wrap gap-2">
          {perfiles.map((p) => {
            const ya = jugadores.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => setJugadores(ya ? jugadores.filter((x) => x !== p.id) : [...jugadores, p.id])}
                className={chip(ya)}
              >
                {p.apodo}
              </button>
            );
          })}
        </div>
        <button
          disabled={jugadores.length < 2 || jugadores.length > MAX_JUGADORES}
          onClick={() => {
            setOrden([]);
            setPaso("puestos");
          }}
          className="rounded-xl bg-acento py-3 font-bold text-black disabled:opacity-50"
        >
          {jugadores.length > MAX_JUGADORES ? `Máximo ${MAX_JUGADORES} jugadores` : `Cargar puestos (${jugadores.length})`}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-texto-suave">
        {faltan.length
          ? `Tocá en orden: ¿quién salió ${etiquetaPuesto(orden.length)}?`
          : "Revisá la tabla y guardala."}
      </p>
      {faltan.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {faltan.map((id) => (
            <button
              key={id}
              onClick={() => {
                const nuevo = [...orden, id];
                // si quedan solo los que comparten 5º-8º, se completan solos
                const resto = jugadores.filter((j) => !nuevo.includes(j));
                setOrden(nuevo.length >= 4 ? [...nuevo, ...resto] : nuevo.length === jugadores.length - 1 ? [...nuevo, ...resto] : nuevo);
              }}
              className={chip(false)}
            >
              {apodo(id)}
            </button>
          ))}
        </div>
      )}
      {orden.length > 0 && <TablaFinal orden={orden} apodo={apodo} />}
      <div className="flex gap-2">
        <button
          onClick={() => (orden.length ? setOrden(orden.length > 4 ? orden.slice(0, 3) : orden.slice(0, -1)) : setPaso("jugadores"))}
          className="flex items-center gap-1 rounded-xl border border-borde px-4 py-3 text-sm"
        >
          <Undo2 className="size-4" /> {orden.length ? "Deshacer" : "Volver"}
        </button>
        <button
          disabled={faltan.length > 0 || ocupado}
          onClick={guardar}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-acento py-3 font-bold text-black disabled:opacity-50"
        >
          {ocupado && <Loader2 className="size-4 animate-spin" />} Guardar y sumar puntos
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );

}

function TablaFinal({ orden, apodo }: { orden: string[]; apodo: (id: string) => string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-superficie p-3 text-sm">
      {orden.map((id, i) => (
        <div key={id} className="flex justify-between">
          <span>
            {etiquetaPuesto(i)} · {apodo(id)}
          </span>
          <b className="text-acento">+{puntosDePuesto(puesto(i))} pts</b>
        </div>
      ))}
    </div>
  );
}
