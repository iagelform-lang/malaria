import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { usuarioActual } from "@/lib/sesion";
import { cargarSaldoGeneral } from "@/lib/saldoServidor";
import { pesos } from "@/lib/cuentas";
import { SaldoGeneral } from "@/components/gastos/SaldoGeneral";
import { FormCuenta } from "@/components/gastos/FormCuenta";

export default function GastosPage() {
  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex items-center gap-2 pr-12">
        <Link href="/" className="-ml-2 rounded-full p-2 text-texto-suave">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold">Cuentas</h1>
      </div>
      <Suspense
        fallback={
          <div className="flex flex-col gap-3">
            <div className="h-24 animate-pulse rounded-2xl bg-superficie" />
            <div className="h-40 animate-pulse rounded-2xl bg-superficie" />
          </div>
        }
      >
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const { supabase, uid, esAdmin } = await usuarioActual();
  const [saldo, { data: perfs }] = await Promise.all([
    cargarSaldoGeneral(supabase),
    supabase.from("perfiles").select("id, apodo, alias, activo, oculto"),
  ]);
  const perfiles = (perfs ?? []) as { id: string; apodo: string; alias: string | null; activo: boolean; oculto: boolean }[];
  const visibles = perfiles.filter((p) => p.activo && !p.oculto);
  const mio = Math.round(saldo.saldos.get(uid!) ?? 0);

  return (
    <>
      {/* Mi saldo */}
      <div
        className={`flex flex-col gap-1 rounded-2xl p-4 ${
          mio <= -1 ? "bg-red-500/10 ring-1 ring-red-500/30" : mio >= 1 ? "bg-acento/10 ring-1 ring-acento/30" : "bg-superficie"
        }`}
      >
        <p className="text-sm text-texto-suave">Tu saldo, sumando todo</p>
        <p className={`text-3xl font-bold ${mio <= -1 ? "text-red-300" : mio >= 1 ? "text-acento" : ""}`}>
          {mio <= -1 ? `Debés ${pesos(-mio)}` : mio >= 1 ? `Te deben ${pesos(mio)}` : "Estás al día"}
        </p>
        <p className="text-xs text-texto-suave">
          Junta los gastos de todas las juntadas y cuentas, y compensa: si en una debés y en otra te deben, se resta.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">Quién le paga a quién</h2>
        <SaldoGeneral
          deudas={saldo.deudas}
          perfiles={perfiles}
          uid={uid!}
          esAdmin={esAdmin}
          pagosGenerales={saldo.pagosGenerales}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">Cuentas sueltas</h2>
        {saldo.cuentas.map((c) => {
          const miParte = saldo.detalle.find((d) => d.clave === `/gastos/${c.id}`)?.saldos.get(uid!) ?? 0;
          return (
            <Link
              key={c.id}
              href={`/gastos/${c.id}`}
              className="flex items-center gap-3 rounded-2xl bg-superficie p-3 active:scale-[0.99]"
            >
              <span className="text-2xl">{c.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.nombre}</p>
                <p className="text-xs text-texto-suave">{c.miembros.length} personas</p>
              </div>
              {Math.abs(miParte) >= 1 && (
                <span className={`font-mono text-sm ${miParte < 0 ? "text-red-300" : "text-acento"}`}>
                  {miParte < 0 ? "-" : "+"}
                  {pesos(Math.abs(miParte))}
                </span>
              )}
              <ChevronRight className="size-4 text-texto-suave" />
            </Link>
          );
        })}
        <FormCuenta perfiles={visibles} uid={uid!} />
      </section>

      {saldo.detalle.length > 0 && (
        <details className="rounded-2xl border border-borde p-3 text-sm">
          <summary className="cursor-pointer text-texto-suave">De dónde sale tu saldo</summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {saldo.detalle
              .filter((d) => Math.abs(d.saldos.get(uid!) ?? 0) >= 1)
              .map((d) => {
                const v = d.saldos.get(uid!) ?? 0;
                return (
                  <Link key={d.clave} href={d.clave} className="flex items-center justify-between gap-2">
                    <span className="truncate">{d.nombre}</span>
                    <span className={`font-mono ${v < 0 ? "text-red-300" : "text-acento"}`}>
                      {v < 0 ? "-" : "+"}
                      {pesos(Math.abs(v))}
                    </span>
                  </Link>
                );
              })}
            {Math.abs(saldo.saldos.get(uid!) ?? 0) >= 1 && saldo.pagosGenerales.length > 0 && (
              <p className="text-xs text-texto-suave">+ los pagos registrados acá arriba</p>
            )}
          </div>
        </details>
      )}
    </>
  );
}
