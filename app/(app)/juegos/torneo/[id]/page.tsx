import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { usuarioActual } from "@/lib/sesion";
import { ModoJuego } from "@/components/juegos/ModoJuego";

// Cargar el resultado de un juego que no se juega en el celular: se marcan los puestos y suman puntos.
export default function TorneoJuegoPage({ params }: PageProps<"/juegos/torneo/[id]">) {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <Link href="/juegos" className="-ml-2 w-fit rounded-full p-2 text-texto-suave">
        <ArrowLeft className="size-5" />
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-superficie" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await usuarioActual();
  const [{ data: juego }, { data: activas }, { data: perfiles }] = await Promise.all([
    supabase.from("juegos").select("id, nombre, emoji").eq("id", Number(id)).maybeSingle(),
    supabase.from("juntadas").select("id, nombre").eq("estado", "activa").limit(1),
    supabase.from("perfiles").select("id, apodo").eq("activo", true).eq("oculto", false).order("apodo"),
  ]);
  if (!juego) notFound();
  if (juego.nombre.toLowerCase() === "bid womens") redirect("/juegos/bid");
  const activa = activas?.[0];
  let vinieron = new Set<string>();
  if (activa) {
    const { data: asis } = await supabase.from("asistencias").select("perfil_id").eq("juntada_id", activa.id);
    vinieron = new Set((asis ?? []).map((a) => a.perfil_id));
  }
  return (
    <>
      <h1 className="text-2xl font-bold">
        {juego.emoji} {juego.nombre}
      </h1>
      <p className="-mt-2 text-xs text-texto-suave">
        {activa ? `Queda cargado en ${activa.nombre}.` : "No hay juntada en curso: se guarda suelto."}
      </p>
      <ModoJuego
        juego={juego.nombre}
        juntadaId={activa?.id ?? null}
        perfiles={[...(perfiles ?? [])].sort((a, b) => Number(vinieron.has(b.id)) - Number(vinieron.has(a.id)))}
      />
    </>
  );
}
