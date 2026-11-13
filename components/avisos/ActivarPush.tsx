"use client";

import { useEffect, useMemo, useState } from "react";
import { BellOff, BellRing, Loader2, Smartphone } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { CLAVE_PUBLICA_PUSH, claveABytes } from "@/lib/push";

type Estado = "cargando" | "no-soportado" | "ios-sin-instalar" | "bloqueado" | "apagado" | "activado";

// Botón para recibir avisos en el celular aunque la app esté cerrada
export function ActivarPush() {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instalada =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setEstado(esIOS && !instalada ? "ios-sin-instalar" : "no-soportado");
        return;
      }
      if (Notification.permission === "denied") return setEstado("bloqueado");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setEstado(sub && Notification.permission === "granted" ? "activado" : "apagado");
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function activar() {
    setOcupado(true);
    setError(null);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueado" : "apagado");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: claveABytes(CLAVE_PUBLICA_PUSH),
        }));
      const json = sub.toJSON();
      const { error } = await supabase
        .from("push_suscripciones")
        .upsert(
          { endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
          { onConflict: "endpoint" },
        );
      if (error) throw error;
      setEstado("activado");
    } catch {
      setError("No se pudo activar. Probá de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  async function desactivar() {
    setOcupado(true);
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_suscripciones").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setOcupado(false);
    setEstado("apagado");
  }

  if (estado === "cargando") return null;

  const caja = "flex items-start gap-3 rounded-2xl border p-4";

  if (estado === "activado")
    return (
      <div className={`${caja} border-acento/40 bg-acento/10`}>
        <BellRing className="mt-0.5 size-5 shrink-0 text-acento" />
        <div className="flex-1">
          <p className="font-semibold">Avisos al celular activados</p>
          <p className="text-sm text-texto-suave">Te llegan aunque la app esté cerrada.</p>
        </div>
        <button onClick={desactivar} disabled={ocupado} className="text-xs text-texto-suave underline">
          Apagar
        </button>
      </div>
    );

  if (estado === "ios-sin-instalar")
    return (
      <div className={`${caja} border-amber-400/50 bg-amber-400/10`}>
        <Smartphone className="mt-0.5 size-5 shrink-0 text-amber-300" />
        <p className="text-sm">
          En iPhone los avisos solo funcionan con la app instalada: en Safari tocá{" "}
          <b>Compartir → Agregar a pantalla de inicio</b>, abrila desde el ícono y volvé a esta pantalla.
        </p>
      </div>
    );

  if (estado === "no-soportado" || estado === "bloqueado")
    return (
      <div className={`${caja} border-borde bg-superficie`}>
        <BellOff className="mt-0.5 size-5 shrink-0 text-texto-suave" />
        <p className="text-sm text-texto-suave">
          {estado === "bloqueado"
            ? "Bloqueaste los avisos para esta app. Activalos desde los ajustes del navegador (permisos del sitio → Notificaciones)."
            : "Este navegador no permite avisos al celular. Probá abriendo la app desde Chrome (Android) o instalada (iPhone)."}
        </p>
      </div>
    );

  return (
    <div className={`${caja} border-acento/40 bg-superficie`}>
      <BellRing className="mt-0.5 size-5 shrink-0 text-acento" />
      <div className="flex flex-1 flex-col gap-3">
        <div>
          <p className="font-semibold">Recibí los avisos en el celular</p>
          <p className="text-sm text-texto-suave">
            Cuando alguien propone una juntada, cuando arranca y cuando termina.
          </p>
        </div>
        <button
          onClick={activar}
          disabled={ocupado}
          className="flex items-center justify-center gap-2 rounded-xl bg-acento py-3 font-semibold text-black"
        >
          {ocupado && <Loader2 className="size-4 animate-spin" />} Activar avisos
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
