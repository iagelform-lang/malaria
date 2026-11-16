import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usuarioActual } from "@/lib/sesion";
import { calcularWrapped, esDelAnio, type AW, type CW, type GW, type JW, type Persona } from "@/lib/wrapped";
import { pesos } from "@/lib/cuentas";

export default function WrappedPage(props: PageProps<"/wrapped">) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/stats" className="-ml-2 w-fit rounded-full p-2 text-texto-suave">
        <ArrowLeft className="size-5" />
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-superficie" />}>
        <Contenido searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/wrapped">["searchParams"] }) {
  const { supabase } = await usuarioActual();
  const sp = await searchParams;
  // se calcula en cada pedido (la página es dinámica), así que leer la hora acá es correcto
  // eslint-disable-next-line react-hooks/purity
  const anioActual = new Date(Date.now() - 3 * 3600_000).getUTCFullYear();
  const pedido = Number(Array.isArray(sp.anio) ? sp.anio[0] : sp.anio);
  const anio = Number.isInteger(pedido) && pedido > 2000 && pedido <= anioActual ? pedido : anioActual;

  const [{ data: js }, { data: as }, { data: cs }, { data: gs }, { data: ps }, { count: fotos }] = await Promise.all([
    supabase
      .from("juntadas")
      .select("id, nombre, lugar, comida, anfitrion_id, inicio_programado, iniciada_en, finalizada_en")
      .eq("estado", "finalizada"),
    supabase.from("asistencias").select("juntada_id, perfil_id, entrada"),
    supabase.from("confirmaciones").select("juntada_id, perfil_id, va, hora_prometida"),
    supabase.from("consumos").select("juntada_id, monto, pagado_por"),
    supabase.from("perfiles").select("id, apodo"),
    supabase.from("fotos").select("id", { count: "exact", head: true }),
  ]);

  const delAnio = ((js as JW[]) ?? []).filter((j) => esDelAnio(j.inicio_programado, anio));
  const w = calcularWrapped(delAnio, (as as AW[]) ?? [], (cs as CW[]) ?? [], (gs as GW[]) ?? []);
  const apodo = (p: Persona | null) => (p ? ((ps ?? []).find((x) => x.id === p.id)?.apodo ?? "?") : "Nadie todavía");
  const minutos = (m: number) => (m <= 0 ? `${Math.abs(m)} min antes` : `${m} min tarde`);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl bg-gradient-to-br from-acento via-lime-300 to-amber-300 p-6 text-black">
        <p className="text-sm font-semibold uppercase tracking-widest">Malaria Wrapped</p>
        <p className="text-6xl font-black leading-none">{anio}</p>
        <p className="mt-3 text-lg font-bold">
          {w.juntadas} {w.juntadas === 1 ? "juntada" : "juntadas"} · {w.horas.toLocaleString("es-AR")} horas juntos
        </p>
        {w.juntadas === 0 && <p className="mt-1 text-sm">Se va llenando con cada juntada que termina.</p>}
      </div>

      <Tarjeta emoji="🏆" titulo="El que nunca falta">
        {w.asistentes.length ? (
          <ol className="flex flex-col gap-1">
            {w.asistentes.slice(0, 3).map((p, i) => (
              <li key={p.id} className="flex justify-between">
                <span>
                  {["🥇", "🥈", "🥉"][i]} {apodo(p)}
                </span>
                <b>
                  {p.valor} {p.valor === 1 ? "juntada" : "juntadas"}
                </b>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-texto-suave">Nadie todavía</p>
        )}
      </Tarjeta>

      <div className="grid grid-cols-2 gap-3">
        <Mini emoji="⏰" titulo="El más puntual" nombre={apodo(w.puntual)} dato={w.puntual ? minutos(w.puntual.valor) : "—"} />
        <Mini emoji="🐢" titulo="El tardón" nombre={apodo(w.tardon)} dato={w.tardon ? minutos(w.tardon.valor) : "—"} />
        <Mini
          emoji="👻"
          titulo="El fantasma"
          nombre={apodo(w.fantasma)}
          dato={w.fantasma ? `${w.fantasma.valor} ${w.fantasma.valor === 1 ? "plantón" : "plantones"}` : "—"}
        />
        <Mini
          emoji="🏠"
          titulo="El anfitrión"
          nombre={apodo(w.anfitrion)}
          dato={w.anfitrion ? `armó ${w.anfitrion.valor}` : "—"}
        />
        <Mini emoji="🏦" titulo="El banco" nombre={apodo(w.banco)} dato={w.banco ? pesos(w.banco.valor) : "—"} />
        <Mini emoji="💸" titulo="Gastamos" nombre={pesos(w.gastoTotal)} dato="en total" />
        <Mini
          emoji="🍽️"
          titulo="La comida del año"
          nombre={w.comida?.texto ?? "—"}
          dato={w.comida ? `${w.comida.veces} ${w.comida.veces === 1 ? "vez" : "veces"}` : "Cargala al proponer"}
        />
        <Mini
          emoji="📍"
          titulo="El lugar del año"
          nombre={w.lugar?.texto ?? "—"}
          dato={w.lugar ? `${w.lugar.veces} ${w.lugar.veces === 1 ? "vez" : "veces"}` : "—"}
        />
      </div>

      <Tarjeta emoji="🌙" titulo="La juntada más larga">
        {w.masLarga ? (
          <p>
            <b>{w.masLarga.nombre}</b> · {w.masLarga.horas.toLocaleString("es-AR")} h
          </p>
        ) : (
          <p className="text-texto-suave">Todavía ninguna</p>
        )}
      </Tarjeta>

      <p className="text-center text-xs text-texto-suave">📸 {fotos ?? 0} fotos subidas en total</p>

      <div className="flex justify-center gap-4 text-sm">
        {anio > 2026 && (
          <Link href={`/wrapped?anio=${anio - 1}`} className="text-texto-suave underline">
            Ver {anio - 1}
          </Link>
        )}
        {anio < anioActual && (
          <Link href={`/wrapped?anio=${anio + 1}`} className="text-texto-suave underline">
            Ver {anio + 1}
          </Link>
        )}
      </div>
    </div>
  );
}

function Tarjeta({ emoji, titulo, children }: { emoji: string; titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-borde bg-superficie p-4">
      <p className="mb-2 text-sm font-semibold text-texto-suave">
        {emoji} {titulo}
      </p>
      {children}
    </div>
  );
}

function Mini({ emoji, titulo, nombre, dato }: { emoji: string; titulo: string; nombre: string; dato: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-borde bg-superficie p-3">
      <p className="text-xs text-texto-suave">
        {emoji} {titulo}
      </p>
      <p className="truncate text-lg font-bold">{nombre}</p>
      <p className="text-xs text-texto-suave">{dato}</p>
    </div>
  );
}
