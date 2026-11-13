"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { aInputLocal, desdeInputLocal } from "@/lib/tiempo";

function proximaHoraRedonda() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 2);
  return aInputLocal(d);
}

export function FormNuevaJuntada() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [lugar, setLugar] = useState("");
  const [inicio, setInicio] = useState(proximaHoraRedonda);
  const [tolerancia, setTolerancia] = useState(15);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function proponer(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    const supabase = crearClienteNavegador();
    const { data: sesion } = await supabase.auth.getClaims();
    const uid = sesion?.claims?.sub;
    const { data, error } = await supabase
      .from("juntadas")
      .insert({
        nombre: nombre.trim(),
        lugar: lugar.trim() || null,
        inicio_programado: desdeInputLocal(inicio),
        tolerancia_min: tolerancia,
        anfitrion_id: uid,
      })
      .select("id")
      .single();
    if (error || !data) {
      setGuardando(false);
      setError("No se pudo crear la juntada.");
      return;
    }
    // quien propone la juntada va: queda anotado para la hora de inicio
    const inicioIso = desdeInputLocal(inicio);
    if (new Date(inicioIso).getTime() > Date.now()) {
      await supabase
        .from("confirmaciones")
        .insert({ juntada_id: data.id, perfil_id: uid, va: true, hora_prometida: inicioIso });
    }
    router.replace(`/juntada/${data.id}`);
  }

  const estiloInput =
    "w-full rounded-xl border border-borde bg-superficie px-4 py-3 text-lg outline-none focus:border-acento";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="rounded-full p-2 -ml-2 text-texto-suave">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold">Proponer juntada</h1>
      </div>

      <form onSubmit={proponer} className="flex flex-col gap-5">
        <Campo etiqueta="¿Qué es?">
          <input
            required
            autoFocus
            maxLength={60}
            placeholder="Asado en lo de Juan"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={estiloInput}
          />
        </Campo>
        <Campo etiqueta="¿Dónde? (opcional)">
          <input
            maxLength={80}
            placeholder="Villa Crespo"
            value={lugar}
            onChange={(e) => setLugar(e.target.value)}
            className={estiloInput}
          />
        </Campo>
        <Campo etiqueta="¿Cuándo arranca?">
          <input
            required
            type="datetime-local"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className={estiloInput}
          />
        </Campo>
        <Campo etiqueta={`Tolerancia para llegar tarde: ${tolerancia} min`}>
          <input
            type="range"
            min={0}
            max={60}
            step={5}
            value={tolerancia}
            onChange={(e) => setTolerancia(Number(e.target.value))}
            className="w-full accent-[var(--acento)]"
          />
        </Campo>

        <button
          type="submit"
          disabled={guardando || !nombre.trim()}
          className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-acento py-4 text-lg font-semibold text-black active:scale-[0.98] disabled:opacity-50"
        >
          {guardando && <Loader2 className="size-5 animate-spin" />}
          Proponer
        </button>
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </form>
    </div>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-texto-suave">{etiqueta}</span>
      {children}
    </label>
  );
}
