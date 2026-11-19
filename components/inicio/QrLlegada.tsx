"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { PREFIJO_QR } from "@/lib/constantes";

/**
 * Arrancó la juntada y dijiste que ibas: el QR aparece arriba de todo en Inicio,
 * listo para que el anfitrión lo escanee. Cuando te escanean, desaparece solo.
 */
export function QrLlegada({ uid, token, nombre }: { uid: string; token: string; nombre: string }) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const router = useRouter();

  useEffect(() => {
    const canal = supabase
      .channel(`mi-llegada-${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "asistencias", filter: `perfil_id=eq.${uid}` },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, uid, router]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-acento bg-superficie p-5 text-center shadow-sm">
      <p className="text-lg font-bold">¡Arrancó {nombre}!</p>
      <p className="-mt-2 text-sm text-texto-suave">Al llegar, mostrale este QR al anfitrión</p>
      {/* fondo blanco siempre, para que la cámara lo lea bien */}
      <div className="rounded-2xl bg-white p-4">
        <QRCodeSVG value={`${PREFIJO_QR}${token}`} size={240} level="M" marginSize={0} />
      </div>
      <p className="text-xs text-texto-suave">Subí el brillo si no lo lee</p>
    </div>
  );
}
