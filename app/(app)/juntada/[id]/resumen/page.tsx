import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Crown, MapPin } from "lucide-react";
import { usuarioActual } from "@/lib/sesion";
import { duracion, fechaYHora, hora } from "@/lib/tiempo";
import { calcularCuentas, pesos } from "@/lib/cuentas";
import { TIPOS } from "@/lib/consumos";
import { Avatar } from "@/components/ui/Avatar";
import type { Asistencia, Confirmacion, Juntada } from "@/lib/tipos";

export default function ResumenPage({ params }: PageProps<"/juntada/[id]/resumen">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4 pt-2">
          <div className="h-8 w-2/3 animate-pulse rounded-lg bg-superficie" />
          <div className="h-32 animate-pulse rounded-2xl bg-superficie" />
          <div className="h-48 animate-pulse rounded-2xl bg-superficie" />
        </div>
      }
    >
      <Contenido params={params} />
    </Suspense>
  );
}

type ConsumoR = {
  tipo: "comida" | "postre" | "bebida" | "otro";
  descripcion: string;
  monto: number | null;
  pagado_por: string | null;
};

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await usuarioActual();

  const [{ data: j }, { data: perfs }, { data: asis }, { data: conf }, { data: cons }, { data: excl }, { data: pags }] =
    await Promise.all([
      supabase.from("juntadas").select("*").eq("id", id).maybeSingle(),
      supabase.from("perfiles").select("id, apodo"),
      supabase.from("asistencias").select("*").eq("juntada_id", id).order("entrada"),
      supabase.from("confirmaciones").select("*").eq("juntada_id", id),
      supabase.from("consumos").select("tipo, descripcion, monto, pagado_por").eq("juntada_id", id).order("creado_en"),
      supabase.from("exclusiones_gasto").select("perfil_id").eq("juntada_id", id),
      supabase.from("pagos").select("de_perfil, a_perfil, monto").eq("juntada_id", id),
    ]);
  if (!j) notFound();

  const juntada = j as Juntada;
  const apodo = (pid: string | null) => (perfs ?? []).find((p) => p.id === pid)?.apodo ?? "?";
  const asistencias = (asis as Asistencia[]) ?? [];
  const confirmaciones = (conf as Confirmacion[]) ?? [];
  const consumos = ((cons as ConsumoR[]) ?? []).map((c) => ({ ...c, monto: c.monto == null ? null : Number(c.monto) }));

  // ---- Asistencia por persona ----
  const ids = [...new Set(asistencias.map((a) => a.perfil_id))];
  const personas = ids
    .map((pid) => {
      const suyas = asistencias.filter((a) => a.perfil_id === pid);
      const llegada = suyas[0].entrada;
      const salidas = suyas.map((a) => a.salida).filter(Boolean) as string[];
      const promesa = confirmaciones.find((c) => c.perfil_id === pid && c.va)?.hora_prometida ?? null;
      const limite = new Date(promesa ?? juntada.inicio_programado).getTime() + juntada.tolerancia_min * 60_000;
      return {
        pid,
        llegada,
        salida: salidas.sort().at(-1) ?? null,
        minutos: suyas.reduce((s, a) => s + (a.duracion_min ?? 0), 0),
        puntual: new Date(llegada).getTime() <= limite,
        promesa,
        olvido: suyas.some((a) => a.origen_salida === "auto_12h" || a.origen_salida === "auto_fin"),
      };
    })
    .sort((a, b) => b.minutos - a.minutos);

  const totalMin = personas.reduce((s, p) => s + p.minutos, 0);
  const primero = [...personas].sort((a, b) => a.llegada.localeCompare(b.llegada))[0];
  const ultimo = [...personas]
    .filter((p) => p.salida && !p.olvido)
    .sort((a, b) => b.salida!.localeCompare(a.salida!))[0];
  const plantaron = confirmaciones.filter((c) => c.va && !ids.includes(c.perfil_id));
  const noFueron = confirmaciones.filter((c) => !c.va);
  const duracionJuntada =
    juntada.iniciada_en && juntada.finalizada_en
      ? (new Date(juntada.finalizada_en).getTime() - new Date(juntada.iniciada_en).getTime()) / 60_000
      : null;

  // ---- Cuentas ----
  const fuera = new Set((excl ?? []).map((e) => e.perfil_id));
  const cuentas = calcularCuentas(
    ids.filter((p) => !fuera.has(p)),
    consumos,
    (pags ?? []).map((p) => ({ ...p, monto: Number(p.monto) })),
  );

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-2">
        <Link href={`/juntada/${id}`} className="-ml-2 w-fit rounded-full p-2 text-texto-suave">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="w-fit rounded-full bg-acento/15 px-2.5 py-0.5 text-xs font-medium text-acento">Resumen</span>
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
            <Crown className="size-4" /> {apodo(juntada.anfitrion_id)}
          </span>
        </div>
      </div>

      {/* Números grandes */}
      <div className="grid grid-cols-2 gap-3">
        <Dato valor={String(personas.length)} etiqueta={personas.length === 1 ? "fue" : "fueron"} />
        <Dato valor={duracion(duracionJuntada ?? 0)} etiqueta="duró la juntada" />
        <Dato valor={duracion(personas.length ? totalMin / personas.length : 0)} etiqueta="promedio por persona" />
        <Dato valor={pesos(cuentas.total)} etiqueta="gastaron en total" />
      </div>

      {(primero || ultimo) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-borde bg-superficie p-4">
            <p className="text-2xl">🚀</p>
            <p className="text-xs text-texto-suave">Llegó primero</p>
            <p className="font-bold text-acento">{primero ? apodo(primero.pid) : "—"}</p>
            {primero && <p className="text-xs text-texto-suave">{hora(primero.llegada)}</p>}
          </div>
          <div className="rounded-2xl border border-borde bg-superficie p-4">
            <p className="text-2xl">💡</p>
            <p className="text-xs text-texto-suave">Apagó la luz</p>
            <p className="font-bold text-acento">{ultimo ? apodo(ultimo.pid) : "—"}</p>
            {ultimo?.salida && <p className="text-xs text-texto-suave">{hora(ultimo.salida)}</p>}
          </div>
        </div>
      )}

      {/* Quién fue */}
      <Seccion titulo={`Quién fue · ${personas.length}`}>
        {personas.length === 0 && <p className="text-sm text-texto-suave">No se registró nadie.</p>}
        {personas.map((p) => (
          <div key={p.pid} className="flex items-center gap-3 rounded-2xl bg-superficie p-3">
            <Avatar apodo={apodo(p.pid)} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{apodo(p.pid)}</p>
              <p className="text-xs text-texto-suave">
                {hora(p.llegada)} → {p.salida ? hora(p.salida) : "—"}
                {p.olvido && " · no escaneó la salida"}
              </p>
              <p className={`text-xs ${p.puntual ? "text-acento" : "text-red-300"}`}>
                {p.puntual ? "A tiempo" : "Llegó tarde"}
                {p.promesa && ` (dijo ${hora(p.promesa)})`}
              </p>
            </div>
            <span className="font-mono text-sm">{duracion(p.minutos)}</span>
          </div>
        ))}
      </Seccion>

      {(plantaron.length > 0 || noFueron.length > 0) && (
        <div className="flex flex-col gap-1 rounded-2xl border border-borde p-3 text-sm">
          {plantaron.length > 0 && (
            <p>
              <span className="text-red-300">🤥 Dijeron que iban y no fueron: </span>
              {plantaron.map((c) => apodo(c.perfil_id)).join(", ")}
            </p>
          )}
          {noFueron.length > 0 && (
            <p>
              <span className="text-texto-suave">Avisaron que no iban: </span>
              {noFueron.map((c) => apodo(c.perfil_id)).join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Consumos y cuentas */}
      <Seccion titulo="Comida y cuentas">
        {consumos.length === 0 ? (
          <p className="text-sm text-texto-suave">No cargaron consumos.</p>
        ) : (
          <div className="flex flex-col gap-1.5 rounded-2xl bg-superficie p-3">
            {consumos.map((c, i) => {
              const t = TIPOS.find((x) => x.clave === c.tipo);
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span>{t?.emoji}</span>
                  <span className="flex-1">{c.descripcion}</span>
                  {c.monto != null && (
                    <span className="text-xs text-texto-suave">
                      {pesos(c.monto)} · {apodo(c.pagado_por)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {cuentas.total > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl border border-acento/30 bg-acento/5 p-4 text-sm">
            <p>
              Total <b>{pesos(cuentas.total)}</b> entre {cuentas.participantes.length} ={" "}
              <b className="text-acento">{pesos(cuentas.cuota)} c/u</b>
            </p>
            {cuentas.deudas.length ? (
              cuentas.deudas.map((d) => (
                <p key={`${d.de}-${d.a}`}>
                  <b>{apodo(d.de)}</b> le debe <b>{pesos(d.monto)}</b> a <b>{apodo(d.a)}</b>
                </p>
              ))
            ) : (
              <p className="text-acento">✓ Cuentas claras</p>
            )}
            <Link href={`/juntada/${id}`} className="text-xs text-texto-suave underline">
              Saldar deudas en la juntada
            </Link>
          </div>
        )}
      </Seccion>
    </div>
  );
}

function Dato({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="rounded-2xl bg-superficie p-4">
      <p className="text-2xl font-bold">{valor}</p>
      <p className="text-sm text-texto-suave">{etiqueta}</p>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">{titulo}</h2>
      {children}
    </section>
  );
}
