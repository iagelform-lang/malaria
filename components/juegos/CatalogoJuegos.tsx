"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, X } from "lucide-react";
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
    `rounded-full px-3 py-1.5 text-sm ${activo ? "bg-acento font-semibold text-black" : "bg-fondo text-texto-suave ring-1 ring-borde"}`;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">
          Qué jugamos
        </h2>
        {!abierto && (
          <button
            onClick={() => setAbierto(true)}
            className="flex items-center gap-1 rounded-full bg-acento px-3 py-1.5 text-sm font-semibold text-black"
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
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            disabled={!nombre.trim() || ocupado !== null}
            onClick={agregar}
            className="flex items-center justify-center gap-2 rounded-xl bg-acento py-3 font-semibold text-black disabled:opacity-50"
          >
            {ocupado === "nuevo" && <Loader2 className="size-4 animate-spin" />}{" "}
            Agregar
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {juegos.map((j) => {
          const puedeBorrar =
            esAdmin || (!j.predeterminado && j.creado_por === uid);
          return (
            <div
              key={j.id}
              className="flex items-center gap-2 rounded-2xl bg-superficie p-3"
            >
              <span className="text-2xl">{j.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{j.nombre}</p>
                <p className="text-xs text-texto-suave">
                  {j.partidas} {j.partidas === 1 ? "partida" : "partidas"} ·{" "}
                  {j.modo === "equipos" ? "equipos" : "individual"}
                </p>
              </div>
              {puedeBorrar && j.partidas === 0 && (
                <button
                  disabled={ocupado !== null}
                  onClick={() => borrar(j.id)}
                  className="p-1 text-texto-suave"
                  aria-label={`Borrar ${j.nombre}`}
                >
                  {ocupado === j.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {!abierto && error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
