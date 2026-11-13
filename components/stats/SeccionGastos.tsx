"use client";

import { useState } from "react";
import { pesos } from "@/lib/cuentas";
import { fechaCorta } from "@/lib/tiempo";
import {
  resumirGastos,
  type AsistenciaG,
  type ConsumoG,
  type ExclusionG,
  type JuntadaG,
  type Periodo,
} from "@/lib/gastos";
import { Avatar } from "@/components/ui/Avatar";

const PERIODOS: { clave: Periodo; etiqueta: string }[] = [
  { clave: "mes", etiqueta: "Este mes" },
  { clave: "anio", etiqueta: "Este año" },
  { clave: "siempre", etiqueta: "Siempre" },
];

type Props = {
  juntadas: JuntadaG[];
  asistencias: AsistenciaG[];
  exclusiones: ExclusionG[];
  consumos: ConsumoG[];
  apodos: Record<string, string>;
  uid: string;
};

export function SeccionGastos({ juntadas, asistencias, exclusiones, consumos, apodos, uid }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>("anio");
  const r = resumirGastos(juntadas, asistencias, exclusiones, consumos, periodo);
  const apodo = (id: string) => apodos[id] ?? "?";
  const banco = r.banco[0];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">Comida y gastos</h2>
      </div>
      <div className="flex gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p.clave}
            onClick={() => setPeriodo(p.clave)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              periodo === p.clave ? "bg-acento font-semibold text-black" : "bg-superficie text-texto-suave"
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>
      <p className="-mt-1 text-[11px] text-texto-suave">
        Montos en pesos de cada momento: por la inflación, comparar períodos largos exagera lo más reciente.
      </p>

      {r.totalGrupo === 0 && !r.ultimaCena ? (
        <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-sm text-texto-suave">
          Todavía no hay consumos cargados en juntadas terminadas de este período.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Tarjeta emoji="🏦" titulo="El Banco" desc="El que más plata puso">
              {banco ? (
                <>
                  <p className="text-xl font-bold leading-tight text-acento">{apodo(banco.perfil_id)}</p>
                  <p className="text-xs text-texto-suave">{pesos(banco.puesto)} puestos</p>
                </>
              ) : (
                <p className="text-sm text-texto-suave">Vacante</p>
              )}
            </Tarjeta>
            <Tarjeta emoji="💸" titulo="La más cara" desc="Mayor gasto por persona">
              {r.masCara ? (
                <>
                  <p className="truncate text-base font-bold leading-tight text-acento">{r.masCara.nombre}</p>
                  <p className="text-xs text-texto-suave">
                    {pesos(r.masCara.cuota)} c/u · {fechaCorta(r.masCara.fecha)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-texto-suave">Vacante</p>
              )}
            </Tarjeta>
            <Tarjeta emoji="🍽️" titulo="La Última Cena" desc="Lo último que comieron" ancho>
              {r.ultimaCena ? (
                <>
                  <p className="font-bold leading-tight text-acento">{r.ultimaCena.comidas.join(", ")}</p>
                  {r.ultimaCena.postres.length > 0 && <p className="text-sm">🍰 {r.ultimaCena.postres.join(", ")}</p>}
                  <p className="text-xs text-texto-suave">
                    {r.ultimaCena.nombre} · {fechaCorta(r.ultimaCena.fecha)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-texto-suave">Nadie cargó comida todavía</p>
              )}
              {r.comidaFavorita && (
                <p className="mt-1 text-xs">
                  🔁 Lo que más se repite: <b>{r.comidaFavorita.nombre}</b> ({r.comidaFavorita.veces} veces)
                </p>
              )}
            </Tarjeta>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-superficie p-4">
              <p className="text-2xl font-bold">{pesos(r.totalGrupo)}</p>
              <p className="text-sm text-texto-suave">gastó el grupo</p>
            </div>
            <div className="rounded-2xl bg-superficie p-4">
              <p className="text-2xl font-bold">
                {r.porPersona.length
                  ? pesos(
                      r.porPersona.reduce((s, p) => s + p.cuotas, 0) / r.porPersona.reduce((s, p) => s + p.juntadas, 0),
                    )
                  : "—"}
              </p>
              <p className="text-sm text-texto-suave">promedio por persona por juntada</p>
            </div>
          </div>

          {r.porPersona.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-texto-suave">Cuánto le tocó pagar a cada uno</p>
              {r.porPersona.map((p) => (
                <div
                  key={p.perfil_id}
                  className={`flex items-center gap-3 rounded-xl bg-superficie px-3 py-2 ${
                    p.perfil_id === uid ? "ring-1 ring-acento/50" : ""
                  }`}
                >
                  <Avatar apodo={apodo(p.perfil_id)} />
                  <div className="flex-1">
                    <p className="font-medium">{apodo(p.perfil_id)}</p>
                    <p className="text-xs text-texto-suave">
                      {p.juntadas} {p.juntadas === 1 ? "juntada" : "juntadas"} · {pesos(p.promedio)} promedio
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold">{pesos(p.cuotas)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Tarjeta({
  emoji,
  titulo,
  desc,
  ancho,
  children,
}: {
  emoji: string;
  titulo: string;
  desc: string;
  ancho?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-2xl border border-borde bg-superficie p-4 ${ancho ? "col-span-2" : ""}`}
    >
      <span className="text-3xl">{emoji}</span>
      <p className="text-sm font-semibold">{titulo}</p>
      {children}
      <p className="mt-auto pt-2 text-[11px] leading-snug text-texto-suave">{desc}</p>
    </div>
  );
}
