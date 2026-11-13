"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, ShieldOff, UserCheck, UserX, X } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/errores";
import { fechaCorta } from "@/lib/tiempo";
import { Avatar } from "@/components/ui/Avatar";

export type Miembro = {
  id: string;
  apodo: string;
  rol: "admin" | "invitado";
  activo: boolean;
  creado_en: string;
  juntadas: number;
  presente: boolean;
};

type Accion = { perfilId: string; tipo: "hacerAdmin" | "quitarAdmin" | "desactivar" | "reactivar" };

const TEXTOS: Record<Accion["tipo"], { boton: string; confirmar: string; ok: string }> = {
  hacerAdmin: { boton: "Hacer admin", confirmar: "Sí, hacer admin", ok: "ahora es admin." },
  quitarAdmin: { boton: "Quitar admin", confirmar: "Sí, quitar admin", ok: "ya no es admin." },
  desactivar: { boton: "Desactivar", confirmar: "Sí, desactivar", ok: "fue desactivado." },
  reactivar: { boton: "Reactivar", confirmar: "Sí, reactivar", ok: "volvió al grupo." },
};

export function ListaGrupo({ miembros, uid, esAdmin }: { miembros: Miembro[]; uid: string; esAdmin: boolean }) {
  const router = useRouter();
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<Accion | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const activos = miembros.filter((m) => m.activo);
  const inactivos = miembros.filter((m) => !m.activo);

  async function ejecutar(a: Accion, apodo: string) {
    setOcupado(true);
    setAviso(null);
    const { error } =
      a.tipo === "hacerAdmin" || a.tipo === "quitarAdmin"
        ? await supabase.rpc("cambiar_rol", {
            p_perfil_id: a.perfilId,
            p_rol: a.tipo === "hacerAdmin" ? "admin" : "invitado",
          })
        : await supabase.rpc("cambiar_activo", { p_perfil_id: a.perfilId, p_activo: a.tipo === "reactivar" });
    setOcupado(false);
    setConfirmando(null);
    setAbierto(null);
    setAviso(error ? mensajeError(error) : `${apodo} ${TEXTOS[a.tipo].ok}`);
    if (!error) router.refresh();
  }

  function Fila({ m }: { m: Miembro }) {
    const esYo = m.id === uid;
    const acciones: Accion["tipo"][] = !m.activo
      ? ["reactivar"]
      : [m.rol === "admin" ? "quitarAdmin" : "hacerAdmin", ...(esYo ? [] : (["desactivar"] as const))];
    const puedeTocar = esAdmin;

    return (
      <div className={`flex flex-col gap-3 rounded-2xl bg-superficie p-3 ${esYo ? "ring-1 ring-acento/50" : ""}`}>
        <button
          disabled={!puedeTocar}
          onClick={() => {
            setAbierto(abierto === m.id ? null : m.id);
            setConfirmando(null);
          }}
          className="flex items-center gap-3 text-left"
        >
          <Avatar apodo={m.apodo} activo={m.presente} apagado={!m.activo} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-medium">
              <span className="truncate">{m.apodo}</span>
              {esYo && <span className="text-xs text-acento">(vos)</span>}
              {m.rol === "admin" && (
                <span className="flex items-center gap-1 rounded-full bg-acento/15 px-2 py-0.5 text-[10px] font-semibold text-acento">
                  <ShieldCheck className="size-3" /> ADMIN
                </span>
              )}
            </p>
            <p className="text-xs text-texto-suave">
              {m.juntadas} {m.juntadas === 1 ? "juntada" : "juntadas"} · desde {fechaCorta(m.creado_en)}
              {m.presente && <span className="text-acento"> · en la juntada ahora</span>}
            </p>
          </div>
        </button>

        {puedeTocar && abierto === m.id && (
          <div className="flex flex-wrap gap-2 border-t border-borde pt-3">
            {confirmando?.perfilId === m.id ? (
              <>
                <button
                  disabled={ocupado}
                  onClick={() => ejecutar(confirmando, m.apodo)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold ${
                    confirmando.tipo === "desactivar" ? "bg-red-500/90 text-white" : "bg-acento text-black"
                  }`}
                >
                  {ocupado && <Loader2 className="size-4 animate-spin" />}
                  {TEXTOS[confirmando.tipo].confirmar}
                </button>
                <button onClick={() => setConfirmando(null)} className="rounded-xl border border-borde px-4 text-sm">
                  No
                </button>
              </>
            ) : (
              acciones.map((tipo) => {
                const Icono =
                  tipo === "hacerAdmin"
                    ? ShieldCheck
                    : tipo === "quitarAdmin"
                      ? ShieldOff
                      : tipo === "desactivar"
                        ? UserX
                        : UserCheck;
                return (
                  <button
                    key={tipo}
                    onClick={() => setConfirmando({ perfilId: m.id, tipo })}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm ${
                      tipo === "desactivar" ? "border-red-500/40 text-red-300" : "border-borde"
                    }`}
                  >
                    <Icono className="size-4" /> {TEXTOS[tipo].boton}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {aviso && (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-borde bg-superficie p-3 text-sm">
          <span>{aviso}</span>
          <button onClick={() => setAviso(null)}>
            <X className="size-4 text-texto-suave" />
          </button>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">Miembros · {activos.length}</h2>
        {esAdmin && <p className="-mt-1 text-xs text-texto-suave">Tocá a alguien para hacerlo admin o desactivarlo.</p>}
        {activos.map((m) => (
          <Fila key={m.id} m={m} />
        ))}
      </section>

      {esAdmin && inactivos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">
            Desactivados · {inactivos.length}
          </h2>
          {inactivos.map((m) => (
            <Fila key={m.id} m={m} />
          ))}
        </section>
      )}
    </div>
  );
}
