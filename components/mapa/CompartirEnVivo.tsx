"use client";

import { useEffect, useSyncExternalStore } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { metrosEntre, quiereCompartir, setEstadoVivo, suscribirVivo } from "@/lib/mapa";

// Cada cuánto se manda como mínimo, y cuánto hay que moverse para mandar antes
const CADA_MS = 60_000;
const MOVERSE_M = 30;

/**
 * Va en el layout: mientras la app esté abierta (en cualquier pantalla) y la persona
 * haya prendido "Compartir mi ubicación en vivo", manda la ubicación a la base.
 * Con la app cerrada o el celular bloqueado el navegador no deja seguir.
 */
export function CompartirEnVivo() {
  const quiere = useSyncExternalStore(suscribirVivo, quiereCompartir, () => false);

  useEffect(() => {
    const supabase = crearClienteNavegador();
    if (!quiere) {
      setEstadoVivo("apagado");
      return;
    }
    if (!("geolocation" in navigator)) {
      setEstadoVivo("sin-gps");
      return;
    }
    setEstadoVivo("buscando");

    let ultima: { lat: number; lng: number; t: number } | null = null;
    let enviando = false;

    async function mandar(lat: number, lng: number, precision: number) {
      const ahora = Date.now();
      if (ultima && ahora - ultima.t < CADA_MS && metrosEntre(ultima, { lat, lng }) < MOVERSE_M) return;
      if (enviando) return;
      enviando = true;
      const { data } = await supabase.auth.getClaims();
      const uid = data?.claims?.sub;
      if (uid) {
        const { error } = await supabase
          .from("ubicaciones_vivo")
          .upsert({ perfil_id: uid, lat, lng, precision_m: Math.round(precision) }, { onConflict: "perfil_id" });
        if (!error) ultima = { lat, lng, t: ahora };
        setEstadoVivo(error ? "error" : "activo");
      }
      enviando = false;
    }

    const id = navigator.geolocation.watchPosition(
      (p) => void mandar(p.coords.latitude, p.coords.longitude, p.coords.accuracy),
      (e) => setEstadoVivo(e.code === e.PERMISSION_DENIED ? "sin-permiso" : "error"),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
    );

    // al volver a la app, mandar enseguida aunque no se haya movido
    const alVolver = () => {
      if (document.visibilityState === "visible") ultima = null;
    };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      navigator.geolocation.clearWatch(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [quiere]);

  return null;
}
