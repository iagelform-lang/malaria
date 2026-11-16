import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usuarioActual } from "@/lib/sesion";
import { JuegoBid } from "@/components/juegos/JuegoBid";

// Bid Womens desde la pestaña Juegos: si hay una juntada en curso, los duelos quedan en esa juntada;
// si no, se guardan como partidas sueltas.
export default function BidJuegosPage() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <Link href="/juegos" className="-ml-2 w-fit rounded-full p-2 text-texto-suave">
        <ArrowLeft className="size-5" />
      </Link>
      <h1 className="text-2xl font-bold">🔨 Bid Womens</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-superficie" />}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const { supabase } = await usuarioActual();
  const [{ data: activas }, { data: perfiles }] = await Promise.all([
    supabase.from("juntadas").select("id, nombre").eq("estado", "activa").limit(1),
    supabase.from("perfiles").select("id, apodo").eq("activo", true).eq("oculto", false).order("apodo"),
  ]);
  const activa = activas?.[0];
  let vinieron = new Set<string>();
  if (activa) {
    const { data: asis } = await supabase.from("asistencias").select("perfil_id").eq("juntada_id", activa.id);
    vinieron = new Set((asis ?? []).map((a) => a.perfil_id));
  }
  return (
    <>
      <p className="-mt-2 text-xs text-texto-suave">
        {activa ? `Los duelos quedan cargados en ${activa.nombre}.` : "Los duelos se guardan como partidas sueltas."}
      </p>
      <JuegoBid
        juntadaId={activa?.id ?? null}
        perfiles={[...(perfiles ?? [])].sort((a, b) => Number(vinieron.has(b.id)) - Number(vinieron.has(a.id)))}
      />
    </>
  );
}
