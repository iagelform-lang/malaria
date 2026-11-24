"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Undo2 } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { pesos, type Deuda } from "@/lib/cuentas";
import { mensajeError } from "@/lib/errores";
import { CopiarAlias } from "@/components/juntada/CopiarAlias";

type PerfilS = { id: string; apodo: string; alias: string | null };
type PagoG = { id: number; de_perfil: string; a_perfil: string; monto: number; creado_en: string };

/** Quién le debe a quién sumando todo, con botón para marcar que ya se pagó */
export function SaldoGeneral({
  deudas,
  perfiles,
  uid,
  esAdmin,
  pagosGenerales,
}: {
  deudas: Deuda[];
  perfiles: PerfilS[];
  uid: string;
  esAdmin: boolean;
  pagosGenerales: PagoG[];
}) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // mientras la lista se actualiza, nada se puede volver a tocar (antes un doble toque pagaba dos veces)
  const [actualizando, iniciar] = useTransition();
  // deudas ya saldadas que se esconden al instante, hasta que llegue la lista nueva
  const [hechas, setHechas] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- llegó la lista nueva: ya no hace falta esconder nada
    setHechas([]);
  }, [deudas]);
  const trabado = ocupado !== null || actualizando;
  const perfil = (id: string) => perfiles.find((p) => p.id === id);
  const apodo = (id: string) => perfil(id)?.apodo ?? "?";
  const puede = (de: string, a: string) => esAdmin || uid === de || uid === a;

  async function correr(clave: string, fn: () => PromiseLike<{ error: { message?: string } | null }>, ok: string) {
    if (trabado) return;
    setOcupado(clave);
    setAviso(null);
    const { error } = await fn();
    if (!error) setHechas((h) => [...h, clave]);
    setOcupado(null);
    setAviso(error ? mensajeError(error) : ok);
    if (!error) iniciar(() => router.refresh());
  }

  // primero lo que me toca a mí
  const ordenadas = deudas.filter((d) => !hechas.includes(`${d.de}-${d.a}`)).sort(
    (x, y) => Number(y.de === uid || y.a === uid) - Number(x.de === uid || x.a === uid),
  );

  return (
    <div className="flex flex-col gap-2">
      {aviso && <p className="rounded-xl border border-borde bg-superficie p-3 text-sm">{aviso}</p>}
      {ordenadas.length === 0 ? (
        <p className="rounded-2xl border border-acento/30 bg-acento/5 p-4 text-center text-sm text-acento">
          ✓ Cuentas claras: nadie le debe a nadie.
        </p>
      ) : (
        ordenadas.map((d) => {
          const clave = `${d.de}-${d.a}`;
          const mia = d.de === uid || d.a === uid;
          return (
            <div
              key={clave}
              className={`flex items-center gap-3 rounded-2xl p-3 text-sm ${
                mia ? "bg-acento/10 ring-1 ring-acento/40" : "bg-superficie"
              }`}
            >
              <div className="flex flex-1 flex-col gap-1">
                <p>
                  <b>{d.de === uid ? "Vos" : apodo(d.de)}</b> le {d.de === uid ? "debés" : "debe"}{" "}
                  <b>{pesos(d.monto)}</b> a <b>{d.a === uid ? "vos" : apodo(d.a)}</b>
                </p>
                {perfil(d.a)?.alias && <CopiarAlias alias={perfil(d.a)!.alias!} />}
              </div>
              {puede(d.de, d.a) && (
                <button
                  disabled={trabado}
                  onClick={() =>
                    correr(
                      clave,
                      () => supabase.from("pagos").insert({ de_perfil: d.de, a_perfil: d.a, monto: d.monto }),
                      `Listo: ${apodo(d.de)} le pagó ${pesos(d.monto)} a ${apodo(d.a)}.`,
                    )
                  }
                  className="flex items-center gap-1 rounded-lg bg-acento px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {ocupado === clave ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}{" "}
                  Saldado
                </button>
              )}
            </div>
          );
        })
      )}

      {pagosGenerales.length > 0 && (
        <details className="rounded-2xl border border-borde p-3 text-xs text-texto-suave">
          <summary className="cursor-pointer">Pagos registrados ({pagosGenerales.length})</summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {pagosGenerales.slice(0, 30).map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="flex-1">
                  {apodo(p.de_perfil)} → {apodo(p.a_perfil)} · {pesos(p.monto)} ·{" "}
                  {new Date(p.creado_en).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                </span>
                {puede(p.de_perfil, p.a_perfil) && (
                  <button
                    disabled={trabado}
                    onClick={() =>
                      correr(`p${p.id}`, () => supabase.from("pagos").delete().eq("id", p.id), "Pago deshecho.")
                    }
                    className="flex items-center gap-1"
                  >
                    <Undo2 className="size-3" /> Deshacer
                  </button>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
