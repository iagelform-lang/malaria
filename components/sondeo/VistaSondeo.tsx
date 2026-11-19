"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Crown,
  Loader2,
  MapPin,
  Trash2,
  Trophy,
  UtensilsCrossed,
} from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { fechaYHora } from "@/lib/tiempo";
import { mensajeError } from "@/lib/errores";
import { nivelDe } from "@/lib/juegos";
import { useAhora } from "@/lib/hooks/useAhora";

export type Sondeo = {
  id: string;
  nombre: string;
  lugar: string | null;
  comida: string | null;
  creado_por: string;
  casa_de: string | null;
  puntos?: number;
  estado: "abierto" | "cerrado";
};
export type Opcion = { id: number; inicio: string };
export type Voto = { opcion_id: number; perfil_id: string };

export function VistaSondeo({
  sondeo,
  opciones,
  votosIniciales,
  perfiles,
  uid,
  puedeElegir,
  mayoria,
}: {
  sondeo: Sondeo;
  opciones: Opcion[];
  votosIniciales: Voto[];
  perfiles: { id: string; apodo: string }[];
  uid: string;
  puedeElegir: boolean;
  mayoria: number;
}) {
  const router = useRouter();
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [votos, setVotos] = useState(votosIniciales);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<number | null>(null);
  const ahora = useAhora(60_000);
  const apodo = (id: string) => perfiles.find((p) => p.id === id)?.apodo ?? "?";
  const ids = useMemo(() => opciones.map((o) => o.id), [opciones]);

  const recargar = useCallback(async () => {
    if (!ids.length) return;
    const { data } = await supabase
      .from("sondeo_votos")
      .select("opcion_id, perfil_id")
      .in("opcion_id", ids);
    if (data) setVotos(data as Voto[]);
  }, [supabase, ids]);

  useEffect(() => {
    const canal = supabase
      .channel(`sondeo-${sondeo.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sondeo_votos" },
        recargar,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, sondeo.id, recargar]);

  const abierto = sondeo.estado === "abierto";
  const conteo = (id: number) => votos.filter((v) => v.opcion_id === id);
  const max = Math.max(0, ...opciones.map((o) => conteo(o.id).length));
  const votaron = new Set(votos.map((v) => v.perfil_id));
  const faltan = perfiles.filter((p) => !votaron.has(p.id));

  async function alternar(o: Opcion) {
    const mio = votos.some((v) => v.opcion_id === o.id && v.perfil_id === uid);
    setOcupado(`v${o.id}`);
    setAviso(null);
    const { error } = mio
      ? await supabase
          .from("sondeo_votos")
          .delete()
          .eq("opcion_id", o.id)
          .eq("perfil_id", uid)
      : await supabase.from("sondeo_votos").insert({ opcion_id: o.id });
    setOcupado(null);
    if (error) return setAviso(mensajeError(error));
    // si con este voto llegó a la mayoría, ya se armó la juntada
    const { data: s } = await supabase
      .from("sondeos")
      .select("estado, juntada_id")
      .eq("id", sondeo.id)
      .single();
    if (s?.estado === "cerrado" && s.juntada_id)
      return router.replace(`/juntada/${s.juntada_id}`);
    await recargar();
  }

  async function elegir(o: Opcion) {
    setOcupado(`e${o.id}`);
    setAviso(null);
    const { data, error } = await supabase.rpc("elegir_fecha", {
      p_opcion_id: o.id,
    });
    setOcupado(null);
    if (error) return setAviso(mensajeError(error));
    router.replace(`/juntada/${data}`);
  }

  async function borrar() {
    setOcupado("borrar");
    const { error } = await supabase
      .from("sondeos")
      .delete()
      .eq("id", sondeo.id);
    setOcupado(null);
    if (error) return setAviso(mensajeError(error));
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-2">
        <Link
          href="/"
          className="-ml-2 w-fit rounded-full p-2 text-texto-suave"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="w-fit rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-medium text-violet-700">
          Votando la fecha · ⭐ {nivelDe(sondeo.puntos ?? 10).nombre} · {sondeo.puntos ?? 10} pts
        </span>
        <h1 className="text-3xl font-bold leading-tight">{sondeo.nombre}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-texto-suave">
          {sondeo.lugar && (
            <span className="flex items-center gap-1">
              <MapPin className="size-4" /> {sondeo.lugar}
            </span>
          )}
          {sondeo.comida && (
            <span className="flex items-center gap-1">
              <UtensilsCrossed className="size-4" /> {sondeo.comida}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Crown className="size-4" />{" "}
            {sondeo.casa_de
              ? `En lo de ${apodo(sondeo.casa_de)}`
              : apodo(sondeo.creado_por)}
          </span>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">
          Tocá las fechas que podés
        </h2>
        <p className="-mt-1 text-xs text-texto-suave">
          Se define sola cuando una fecha llega a{" "}
          <b className="text-acento">{mayoria} votos</b>. Después, cada uno confirma si va.
        </p>
        {opciones.map((o) => {
          const quienes = conteo(o.id);
          const mio = quienes.some((v) => v.perfil_id === uid);
          const lider = max > 0 && quienes.length === max;
          const pasada =
            ahora !== null && new Date(o.inicio).getTime() <= ahora;
          return (
            <div
              key={o.id}
              className={`flex flex-col gap-2 rounded-2xl border p-3 ${
                mio
                  ? "border-acento bg-acento/10"
                  : "border-borde bg-superficie"
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  disabled={!abierto || ocupado !== null || pasada}
                  onClick={() => alternar(o)}
                  className={`grid size-9 shrink-0 place-items-center rounded-full ${
                    mio ? "bg-acento text-white" : "bg-fondo ring-1 ring-borde"
                  } disabled:opacity-50`}
                  aria-label={mio ? "Quitar mi voto" : "Puedo"}
                >
                  {ocupado === `v${o.id}` ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    mio && <Check className="size-5" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold capitalize">
                    {fechaYHora(o.inicio)}
                  </p>
                  <p className="text-xs text-texto-suave">
                    {quienes.length
                      ? quienes.map((v) => apodo(v.perfil_id)).join(", ")
                      : "Nadie todavía"}
                  </p>
                </div>
                <span
                  className={`flex items-center gap-1 text-lg font-black ${lider ? "text-acento" : "text-texto-suave"}`}
                >
                  {lider && <Trophy className="size-4" />} {quienes.length}
                  <span className="text-xs font-normal text-texto-suave">
                    /{mayoria}
                  </span>
                </span>
              </div>
              {abierto &&
                puedeElegir &&
                !pasada &&
                (confirmar === o.id ? (
                  <button
                    disabled={ocupado !== null}
                    onClick={() => elegir(o)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-acento py-2 text-sm font-bold text-white"
                  >
                    {ocupado === `e${o.id}` && (
                      <Loader2 className="size-4 animate-spin" />
                    )}{" "}
                    Sí, armar la juntada este día
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmar(o.id)}
                    className="text-left text-xs text-acento underline"
                  >
                    Elegir esta fecha
                  </button>
                ))}
            </div>
          );
        })}
      </section>

      {faltan.length > 0 && (
        <p className="text-sm text-texto-suave">
          <b>Falta votar:</b> {faltan.map((p) => p.apodo).join(", ")}
        </p>
      )}

      {puedeElegir && abierto && (
        <p className="text-xs text-texto-suave">
          Cuando elijas la fecha se crea la juntada, les avisa a todos y los que
          votaron ese día quedan anotados como que van.
        </p>
      )}

      {aviso && <p className="text-sm text-red-600">{aviso}</p>}

      {puedeElegir && (
        <button
          disabled={ocupado !== null}
          onClick={borrar}
          className="mt-4 flex items-center justify-center gap-2 text-sm text-texto-suave"
        >
          <Trash2 className="size-4" /> Borrar votación
        </button>
      )}
    </div>
  );
}
