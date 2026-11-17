import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { usuarioActual } from "@/lib/sesion";
import type { Perfil } from "@/lib/tipos";
import { SeccionConsumos } from "@/components/juntada/SeccionConsumos";
import { FormCuenta } from "@/components/gastos/FormCuenta";

export default function CuentaPage(props: PageProps<"/gastos/[id]">) {
  return (
    <div className="flex flex-col gap-6 pt-2">
      <Suspense
        fallback={
          <div className="flex flex-col gap-3">
            <div className="h-16 animate-pulse rounded-2xl bg-superficie" />
            <div className="h-40 animate-pulse rounded-2xl bg-superficie" />
          </div>
        }
      >
        <Contenido params={props.params} />
      </Suspense>
    </div>
  );
}

async function Contenido({ params }: { params: PageProps<"/gastos/[id]">["params"] }) {
  const { id } = await params;
  const { supabase, uid, esAdmin } = await usuarioActual();
  const [{ data: cuenta }, { data: perfs }] = await Promise.all([
    supabase.from("cuentas").select("id, nombre, emoji, miembros, creado_por").eq("id", id).maybeSingle(),
    supabase.from("perfiles").select("id, apodo, avatar_url, rol, alias, activo, oculto"),
  ]);
  if (!cuenta) notFound();
  const perfiles = (perfs ?? []) as (Perfil & { activo: boolean; oculto: boolean })[];
  const visibles = perfiles.filter((p) => p.activo && !p.oculto);
  const gestiona = esAdmin || cuenta.creado_por === uid;
  const soyMiembro = (cuenta.miembros as string[]).includes(uid!);

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between pr-12">
          <Link href="/gastos" className="-ml-2 rounded-full p-2 text-texto-suave">
            <ArrowLeft className="size-5" />
          </Link>
        </div>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-3xl font-bold leading-tight">
            {cuenta.emoji} {cuenta.nombre}
          </h1>
          {(gestiona || soyMiembro) && (
            <FormCuenta
              perfiles={visibles}
              uid={uid!}
              cuenta={{ id: cuenta.id, nombre: cuenta.nombre, emoji: cuenta.emoji, miembros: cuenta.miembros }}
              puedeBorrar={gestiona}
            />
          )}
        </div>
        <p className="text-sm text-texto-suave">
          {(cuenta.miembros as string[]).map((m) => perfiles.find((p) => p.id === m)?.apodo ?? "?").join(", ")}
        </p>
      </div>

      <SeccionConsumos
        cuentaId={cuenta.id}
        uid={uid!}
        puedeGestionar={gestiona}
        perfiles={perfiles}
        idsQueVinieron={cuenta.miembros as string[]}
      />
    </>
  );
}
