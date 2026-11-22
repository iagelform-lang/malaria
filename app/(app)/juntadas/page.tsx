import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, ChevronRight, Clock, Users } from "lucide-react";
import { usuarioActual } from "@/lib/sesion";
import { fechaYHora } from "@/lib/tiempo";

/** Todas las juntadas que ya pasaron, con cuántos fueron y cuántas fotos tienen */
export default function JuntadasAnterioresPage() {
  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center gap-2 pr-12">
        <Link href="/" className="-ml-2 rounded-full p-2 text-texto-suave" aria-label="Volver">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold">Juntadas anteriores</h1>
      </div>
      <Suspense
        fallback={
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-superficie" />
            ))}
          </div>
        }
      >
        <Lista />
      </Suspense>
    </div>
  );
}

type Fila = {
  id: string;
  nombre: string;
  inicio_programado: string;
  asistencias: { perfil_id: string }[];
  fotos: { count: number }[];
};

async function Lista() {
  const { supabase } = await usuarioActual();
  const { data } = await supabase
    .from("juntadas")
    .select("id, nombre, inicio_programado, asistencias(perfil_id), fotos(count)")
    .eq("estado", "finalizada")
    .order("inicio_programado", { ascending: false });
  const juntadas = (data ?? []) as Fila[];

  if (juntadas.length === 0)
    return <p className="rounded-2xl bg-superficie p-6 text-center text-texto-suave">Todavía no terminó ninguna juntada.</p>;

  return (
    <div className="flex flex-col gap-2">
      {juntadas.map((j) => {
        const fueron = new Set(j.asistencias.map((a) => a.perfil_id)).size;
        const fotos = j.fotos[0]?.count ?? 0;
        return (
          <Link
            key={j.id}
            href={fotos > 0 ? `/juntada/${j.id}?solapa=fotos` : `/juntada/${j.id}`}
            className="flex items-center gap-3 rounded-2xl border border-borde bg-superficie p-4 active:scale-[0.99]"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{j.nombre}</p>
              <p className="flex items-center gap-1 text-sm text-texto-suave">
                <Clock className="size-3.5" /> {fechaYHora(j.inicio_programado)}
              </p>
              <p className="flex items-center gap-3 text-sm text-texto-suave">
                <span className="flex items-center gap-1">
                  <Users className="size-3.5" /> fueron {fueron}
                </span>
                {fotos > 0 && (
                  <span className="flex items-center gap-1 font-semibold text-acento">
                    <Camera className="size-3.5" /> {fotos} {fotos === 1 ? "foto" : "fotos"}
                  </span>
                )}
              </p>
            </div>
            <ChevronRight className="size-5 text-texto-suave" />
          </Link>
        );
      })}
    </div>
  );
}
