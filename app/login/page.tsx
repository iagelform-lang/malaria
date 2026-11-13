"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";

type Paso = "email" | "codigo";

const LARGO_CODIGO = 6;

export default function LoginPage() {
  const router = useRouter();
  const supabase = crearClienteNavegador();

  const [paso, setPaso] = useState<Paso>("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setCargando(false);
    if (error) {
      setError(
        error.status === 429
          ? "Pediste muchos códigos seguidos. Esperá un minuto."
          : "No pudimos mandar el código. Revisá el mail.",
      );
      return;
    }
    setPaso("codigo");
  }

  async function verificarCodigo(e: React.FormEvent) {
    e.preventDefault();
    if (codigo.length !== LARGO_CODIGO) return;
    setError(null);
    setCargando(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: codigo,
      type: "email",
    });
    if (error) {
      setCargando(false);
      setError("Código incorrecto o vencido.");
      return;
    }
    const volver = new URLSearchParams(window.location.search).get("volver");
    router.replace(volver && volver.startsWith("/") ? volver : "/");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 pt-seguro pb-seguro">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/grupo.jpg"
            alt="El grupo"
            className="w-full max-w-xs rounded-2xl border border-borde object-cover"
          />
          <h1 className="text-3xl font-bold tracking-tight">Malaria 3.0</h1>
          <p className="text-texto-suave">
            {paso === "email"
              ? "Entrá con tu mail. Te mandamos un código."
              : `Mandamos un código de ${LARGO_CODIGO} dígitos a ${email}`}
          </p>
        </div>

        {paso === "email" ? (
          <form onSubmit={enviarCodigo} className="flex flex-col gap-4">
            <label className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-texto-suave" />
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                inputMode="email"
                placeholder="tu@mail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-borde bg-superficie py-4 pl-12 pr-4 text-lg outline-none focus:border-acento"
              />
            </label>
            <BotonPrincipal cargando={cargando}>Mandame el código</BotonPrincipal>
          </form>
        ) : (
          <form onSubmit={verificarCodigo} className="flex flex-col gap-4">
            <input
              type="text"
              required
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={LARGO_CODIGO}
              placeholder="••••••"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border border-borde bg-superficie py-4 text-center font-mono text-3xl tracking-[0.5em] outline-none focus:border-acento"
            />
            <BotonPrincipal cargando={cargando} deshabilitado={codigo.length !== LARGO_CODIGO}>
              Entrar
            </BotonPrincipal>
            <button
              type="button"
              onClick={() => {
                setPaso("email");
                setCodigo("");
                setError(null);
              }}
              className="flex items-center justify-center gap-2 py-2 text-texto-suave"
            >
              <ArrowLeft className="size-4" /> Cambiar mail
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
      </div>
    </main>
  );
}

function BotonPrincipal({
  children,
  cargando,
  deshabilitado,
}: {
  children: React.ReactNode;
  cargando: boolean;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={cargando || deshabilitado}
      className="flex items-center justify-center gap-2 rounded-xl bg-acento py-4 text-lg font-semibold text-black transition active:scale-[0.98] disabled:opacity-50"
    >
      {cargando && <Loader2 className="size-5 animate-spin" />}
      {children}
    </button>
  );
}
