import { Suspense } from "react";
import { usuarioActual } from "@/lib/sesion";
import { ListaGrupo, type Miembro } from "@/components/grupo/ListaGrupo";
import { FechasGrupo } from "@/components/fechas/FechasGrupo";
import type { FechaEspecial } from "@/lib/fechas";

export default function GrupoPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Grupo</h1>
      <Suspense
        fallback={
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-superficie" />
            ))}
          </div>
        }
      >
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const { supabase, uid, esAdmin } = await usuarioActual();

  const [{ data: perfiles }, { data: asistencias }, { data: fechas }] = await Promise.all([
    supabase.from("perfiles").select("id, apodo, rol, activo, creado_en").order("apodo"),
    supabase.from("asistencias").select("perfil_id, juntada_id, salida"),
    supabase.from("fechas_especiales").select("id, nombre, dia, mes, desde_anio"),
  ]);

  const juntadasPorPerfil = new Map<string, Set<string>>();
  const presentes = new Set<string>();
  for (const a of asistencias ?? []) {
    if (!juntadasPorPerfil.has(a.perfil_id)) juntadasPorPerfil.set(a.perfil_id, new Set());
    juntadasPorPerfil.get(a.perfil_id)!.add(a.juntada_id);
    if (!a.salida) presentes.add(a.perfil_id);
  }

  const miembros: Miembro[] = (perfiles ?? []).map((p) => ({
    id: p.id,
    apodo: p.apodo,
    rol: p.rol,
    activo: p.activo,
    creado_en: p.creado_en,
    juntadas: juntadasPorPerfil.get(p.id)?.size ?? 0,
    presente: presentes.has(p.id),
  }));

  return (
    <div className="flex flex-col gap-8">
      <FechasGrupo fechas={(fechas as FechaEspecial[]) ?? []} esAdmin={esAdmin} />
      <ListaGrupo miembros={miembros} uid={uid ?? ""} esAdmin={esAdmin} />
    </div>
  );
}
