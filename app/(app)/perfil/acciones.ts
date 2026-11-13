"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function cambiarApodo(apodo: string) {
  const limpio = apodo.trim().slice(0, 24);
  if (!limpio) return { error: "El apodo no puede estar vacío." };

  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return { error: "Sesión vencida." };

  const { error } = await supabase.from("perfiles").update({ apodo: limpio }).eq("id", uid);
  if (error) return { error: "No se pudo guardar." };

  revalidatePath("/perfil");
  return { ok: true };
}

export async function regenerarQR() {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("rotar_mi_qr");
  if (error || !data) return { error: "No se pudo regenerar el QR." };
  revalidatePath("/perfil");
  return { token: data as string };
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
