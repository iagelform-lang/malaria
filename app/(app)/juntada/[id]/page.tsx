import { Suspense } from "react";
import { notFound } from "next/navigation";
import { usuarioActual } from "@/lib/sesion";
import { VistaJuntada } from "@/components/juntada/VistaJuntada";
import type { Asistencia, Confirmacion, Juntada, Perfil } from "@/lib/tipos";

export default function JuntadaPage({ params }: PageProps<"/juntada/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4 pt-2">
          <div className="h-8 w-2/3 animate-pulse rounded-lg bg-superficie" />
          <div className="h-24 animate-pulse rounded-2xl bg-superficie" />
          <div className="h-40 animate-pulse rounded-2xl bg-superficie" />
        </div>
      }
    >
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, uid, esAdmin } = await usuarioActual();

  const [{ data: juntada }, { data: perfiles }, { data: asistencias }, { data: confirmaciones }] = await Promise.all([
    supabase.from("juntadas").select("*").eq("id", id).maybeSingle(),
    supabase.from("perfiles").select("id, apodo, avatar_url, rol").eq("activo", true),
    supabase.from("asistencias").select("*").eq("juntada_id", id).order("entrada"),
    supabase.from("confirmaciones").select("*").eq("juntada_id", id),
  ]);

  if (!juntada) notFound();

  const j = juntada as Juntada;
  return (
    <VistaJuntada
      juntadaInicial={j}
      perfiles={(perfiles as Perfil[]) ?? []}
      asistenciasIniciales={(asistencias as Asistencia[]) ?? []}
      confirmacionesIniciales={(confirmaciones as Confirmacion[]) ?? []}
      uid={uid!}
      puedeGestionar={esAdmin || j.anfitrion_id === uid}
      esAdmin={esAdmin}
    />
  );
}
