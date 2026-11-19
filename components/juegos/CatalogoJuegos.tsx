"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Plus, Trash2, X } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/errores";
import { EMOJIS_JUEGO, type Juego, type Modo } from "@/lib/juegos";

/** Los juegos del grupo: vienen los predeterminados y cualquiera agrega los suyos */
export function CatalogoJuegos({
  juegos,
  uid,
  esAdmin,
}: {
  juegos: (Juego & { partidas: number })[];
  uid: string;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS_JUEGO[0]);
  const [modo, setModo] = useState<Modo>("individual");
  const [ocupado, setOcupado] = useState<number | "nuevo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function agregar() {
    if (!nombre.trim()) return;
    setOcupado("nuevo");
    setError(null);
    const { error } = await supabase
      .from("juegos")
      .insert({ nombre: nombre.trim(), emoji, modo });
    setOcupado(null);
    if (error)
      return setError(
        error.code === "23505"
          ? "Ese juego ya está en la lista."
          : mensajeError(error),
      );
    setNombre("");
    setAbierto(false);
    router.refresh();
  }

  async function borrar(id: number) {
    setOcupado(id);
    setError(null);
    const { error } = await supabase.from("juegos").delete().eq("id", id);
    setOcupado(null);
    if (error) return setError(mensajeError(error));
    router.refresh();
  }

  const chip = (activo: boolean) =>
    `rounded-full px-3 py-1.5 text-sm ${activo ? "bg-acento font-semibold text-white" : "bg-fondo text-texto-suave ring-1 ring-borde"}`;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          Qué jugamos
        </h2>
        {!abierto && (
          <button
            onClick={() => setAbierto(true)}
            className="flex items-center gap-1 rounded-full bg-acento px-3 py-1.5 text-sm font-semibold text-white"
          >
            <Plus className="size-4" /> Agregar juego
          </button>
        )}
      </div>

      {abierto && (
        <div className="flex flex-col gap-3 rounded-2xl border border-acento/40 bg-superficie p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Nuevo juego</p>
            <button
              onClick={() => setAbierto(false)}
              className="p-1 text-texto-suave"
              aria-label="Cancelar"
            >
              <X className="size-5" />
            </button>
          </div>
          <input
            autoFocus
            maxLength={30}
            placeholder="Ej: Pool, Ping pong, Karaoke…"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="rounded-xl border border-borde bg-fondo px-3 py-2.5 outline-none focus:border-acento"
          />
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS_JUEGO.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`grid size-10 place-items-center rounded-xl text-xl ${
                  emoji === e ? "bg-acento/20 ring-2 ring-acento" : "bg-fondo"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setModo("individual")}
              className={chip(modo === "individual")}
            >
              Cada uno por su lado
            </button>
            <button
              onClick={() => setModo("equipos")}
              className={chip(modo === "equipos")}
            >
              Por equipos
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={!nombre.trim() || ocupado !== null}
            onClick={agregar}
            className="flex items-center justify-center gap-2 rounded-xl bg-acento py-3 font-semibold text-white disabled:opacity-50"
          >
            {ocupado === "nuevo" && <Loader2 className="size-4 animate-spin" />}{" "}
            Agregar
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {juegos.map((j) => {
          const puedeBorrar = esAdmin || (!j.predeterminado && j.creado_por === uid);
          const esBid = j.nombre.toLowerCase() === "bid womens";
          return (
            <div
              key={j.id}
              className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-acento/25 to-amber-300/20 p-4 ring-1 ring-acento/40"
            >
              <Link
                href={esBid ? "/juegos/bid" : `/juegos/torneo/${j.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 active:scale-[0.99]"
              >
                <span className="text-3xl">{j.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">Jugar {j.nombre}</p>
                  <p className="text-sm text-texto-suave">
                    {esBid ? "Subasta, duelos al mejor de 5 y torneo" : "Torneo con puestos o duelo 1 vs 1"}
                    {j.partidas > 0 && ` · ${j.partidas} ${j.partidas === 1 ? "torneo" : "torneos"}`}
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-acento" />
              </Link>
              {puedeBorrar && j.partidas === 0 && (
                <button
                  disabled={ocupado !== null}
                  onClick={() => borrar(j.id)}
                  className="p-1 text-texto-suave"
                  aria-label={`Borrar ${j.nombre}`}
                >
                  {ocupado === j.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {!abierto && error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
