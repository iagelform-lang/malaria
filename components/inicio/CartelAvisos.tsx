"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, ChevronRight } from "lucide-react";

// Cartel en el inicio para los que todavía no activaron los avisos al celular.
// Desaparece solo cuando los activan (o si el navegador no los permite).
export function CartelAvisos() {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instalada =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // en iPhone sin instalar sí vale la pena avisar: instalando se pueden activar
        setMostrar(esIOS && !instalada);
        return;
      }
      if (Notification.permission === "denied") return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setMostrar(!(sub && Notification.permission === "granted"));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  if (!mostrar) return null;
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
