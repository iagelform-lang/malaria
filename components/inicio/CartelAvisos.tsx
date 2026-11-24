"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellOff, BellRing, ChevronRight } from "lucide-react";

// Cartel en el inicio para los que todavía no activaron los avisos al celular.
// Desaparece solo cuando los activan (o si el navegador no los permite).
export function CartelAvisos() {
  const [mostrar, setMostrar] = useState<false | "activar" | "bloqueados">(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instalada =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // en iPhone sin instalar sí vale la pena avisar: instalando se pueden activar
        setMostrar(esIOS && !instalada ? "activar" : false);
        return;
      }
      // los bloqueó alguna vez: el navegador no deja volver a pedirlos, hay que habilitarlos a mano
      if (Notification.permission === "denied") return setMostrar("bloqueados");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setMostrar(sub && Notification.permission === "granted" ? false : "activar");
    }, 0);
    return () => clearTimeout(t);
  }, []);

  if (!mostrar) return null;
  if (mostrar === "bloqueados")
    return (
      <div className="flex items-start gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-4">
        <BellOff className="mt-0.5 size-6 shrink-0 text-red-600" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">Tenés los avisos bloqueados</p>
          <p className="text-sm text-texto-suave">
            Te perdés las juntadas, la votación de fecha (y los puntos que se restan) y la cuenta regresiva.
          </p>
          <p className="mt-2 text-sm">
            Para habilitarlos: <b>Ajustes del celular → Apps → Malaria → Notificaciones → Permitir</b>. Si la usás
            desde el navegador, tocá el candado al lado de la dirección → Notificaciones → Permitir.
          </p>
        </div>
      </div>
    );
  return (
    <Link
      href="/avisos"
      className="flex items-center gap-3 rounded-2xl border-2 border-acento/50 bg-acento/10 p-4 active:scale-[0.99]"
    >
      <BellRing className="size-6 shrink-0 animate-pulse text-acento" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">Activá los avisos</p>
        <p className="text-sm text-texto-suave">Si no, no te enterás cuando se arma una juntada ni cuando arranca.</p>
      </div>
      <ChevronRight className="size-5 text-acento" />
    </Link>
  );
}
