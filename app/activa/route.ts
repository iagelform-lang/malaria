import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

// Link fijo para el grupo de WhatsApp: /activa → la juntada en curso (o el inicio si no hay)
export async function GET(request: NextRequest) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("juntadas").select("id").eq("estado", "activa").maybeSingle();
  const destino = data ? `/juntada/${data.id}` : "/";
  return NextResponse.redirect(new URL(destino, request.url));
}
