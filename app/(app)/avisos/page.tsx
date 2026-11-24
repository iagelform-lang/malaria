import { Suspense } from "react";
import Link from "next/link";
import { Bell, Star, CalendarHeart, CalendarPlus, Flag, Play, Vote, BellRing, CalendarClock, CalendarRange, Gift, Hourglass, Timer } from "lucide-react";
import { usuarioActual } from "@/lib/sesion";
import { fechaYHora } from "@/lib/tiempo";
import { ActivarPush } from "@/components/avisos/ActivarPush";
import { MarcarLeidas } from "@/components/avisos/MarcarLeidas";
import { ElegirAvisos } from "@/components/avisos/ElegirAvisos";

type Aviso = {
  id: number;
  tipo: "creada" | "iniciada" | "finalizada" | "evento" | "voto" | "recordatorio" | "cambio" | "llegada" | "sondeo" | "wrapped" | "cuenta" | "puntos" | "castigo";
  titulo: string;
  cuerpo: string;
  url: string;
  leida: boolean;
  creado_en: string;
};

const ICONO = { creada: CalendarPlus, iniciada: Play, finalizada: Flag, evento: CalendarHeart, voto: Vote, recordatorio: BellRing, cambio: CalendarClock, llegada: Timer, sondeo: CalendarRange, wrapped: Gift, cuenta: Hourglass, puntos: Star, castigo: Vote };

export default function AvisosPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="pr-12 text-2xl font-bold">Avisos</h1>
      <ActivarPush />
      <Suspense fallback={null}>
        <Preferencias />
      </Suspense>
      <Suspense
        fallback={
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-superficie" />
            ))}
          </div>
        }
      >
        <Lista />
      </Suspense>
    </div>
  );
}

async function Preferencias() {
  const { uid } = await usuarioActual();
  return uid ? <ElegirAvisos uid={uid} /> : null;
}

async function Lista() {
  const { supabase } = await usuarioActual();
  const { data } = await supabase
    .from("notificaciones")
    .select("id, tipo, titulo, cuerpo, url, leida, creado_en")
    .order("creado_en", { ascending: false })
    .limit(50);
  const avisos = (data as Aviso[]) ?? [];

  if (!avisos.length)
    return (
      <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-sm text-texto-suave">
        Todavía no hay avisos. Te avisamos cuando alguien proponga una juntada, cuando arranque y cuando termine.
      </p>
    );

  return (
    <div className="flex flex-col gap-2">
      <MarcarLeidas hayNoLeidas={avisos.some((a) => !a.leida)} />
      {avisos.map((a) => {
        // un tipo de aviso nuevo sin ícono propio no rompe la pantalla
        const Icono = ICONO[a.tipo] ?? Bell;
        return (
          <Link
            key={a.id}
            href={a.url}
            className={`flex items-start gap-3 rounded-2xl p-3 ${a.leida ? "bg-superficie/60" : "bg-superficie ring-1 ring-acento/40"}`}
          >
            <Icono className={`mt-0.5 size-5 shrink-0 ${a.leida ? "text-texto-suave" : "text-acento"}`} />
            <div className="min-w-0 flex-1">
              <p className={a.leida ? "text-texto-suave" : "font-semibold"}>{a.titulo}</p>
              <p className="text-sm text-texto-suave">{a.cuerpo}</p>
              <p className="mt-1 text-[11px] text-texto-suave">{fechaYHora(a.creado_en)}</p>
            </div>
            {!a.leida && <span className="mt-2 size-2 shrink-0 rounded-full bg-acento" />}
          </Link>
        );
      })}
    </div>
  );
}
