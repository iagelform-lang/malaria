import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { usuarioActual } from "@/lib/sesion";
import { JuegoBid } from "@/components/juegos/JuegoBid";

export default function BidPage({ params }: PageProps<"/juntada/[id]/bid">) {
  return (
    <Suspense fallback={<div className="mt-4 h-96 animate-pulse rounded-2xl bg-superficie" />}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await usuarioActual();
  const [{ data: juntada }, { data: perfiles }, { data: asis }] = await Promise.all([
    supabase.from("juntadas").select("id, nombre, estado").eq("id", id).maybeSingle(),
    supabase.from("perfiles").select("id, apodo").eq("activo", true).eq("oculto", false).order("apodo"),
    supabase.from("asistencias").select("perfil_id").eq("juntada_id", id),
  ]);
  if (!juntada) notFound();
  const vinieron = new Set((asis ?? []).map((a) => a.perfil_id));

  return (
    <div className="flex flex-col gap-4 pt-2">
      <Link href={`/juntada/${id}#juegos`} className="-ml-2 w-fit rounded-full p-2 text-texto-suave">
        <ArrowLeft className="size-5" />
      </Link>
      <h1 className="text-2xl font-bold">🔨 Bid Womens</h1>
      {juntada.estado !== "activa" ? (
        <p className="rounded-2xl border border-dashed border-borde p-4 text-center text-sm text-texto-suave">
          Se juega mientras la juntada está en curso.
        </p>
      ) : (
        <JuegoBid
          juntadaId={id}
          perfiles={[...(perfiles ?? [])].sort(
            (a, b) => Number(vinieron.has(b.id)) - Number(vinieron.has(a.id)),
          )}
        />
      )}
    </div>
  );
}
