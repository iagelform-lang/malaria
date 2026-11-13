import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { usuarioActual } from "@/lib/sesion";
import { Escaner } from "@/components/juntada/Escaner";

export default function EscanearPage({ params }: PageProps<"/juntada/[id]/escanear">) {
  return (
    <Suspense fallback={<div className="mt-4 aspect-square w-full animate-pulse rounded-3xl bg-superficie" />}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, uid, esAdmin } = await usuarioActual();
  const { data: j } = await supabase
    .from("juntadas")
    .select("id, nombre, estado, anfitrion_id")
    .eq("id", id)
    .maybeSingle();
  if (!j) notFound();

  const puede = esAdmin || j.anfitrion_id === uid;
  if (!puede || j.estado !== "activa") {
    return (
      <div className="flex flex-col items-center gap-4 pt-16 text-center">
        <p className="text-texto-suave">
          {j.estado !== "activa" ? "La juntada no está en curso." : "Solo el anfitrión o un admin puede escanear."}
        </p>
        <Link href={`/juntada/${id}`} className="text-acento underline">
          Volver a la juntada
        </Link>
      </div>
    );
  }

  return <Escaner juntadaId={id} nombre={j.nombre} />;
}
