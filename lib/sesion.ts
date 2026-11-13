import { crearClienteServidor } from "@/lib/supabase/server";

/** Usuario actual + si es admin. Para Server Components. */
export async function usuarioActual() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub as string | undefined;
  if (!uid) return { supabase, uid: null, esAdmin: false };
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", uid).single();
  return { supabase, uid, esAdmin: perfil?.rol === "admin" };
}
