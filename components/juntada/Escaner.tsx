"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Scanner, type IDetectedBarcode, type IScannerError } from "@yudiel/react-qr-scanner";
import { ArrowLeft, CameraOff, LogIn, LogOut, RotateCcw, TriangleAlert } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { PREFIJO_QR } from "@/lib/constantes";
import { mensajeError } from "@/lib/errores";
import { duracion, hora } from "@/lib/tiempo";
import type { ResultadoEscaneo } from "@/lib/tipos";

type Feedback =
  | { tipo: "entrada" | "salida" | "ignorado"; apodo: string; detalle: string }
  | { tipo: "error"; apodo?: undefined; detalle: string };

type Historial = { id: number; tipo: "entrada" | "salida"; apodo: string; cuando: string; detalle: string };

const PAUSA_TRAS_LECTURA_MS = 1800; // tiempo que se muestra el cartel antes de volver a leer
const MISMO_QR_IGNORAR_MS = 5000; // evita releer el mismo QR que sigue frente a la cámara

const ESTILO: Record<Feedback["tipo"], string> = {
  entrada: "bg-acento text-black",
  salida: "bg-amber-400 text-black",
  ignorado: "bg-zinc-600 text-white",
  error: "bg-red-500 text-white",
};

export function Escaner({ juntadaId, nombre }: { juntadaId: string; nombre: string }) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [pausado, setPausado] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [camaraFrontal, setCamaraFrontal] = useState(false);
  const ultimos = useRef(new Map<string, number>());
  const procesando = useRef(false);

  function mostrar(f: Feedback) {
    setFeedback(f);
    if ("vibrate" in navigator) navigator.vibrate(f.tipo === "error" ? [80, 60, 80] : f.tipo === "ignorado" ? 30 : 120);
    setTimeout(() => {
      setFeedback(null);
      setPausado(false);
      procesando.current = false;
    }, PAUSA_TRAS_LECTURA_MS);
  }

  async function alLeer(codigos: IDetectedBarcode[]) {
    const valor = codigos[0]?.rawValue;
    if (!valor || procesando.current) return;

    const ahora = Date.now();
    if (ahora - (ultimos.current.get(valor) ?? 0) < MISMO_QR_IGNORAR_MS) return;
    ultimos.current.set(valor, ahora);

    procesando.current = true;
    setPausado(true);

    if (!valor.startsWith(PREFIJO_QR)) {
      mostrar({ tipo: "error", detalle: "Ese QR no es de la app." });
      return;
    }

    const token = valor.slice(PREFIJO_QR.length);
    const { data, error } = await supabase.rpc("registrar_escaneo", { p_juntada_id: juntadaId, p_token: token });
    const r = (data as ResultadoEscaneo[] | null)?.[0];

    if (error || !r) {
      mostrar({ tipo: "error", detalle: mensajeError(error) });
      return;
    }

    if (r.r_accion === "ignorado") {
      mostrar({ tipo: "ignorado", apodo: r.r_apodo, detalle: "Recién escaneado. Esperá un minuto." });
      return;
    }

    const detalle =
      r.r_accion === "entrada" ? `Entró ${hora(new Date().toISOString())}` : `Se quedó ${duracion(r.r_duracion_min)}`;
    mostrar({ tipo: r.r_accion, apodo: r.r_apodo, detalle });
    setHistorial((h) =>
      [
        {
          id: ahora,
          tipo: r.r_accion as "entrada" | "salida",
          apodo: r.r_apodo,
          cuando: new Date().toISOString(),
          detalle,
        },
        ...h,
      ].slice(0, 15),
    );
  }

  function alFallar(e: IScannerError) {
    const msj: Partial<Record<IScannerError["kind"], string>> = {
      "permission-denied": "No diste permiso para usar la cámara. Habilitalo en los ajustes del navegador.",
      "no-camera": "No encontramos una cámara.",
      "in-use": "La cámara la está usando otra app.",
      "insecure-context": "La cámara solo funciona con https.",
    };
    setErrorCamara(msj[e.kind] ?? "No pudimos abrir la cámara.");
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex items-center justify-between">
        <Link
          href={`/juntada/${juntadaId}`}
          className="-ml-2 flex items-center gap-1 rounded-full p-2 text-texto-suave"
        >
          <ArrowLeft className="size-5" /> <span className="max-w-[12rem] truncate">{nombre}</span>
        </Link>
        <button
          onClick={() => setCamaraFrontal((v) => !v)}
          className="flex items-center gap-1 rounded-full border border-borde px-3 py-1.5 text-xs text-texto-suave"
        >
          <RotateCcw className="size-3.5" /> {camaraFrontal ? "Frontal" : "Trasera"}
        </button>
      </div>

      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-borde bg-black">
        {errorCamara ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-texto-suave">
            <CameraOff className="size-10" />
            <p>{errorCamara}</p>
            <button onClick={() => setErrorCamara(null)} className="text-acento underline">
              Reintentar
            </button>
          </div>
        ) : (
          <Scanner
            key={camaraFrontal ? "user" : "environment"}
            onScan={alLeer}
            onError={alFallar}
            paused={pausado}
            formats={["qr_code"]}
            allowMultiple
            scanDelay={500}
            sound={false}
            constraints={{ facingMode: camaraFrontal ? "user" : "environment" }}
            components={{ finder: true, torch: true, zoom: false, onOff: false }}
            styles={{ container: { width: "100%", height: "100%" }, video: { objectFit: "cover" } }}
          />
        )}

        {feedback && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center ${ESTILO[feedback.tipo]}`}
          >
            {feedback.tipo === "entrada" && <LogIn className="size-14" />}
            {feedback.tipo === "salida" && <LogOut className="size-14" />}
            {(feedback.tipo === "error" || feedback.tipo === "ignorado") && <TriangleAlert className="size-14" />}
            <p className="text-sm font-semibold uppercase tracking-widest">
              {feedback.tipo === "entrada"
                ? "Llegó"
                : feedback.tipo === "salida"
                  ? "Se fue"
                  : feedback.tipo === "ignorado"
                    ? "Repetido"
                    : "Error"}
            </p>
            {feedback.apodo && <p className="text-4xl font-black">{feedback.apodo}</p>}
            <p className="text-lg">{feedback.detalle}</p>
          </div>
        )}
      </div>

      <p className="text-center text-sm text-texto-suave">Primer escaneo = llegada · segundo = salida</p>

      {historial.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">Últimos escaneos</h2>
          {historial.map((h) => (
            <div key={h.id} className="flex items-center gap-3 rounded-xl bg-superficie px-3 py-2">
              {h.tipo === "entrada" ? (
                <LogIn className="size-4 text-acento" />
              ) : (
                <LogOut className="size-4 text-amber-400" />
              )}
              <span className="flex-1 font-medium">{h.apodo}</span>
              <span className="text-sm text-texto-suave">{h.detalle}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
