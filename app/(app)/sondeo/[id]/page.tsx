import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { usuarioActual } from "@/lib/sesion";
import { VistaSondeo, type Opcion, type Sondeo, type Voto } from "@/components/sondeo/VistaSondeo";

export default function SondeoPage({ params }: PageProps<"/sondeo/[id]">) {
  return (
    <Suspense fallback={<div className="mt-4 h-96 animate-pulse rounded-2xl bg-superficie" />}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, uid, esAdmin } = await usuarioActual();
  const [{ data: sondeo }, { data: opciones }, { data: perfiles }, { data: mayoria }] = await Promise.all([
    supabase.from("sondeos").select("*").eq("id", id).maybeSingle(),
    supabase.from("sondeo_opciones").select("id, inicio").eq("sondeo_id", id).order("inicio"),
    supabase.from("perfiles").select("id, apodo").eq("activo", true).eq("oculto", false),
    supabase.rpc("votos_para_mayoria"),
  ]);
  if (!sondeo) notFound();
  // ya se eligió la fecha: la votación vive en la juntada
  if (sondeo.estado === "cerrado" && sondeo.juntada_id) redirect(`/juntada/${sondeo.juntada_id}`);

  const ids = (opciones ?? []).map((o) => o.id);
  const { data: votos } = ids.length
    ? await supabase.from("sondeo_votos").select("opcion_id, perfil_id").in("opcion_id", ids)
    : { data: [] };

  return (
    <VistaSondeo
      sondeo={sondeo as Sondeo}
      opciones={(opciones as Opcion[]) ?? []}
      votosIniciales={(votos as Voto[]) ?? []}
      perfiles={perfiles ?? []}
      uid={uid ?? ""}
      puedeElegir={esAdmin || sondeo.creado_por === uid}
      mayoria={Number(mayoria) || 1}
    />
  );
}
