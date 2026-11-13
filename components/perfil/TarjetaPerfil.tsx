"use client";

import { useState, useTransition } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, LogOut, Pencil, RefreshCw, ShieldCheck, X } from "lucide-react";
import { PREFIJO_QR } from "@/lib/constantes";
import { cambiarApodo, cerrarSesion, regenerarQR } from "@/app/(app)/perfil/acciones";

type Props = {
  apodo: string;
  esAdmin: boolean;
  email: string;
  tokenInicial: string;
};

export function TarjetaPerfil({ apodo, esAdmin, email, tokenInicial }: Props) {
  const [token, setToken] = useState(tokenInicial);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(apodo);
  const [confirmarRegenerar, setConfirmarRegenerar] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function guardarApodo() {
    iniciar(async () => {
      const r = await cambiarApodo(borrador);
      if ("error" in r && r.error) setMensaje(r.error);
      else {
        setEditando(false);
        setMensaje(null);
      }
    });
  }

  function regenerar() {
    iniciar(async () => {
      const r = await regenerarQR();
      setConfirmarRegenerar(false);
      if ("token" in r && r.token) {
        setToken(r.token);
        setMensaje("QR nuevo generado. El anterior ya no sirve.");
      } else setMensaje(r.error ?? "Error");
    });
  }

  return (
    <div className="flex flex-col items-center gap-6 pt-4">
      {/* Apodo */}
      <div className="flex w-full flex-col items-center gap-1">
        {editando ? (
          <div className="flex w-full items-center gap-2">
            <input
              autoFocus
              maxLength={24}
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              className="flex-1 rounded-xl border border-borde bg-superficie px-4 py-3 text-xl font-semibold outline-none focus:border-acento"
            />
            <button onClick={guardarApodo} disabled={pendiente} className="rounded-xl bg-acento p-3 text-black">
              <Check className="size-5" />
            </button>
            <button
              onClick={() => {
                setEditando(false);
                setBorrador(apodo);
              }}
              className="rounded-xl border border-borde p-3"
            >
              <X className="size-5" />
            </button>
          </div>
        ) : (
          <button onClick={() => setEditando(true)} className="flex items-center gap-2">
            <span className="text-3xl font-bold">{apodo}</span>
            <Pencil className="size-4 text-texto-suave" />
          </button>
        )}
        <p className="text-sm text-texto-suave">{email}</p>
        {esAdmin && (
          <span className="mt-1 flex items-center gap-1 rounded-full bg-acento/15 px-3 py-1 text-xs font-medium text-acento">
            <ShieldCheck className="size-3.5" /> Admin
          </span>
        )}
      </div>

      {/* QR: fondo blanco siempre, para que la cámara lo lea bien aun con poca luz */}
      <div className="rounded-3xl bg-white p-5 shadow-lg shadow-acento/10">
        <QRCodeSVG value={`${PREFIJO_QR}${token}`} size={240} level="M" marginSize={0} />
      </div>
      <p className="max-w-xs text-center text-sm text-texto-suave">
        Mostrale este QR al anfitrión al llegar y al irte. Subí el brillo si no lo lee.
      </p>

      {/* Regenerar (confirmación en dos toques, sin popups) */}
      {confirmarRegenerar ? (
        <div className="flex w-full flex-col gap-2 rounded-2xl border border-borde bg-superficie p-4">
          <p className="text-sm">¿Generar un QR nuevo? El actual deja de funcionar.</p>
          <div className="flex gap-2">
            <button
              onClick={regenerar}
              disabled={pendiente}
              className="flex-1 rounded-xl bg-red-500/90 py-3 font-semibold text-white"
            >
              Sí, regenerar
            </button>
            <button onClick={() => setConfirmarRegenerar(false)} className="flex-1 rounded-xl border border-borde py-3">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmarRegenerar(true)}
          className="flex items-center gap-2 text-sm text-texto-suave"
        >
          <RefreshCw className={`size-4 ${pendiente ? "animate-spin" : ""}`} /> Regenerar mi QR
        </button>
      )}

      {mensaje && <p className="text-center text-sm text-acento">{mensaje}</p>}

      <form action={cerrarSesion} className="w-full pt-4">
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-borde py-3 text-texto-suave">
          <LogOut className="size-4" /> Cerrar sesión
        </button>
      </form>
    </div>
  );
}
