"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Clock,
  Crown,
  DoorOpen,
  Flag,
  Loader2,
  MapPin,
  Play,
  ScanLine,
  Share2,
  X,
} from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { useAhora } from "@/lib/hooks/useAhora";
import { aInputLocal, cronometro, desdeInputLocal, duracion, fechaYHora, hora } from "@/lib/tiempo";
import { mensajeError } from "@/lib/errores";
import type { Asistencia, Confirmacion, Juntada, Perfil } from "@/lib/tipos";
import { Avatar } from "@/components/ui/Avatar";
import { SeccionConsumos } from "@/components/juntada/SeccionConsumos";

type Props = {
  juntadaInicial: Juntada;
  perfiles: Perfil[];
  asistenciasIniciales: Asistencia[];
  confirmacionesIniciales: Confirmacion[];
  uid: string;
  puedeGestionar: boolean;
  esAdmin: boolean;
};

const ETIQUETA_ESTADO: Record<Juntada["estado"], { texto: string; clase: string }> = {
  propuesta: { texto: "Propuesta", clase: "bg-sky-500/15 text-sky-300" },
  activa: { texto: "En curso", clase: "bg-acento/15 text-acento" },
  finalizada: { texto: "Finalizada", clase: "bg-zinc-500/20 text-zinc-300" },
  cancelada: { texto: "Cancelada", clase: "bg-red-500/15 text-red-300" },
};

export function VistaJuntada({
  juntadaInicial,
  perfiles,
  asistenciasIniciales,
  confirmacionesIniciales,
  uid,
  puedeGestionar,
  esAdmin,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const ahoraVivo = useAhora(1000);
  const ahora = ahoraVivo ?? 0;

  const [juntada, setJuntada] = useState(juntadaInicial);
  const [asistencias, setAsistencias] = useState(asistenciasIniciales);
  const [confirmaciones, setConfirmaciones] = useState(confirmacionesIniciales);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const id = juntada.id;
  const apodos = useMemo(() => new Map(perfiles.map((p) => [p.id, p])), [perfiles]);

  // ---------- Tiempo real ----------
  const recargar = useCallback(async () => {
    const [j, a, c] = await Promise.all([
      supabase.from("juntadas").select("*").eq("id", id).single(),
      supabase.from("asistencias").select("*").eq("juntada_id", id).order("entrada"),
      supabase.from("confirmaciones").select("*").eq("juntada_id", id),
    ]);
    if (j.data) setJuntada(j.data as Juntada);
    if (a.data) setAsistencias(a.data as Asistencia[]);
    if (c.data) setConfirmaciones(c.data as Confirmacion[]);
  }, [supabase, id]);

  useEffect(() => {
    const canal = supabase
      .channel(`juntada-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "asistencias", filter: `juntada_id=eq.${id}` },
        recargar,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "confirmaciones", filter: `juntada_id=eq.${id}` },
        recargar,
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "juntadas", filter: `id=eq.${id}` }, recargar)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "juntadas" }, (payload) => {
        if ((payload.old as { id?: string })?.id === id) router.replace("/");
      })
      .subscribe();

    // El celular corta el websocket al bloquearse: al volver, refrescamos
    const alVolver = () => document.visibilityState === "visible" && recargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      supabase.removeChannel(canal);
    };
  }, [supabase, id, recargar, router]);

  // ---------- Derivados ----------
  const abiertas = asistencias.filter((a) => !a.salida);
  const idsPresentes = new Set(abiertas.map((a) => a.perfil_id));
  const idsQueVinieron = new Set(asistencias.map((a) => a.perfil_id));
  const seFueron = [...idsQueVinieron]
    .filter((p) => !idsPresentes.has(p))
    .map((p) => {
      const suyas = asistencias.filter((a) => a.perfil_id === p);
      return {
        perfil_id: p,
        minutos: suyas.reduce((s, a) => s + (a.duracion_min ?? 0), 0),
        ultimaSalida: suyas
          .map((a) => a.salida!)
          .sort()
          .at(-1)!,
        olvido: suyas.some((a) => a.origen_salida === "auto_12h" || a.origen_salida === "auto_fin"),
      };
    })
    .sort((a, b) => b.ultimaSalida.localeCompare(a.ultimaSalida));
  const esperados = confirmaciones
    .filter((c) => c.va && c.hora_prometida && !idsQueVinieron.has(c.perfil_id))
    .sort((a, b) => a.hora_prometida!.localeCompare(b.hora_prometida!));
  const noVan = confirmaciones.filter((c) => !c.va && !idsQueVinieron.has(c.perfil_id));
  const respondieron = new Set(confirmaciones.map((c) => c.perfil_id));
  const sinResponder = perfiles.filter((p) => !respondieron.has(p.id) && !idsQueVinieron.has(p.id));
  const miConfirmacion = confirmaciones.find((c) => c.perfil_id === uid);
  const estoyPresente = idsPresentes.has(uid);
  const abierta = juntada.estado === "propuesta" || juntada.estado === "activa";
  const estado = ETIQUETA_ESTADO[juntada.estado];

  // ---------- Acciones ----------
  async function ejecutar(fn: () => PromiseLike<{ error: { message?: string } | null }>, ok?: string) {
    setOcupado(true);
    setAviso(null);
    const { error } = await fn();
    setOcupado(false);
    if (error) setAviso(mensajeError(error));
    else {
      if (ok) setAviso(ok);
      await recargar();
      router.refresh();
    }
  }

  function compartir() {
    const url = `${window.location.origin}/juntada/${id}`;
    const texto =
      juntada.estado === "activa"
        ? `🔥 Ya arrancó: ${juntada.nombre}${juntada.lugar ? ` en ${juntada.lugar}` : ""}. Mirá quién está: ${url}`
        : `📅 ${juntada.nombre} — ${fechaYHora(juntada.inicio_programado)}${
            juntada.lugar ? ` en ${juntada.lugar}` : ""
          }. Decí a qué hora llegás: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  }

  return (
    <div className="flex flex-col gap-6 pt-2">
      {/* Encabezado */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Link href="/" className="-ml-2 rounded-full p-2 text-texto-suave">
            <ArrowLeft className="size-5" />
          </Link>
          <button
            onClick={compartir}
            className="flex items-center gap-1.5 rounded-full bg-[#25D366]/15 px-3 py-1.5 text-sm text-[#25D366]"
          >
            <Share2 className="size-4" /> WhatsApp
          </button>
        </div>
        <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${estado.clase}`}>{estado.texto}</span>
        <h1 className="text-3xl font-bold leading-tight">{juntada.nombre}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-texto-suave">
          <span className="flex items-center gap-1">
            <Clock className="size-4" /> {fechaYHora(juntada.inicio_programado)}
          </span>
          {juntada.lugar && (
            <span className="flex items-center gap-1">
              <MapPin className="size-4" /> {juntada.lugar}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Crown className="size-4" /> {apodos.get(juntada.anfitrion_id)?.apodo ?? "?"}
          </span>
        </div>
      </div>

      {aviso && (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-borde bg-superficie p-3 text-sm">
          <span>{aviso}</span>
          <button onClick={() => setAviso(null)}>
            <X className="size-4 text-texto-suave" />
          </button>
        </div>
      )}

      {/* Panel del anfitrión */}
      {juntada.estado === "propuesta" && (
        <div className="flex flex-col gap-2">
          {ahoraVivo !== null && ahora < new Date(juntada.inicio_programado).getTime() ? (
            <div className="flex items-center gap-3 rounded-xl border border-borde bg-superficie p-4">
              <Clock className="size-5 text-acento" />
              <p className="text-sm">
                Arranca sola a las <b>{hora(juntada.inicio_programado)}</b>
                {" · "}
                <span className="text-texto-suave">
                  en {duracion((new Date(juntada.inicio_programado).getTime() - ahora) / 60_000)}
                </span>
              </p>
            </div>
          ) : (
            puedeGestionar && (
              // Solo aparece si ya pasó la hora y el arranque automático todavía no corrió
              <button
                disabled={ocupado}
                onClick={() =>
                  ejecutar(
                    () => supabase.rpc("iniciar_juntada", { p_juntada_id: id }),
                    "¡Arrancó la juntada! Ya quedaste anotado como presente.",
                  )
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-acento py-4 text-lg font-semibold text-black active:scale-[0.98] disabled:opacity-50"
              >
                {ocupado ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-5" />} Arrancar ahora
              </button>
            )
          )}
          {puedeGestionar && (
            <BotonConfirmar
              texto="Cancelar juntada"
              confirmar="Sí, cancelarla"
              peligro
              onConfirmar={() => ejecutar(() => supabase.rpc("cancelar_juntada", { p_juntada_id: id }))}
            />
          )}
        </div>
      )}
      {puedeGestionar && juntada.estado === "activa" && (
        <div className="flex flex-col gap-2">
          {!estoyPresente && (
            <button
              disabled={ocupado}
              onClick={() =>
                ejecutar(
                  () => supabase.rpc("registrar_mi_llegada", { p_juntada_id: id }),
                  "Listo, quedaste anotado como presente.",
                )
              }
              className="flex items-center justify-center gap-2 rounded-xl border border-acento/50 py-3 font-semibold text-acento"
            >
              <Check className="size-5" /> Registrar mi llegada
            </button>
          )}
          <Link
            href={`/juntada/${id}/escanear`}
            className="flex items-center justify-center gap-2 rounded-xl bg-acento py-4 text-lg font-semibold text-black active:scale-[0.98]"
          >
            <ScanLine className="size-5" /> Escanear QR
          </Link>
          <BotonConfirmar
            texto="Finalizar juntada"
            confirmar={`Sí, finalizar${abiertas.length ? ` (cierra ${abiertas.length} salidas)` : ""}`}
            peligro
            onConfirmar={() =>
              ejecutar(() => supabase.rpc("finalizar_juntada", { p_juntada_id: id }), "Juntada finalizada.")
            }
          />
        </div>
      )}

      {/* Mi respuesta: Voy (con hora) / No voy */}
      {abierta && !estoyPresente && !idsQueVinieron.has(uid) && (
        <MiRespuesta
          juntada={juntada}
          confirmacion={miConfirmacion}
          ahora={ahora}
          onVoy={(iso) =>
            ejecutar(
              () =>
                supabase.from("confirmaciones").upsert({
                  juntada_id: id,
                  perfil_id: uid,
                  va: true,
                  hora_prometida: iso,
                  actualizado_en: new Date().toISOString(),
                }),
              "Listo, quedó anotado que vas.",
            )
          }
          onNoVoy={() =>
            ejecutar(
              () =>
                supabase.from("confirmaciones").upsert({
                  juntada_id: id,
                  perfil_id: uid,
                  va: false,
                  hora_prometida: null,
                  actualizado_en: new Date().toISOString(),
                }),
              "Quedó anotado que no vas.",
            )
          }
        />
      )}

      {/* Presentes */}
      {(juntada.estado === "activa" || abiertas.length > 0) && (
        <Seccion titulo={`Ahora en la juntada · ${abiertas.length}`}>
          {abiertas.length === 0 && <Vacio texto="Todavía no llegó nadie." />}
          {abiertas.map((a) => (
            <FilaPresente
              key={a.id}
              asistencia={a}
              perfil={apodos.get(a.perfil_id)}
              ahora={ahora}
              esYo={a.perfil_id === uid}
              puedeGestionar={puedeGestionar && juntada.estado === "activa"}
              onSalida={(iso) =>
                ejecutar(
                  () => supabase.rpc("marcar_salida_manual", { p_asistencia_id: a.id, p_hora: iso }),
                  `Salida marcada para ${apodos.get(a.perfil_id)?.apodo ?? "?"}.`,
                )
              }
            />
          ))}
        </Seccion>
      )}

      {/* Esperados */}
      {abierta && (
        <Seccion titulo={`Van · ${esperados.length}`}>
          {esperados.length === 0 && <Vacio texto="Todavía nadie dijo que va." />}
          {esperados.map((c) => {
            const limite = new Date(c.hora_prometida!).getTime() + juntada.tolerancia_min * 60_000;
            const atraso = Math.floor((ahora - limite) / 60_000);
            return (
              <div key={c.perfil_id} className="flex items-center gap-3 rounded-2xl bg-superficie p-3">
                <Avatar apodo={apodos.get(c.perfil_id)?.apodo ?? "?"} />
                <div className="flex-1">
                  <p className="font-medium">{apodos.get(c.perfil_id)?.apodo ?? "?"}</p>
                  <p className="text-sm text-texto-suave">Llega {hora(c.hora_prometida!)}</p>
                </div>
                {ahoraVivo !== null && juntada.estado === "activa" && atraso > 0 && (
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">
                    +{duracion(atraso)} tarde
                  </span>
                )}
              </div>
            );
          })}
        </Seccion>
      )}
      {abierta && (noVan.length > 0 || sinResponder.length > 0) && (
        <div className="flex flex-col gap-2 rounded-2xl border border-borde p-3 text-sm">
          {noVan.length > 0 && (
            <p>
              <span className="text-texto-suave">No van ({noVan.length}): </span>
              {noVan.map((c) => apodos.get(c.perfil_id)?.apodo ?? "?").join(", ")}
            </p>
          )}
          {sinResponder.length > 0 && (
            <p>
              <span className="text-amber-300">Falta responder ({sinResponder.length}): </span>
              {sinResponder.map((p) => p.apodo).join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Se fueron */}
      {seFueron.length > 0 && (
        <Seccion titulo={`${juntada.estado === "finalizada" ? "Fueron" : "Ya se fueron"} · ${seFueron.length}`}>
          {seFueron.map((s, i) => (
            <div key={s.perfil_id} className="flex items-center gap-3 rounded-2xl bg-superficie p-3">
              <Avatar apodo={apodos.get(s.perfil_id)?.apodo ?? "?"} apagado />
              <div className="flex-1">
                <p className="font-medium">
                  {apodos.get(s.perfil_id)?.apodo ?? "?"}
                  {juntada.estado === "finalizada" && i === 0 && !s.olvido && " 💡"}
                </p>
                <p className="text-sm text-texto-suave">
                  Se fue {hora(s.ultimaSalida)}
                  {s.olvido && " · no escaneó la salida"}
                </p>
              </div>
              <span className="font-mono text-sm">{duracion(s.minutos)}</span>
            </div>
          ))}
        </Seccion>
      )}

      {(juntada.estado === "activa" || juntada.estado === "finalizada") && (
        <SeccionConsumos
          juntadaId={id}
          uid={uid}
          puedeGestionar={puedeGestionar}
          perfiles={perfiles}
          idsQueVinieron={[...idsQueVinieron]}
        />
      )}

      {juntada.estado === "cancelada" && <Vacio texto="Esta juntada se canceló." />}

      {/* Solo admins: borrar una juntada creada o arrancada por error */}
      {esAdmin && (
        <div className="mt-6 border-t border-borde pt-6">
          <BotonConfirmar
            texto="Eliminar juntada"
            confirmar="Sí, eliminar para siempre"
            peligro
            onConfirmar={async () => {
              setOcupado(true);
              const { error } = await supabase.rpc("eliminar_juntada", { p_juntada_id: id });
              setOcupado(false);
              if (error) setAviso(mensajeError(error));
              else {
                router.replace("/");
                router.refresh();
              }
            }}
          />
          <p className="mt-2 text-center text-xs text-texto-suave">
            Borra la juntada con todas sus entradas, salidas y horas prometidas. No se puede deshacer.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- Subcomponentes ----------

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">{titulo}</h2>
      {children}
    </section>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-borde p-4 text-center text-sm text-texto-suave">{texto}</p>
  );
}

function BotonConfirmar({
  texto,
  confirmar,
  peligro,
  onConfirmar,
}: {
  texto: string;
  confirmar: string;
  peligro?: boolean;
  onConfirmar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto)
    return (
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center justify-center gap-2 rounded-xl border border-borde py-3 text-texto-suave"
      >
        <Flag className="size-4" /> {texto}
      </button>
    );
  return (
    <div className="flex gap-2">
      <button
        onClick={() => {
          setAbierto(false);
          onConfirmar();
        }}
        className={`flex-1 rounded-xl py-3 font-semibold ${peligro ? "bg-red-500/90 text-white" : "bg-acento text-black"}`}
      >
        {confirmar}
      </button>
      <button onClick={() => setAbierto(false)} className="rounded-xl border border-borde px-4">
        No
      </button>
    </div>
  );
}

function MiRespuesta({
  juntada,
  confirmacion,
  ahora,
  onVoy,
  onNoVoy,
}: {
  juntada: Juntada;
  confirmacion?: Confirmacion;
  ahora: number;
  onVoy: (iso: string) => void;
  onNoVoy: () => void;
}) {
  const [eligiendoHora, setEligiendoHora] = useState(false);
  const base = new Date(Math.max(new Date(juntada.inicio_programado).getTime(), ahora + 5 * 60_000));
  const [valor, setValor] = useState(() =>
    aInputLocal(confirmacion?.hora_prometida ? new Date(confirmacion.hora_prometida) : base),
  );
  const vencida =
    ahora > 0 &&
    confirmacion?.va &&
    confirmacion.hora_prometida &&
    new Date(confirmacion.hora_prometida).getTime() <= ahora;

  // Ya respondió
  if (confirmacion && !eligiendoHora)
    return (
      <div
        className={`flex items-center justify-between rounded-2xl border p-4 ${
          confirmacion.va ? "border-acento/40 bg-acento/10" : "border-borde bg-superficie"
        }`}
      >
        <div>
          {confirmacion.va ? (
            <>
              <p className="text-sm text-texto-suave">Vas · llegás a las</p>
              <p className="text-2xl font-bold">{hora(confirmacion.hora_prometida!)}</p>
            </>
          ) : (
            <p className="text-lg font-bold">No vas</p>
          )}
        </div>
        {vencida ? (
          <span className="text-xs text-texto-suave">Ya no se puede cambiar</span>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <button onClick={() => setEligiendoHora(true)} className="text-sm text-acento">
              {confirmacion.va ? "Cambiar hora" : "Al final voy"}
            </button>
            {confirmacion.va && (
              <button onClick={onNoVoy} className="text-xs text-texto-suave">
                Al final no voy
              </button>
            )}
          </div>
        )}
      </div>
    );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-acento/60 bg-superficie p-4">
      <p className="text-lg font-bold">¿Vas?</p>
      {!eligiendoHora ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setEligiendoHora(true)}
            className="rounded-xl bg-acento py-4 text-lg font-bold text-black active:scale-[0.98]"
          >
            Voy
          </button>
          <button
            onClick={onNoVoy}
            className="rounded-xl border border-borde py-4 text-lg font-semibold active:scale-[0.98]"
          >
            No voy
          </button>
        </div>
      ) : (
        <>
          <p className="-mt-1 text-sm text-texto-suave">
            ¿A qué hora llegás? Cuenta para tu puntualidad (tolerancia {juntada.tolerancia_min} min).
          </p>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-borde bg-fondo px-3 py-3 outline-none focus:border-acento"
            />
            <button
              onClick={() => {
                onVoy(desdeInputLocal(valor));
                setEligiendoHora(false);
              }}
              className="rounded-xl bg-acento px-4 font-semibold text-black"
            >
              Listo
            </button>
          </div>
          <button onClick={() => setEligiendoHora(false)} className="text-sm text-texto-suave">
            Volver
          </button>
        </>
      )}
    </div>
  );
}

function FilaPresente({
  asistencia,
  perfil,
  ahora,
  esYo,
  puedeGestionar,
  onSalida,
}: {
  asistencia: Asistencia;
  perfil?: Perfil;
  ahora: number;
  esYo: boolean;
  puedeGestionar: boolean;
  onSalida: (iso: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState(() => aInputLocal(new Date()));

  return (
    <div className={`flex flex-col gap-3 rounded-2xl bg-superficie p-3 ${esYo ? "ring-1 ring-acento/50" : ""}`}>
      <div className="flex items-center gap-3">
        <Avatar apodo={perfil?.apodo ?? "?"} activo />
        <div className="flex-1">
          <p className="font-medium">
            {perfil?.apodo ?? "?"} {esYo && <span className="text-xs text-acento">(vos)</span>}
          </p>
          <p className="text-sm text-texto-suave">Desde {hora(asistencia.entrada)}</p>
        </div>
        <span className="font-mono text-lg tabular-nums text-acento">
          {ahora ? cronometro(asistencia.entrada, ahora) : "—:—"}
        </span>
        {puedeGestionar && (
          <button
            onClick={() => setAbierto(!abierto)}
            className="rounded-lg border border-borde p-2 text-texto-suave"
            aria-label="Marcar salida"
          >
            <DoorOpen className="size-4" />
          </button>
        )}
      </div>
      {abierto && (
        <div className="flex flex-col gap-2 border-t border-borde pt-3">
          <p className="text-xs text-texto-suave">Marcar salida manual</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setAbierto(false);
                onSalida(new Date().toISOString());
              }}
              className="rounded-xl bg-acento px-3 py-2 text-sm font-semibold text-black"
            >
              Ahora
            </button>
            <input
              type="datetime-local"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-borde bg-fondo px-2 text-sm outline-none"
            />
            <button
              onClick={() => {
                setAbierto(false);
                onSalida(desdeInputLocal(valor));
              }}
              className="rounded-xl border border-borde px-3 text-sm"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
