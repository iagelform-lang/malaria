import { Suspense } from "react";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { TarjetaPerfil } from "@/components/perfil/TarjetaPerfil";

export default function PerfilPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center gap-6 pt-4">
          <div className="h-9 w-40 animate-pulse rounded-lg bg-superficie" />
          <div className="size-[280px] animate-pulse rounded-3xl bg-superficie" />
        </div>
      }
    >
      <ContenidoPerfil />
    </Suspense>
  );
}

async function ContenidoPerfil() {
  const supabase = await crearClienteServidor();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect("/login");

  const [{ data: perfil }, { data: credencial }] = await Promise.all([
    supabase.from("perfiles").select("apodo, rol").eq("id", uid).single(),
    supabase.from("credenciales_qr").select("token").eq("perfil_id", uid).single(),
  ]);

  if (!perfil || !credencial) {
    return (
      <p className="pt-10 text-center text-texto-suave">No encontramos tu perfil. ¿Corriste la migración de la base?</p>
    );
  }

  return (
    <TarjetaPerfil
      apodo={perfil.apodo}
      esAdmin={perfil.rol === "admin"}
      email={(claims?.claims?.email as string | undefined) ?? ""}
      tokenInicial={credencial.token}
    />
  );
}
