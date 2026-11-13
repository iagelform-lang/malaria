"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { setNoLeidos } from "@/lib/avisosStore";

type Aviso = { id: number; titulo: string; cuerpo: string; url: string };

// Montado en todas las pantallas: registra el service worker, mantiene el contador de no leídos
// y muestra un cartel arriba cuando llega un aviso con la app abierta.
export function AvisosEnVivo() {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const router = useRouter();
  const [cartel, setCartel] = useState<Aviso | null>(null);

  const contar = useCallback(async () => {
    const { count } = await supabase
      .from("notificaciones")
      .select("id", { count: "exact", head: true })
      .eq("leida", false);
    setNoLeidos(count ?? 0);
  }, [supabase]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

    let canal: ReturnType<typeof supabase.channel> | null = null;
    const t = setTimeout(contar, 0);

    supabase.auth.getClaims().then(({ data }) => {
      const uid = data?.claims?.sub;
      if (!uid) return;
      canal = supabase
        .channel(`avisos-${uid}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notificaciones", filter: `perfil_id=eq.${uid}` },
          (payload) => {
            setCartel(payload.new as Aviso);
            contar();
            router.refresh();
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "notificaciones", filter: `perfil_id=eq.${uid}` },
          contar,
        )
        .subscribe();
    });

    const alVolver = () => document.visibilityState === "visible" && contar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", alVolver);
      if (canal) supabase.removeChannel(canal);
    };
  }, [supabase, contar, router]);

  // el cartel se va solo a los 8 segundos
  useEffect(() => {
    if (!cartel) return;
    const t = setTimeout(() => setCartel(null), 8000);
    return () => clearTimeout(t);
  }, [cartel]);

  if (!cartel) return null;
  return (
    <div className="pt-seguro fixed inset-x-0 top-0 z-50 px-3">
      <div className="mx-auto mt-2 flex max-w-md items-start gap-3 rounded-2xl border border-acento/40 bg-superficie p-3 shadow-xl shadow-black/50">
        <Bell className="mt-0.5 size-5 shrink-0 text-acento" />
        <Link href={cartel.url} onClick={() => setCartel(null)} className="min-w-0 flex-1">
          <p className="font-semibold">{cartel.titulo}</p>
          <p className="text-sm text-texto-suave">{cartel.cuerpo}</p>
        </Link>
        <button onClick={() => setCartel(null)} aria-label="Cerrar">
          <X className="size-4 text-texto-suave" />
        </button>
      </div>
    </div>
  );
}
