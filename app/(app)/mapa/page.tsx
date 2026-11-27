import { Suspense } from "react";
import { usuarioActual } from "@/lib/sesion";
import { MapaGrupo, type Casa, type Integrante, type UbicacionVivo } from "@/components/mapa/MapaGrupo";

export default function MapaPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Mapa</h1>
      <Suspense
        fallback={
          <div className="flex flex-col gap-3">
            <div className="h-10 animate-pulse rounded-xl bg-superficie" />
            <div className="h-[55dvh] animate-pulse rounded-2xl bg-superficie" />
          </div>
        }
      >
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const { supabase, uid } = await usuarioActual();

  const [{ data: perfiles }, { data: vivos }, { data: casas }] = await Promise.all([
    supabase.from("perfiles").select("id, apodo").eq("oculto", false).eq("activo", true).order("apodo"),
    supabase.from("ubicaciones_vivo").select("perfil_id, lat, lng, precision_m, actualizado_en"),
    supabase.from("casas").select("perfil_id, lat, lng, direccion"),
  ]);

  return (
    <MapaGrupo
      uid={uid ?? ""}
      integrantes={(perfiles as Integrante[]) ?? []}
      vivosIniciales={(vivos as UbicacionVivo[]) ?? []}
      casasIniciales={(casas as Casa[]) ?? []}
    />
  );
}
