"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarRange, Loader2, Plus, X } from "lucide-react";
import { CampoComida } from "@/components/juntada/CampoComida";
import { ElegirPuntos } from "@/components/juntada/ElegirPuntos";
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
  const [comida, setComida] = useState("");
  const [inicio, setInicio] = useState(proximaHoraRedonda);
  const [tolerancia, setTolerancia] = useState(15);
  const [puntos, setPuntos] = useState(10);
  const [votarFecha, setVotarFecha] = useState(true);
  const [casaDe, setCasaDe] = useState("");
  const [miembros, setMiembros] = useState<{ id: string; apodo: string }[]>([]);
  const [opciones, setOpciones] = useState<string[]>(() => {
    const base = proximaHoraRedonda();
    const otra = new Date(desdeInputLocal(base));
    otra.setDate(otra.getDate() + 1);
    return [base, aInputLocal(otra)];
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    crearClienteNavegador()
      .from("perfiles")
      .select("id, apodo")
      .eq("activo", true)
      .order("apodo")
      .then(({ data }) => setMiembros(data ?? []));
  }, []);

  const lugarFinal = () =>
    lugar.trim() ||
    (casaDe
      ? `Lo de ${miembros.find((m) => m.id === casaDe)?.apodo ?? ""}`.trim()
      : "") ||
    null;

  async function abrirVotacion() {
    const fechas = [...new Set(opciones.filter(Boolean))].map(desdeInputLocal);
    if (fechas.length < 2) return setError("Poné al menos 2 fechas distintas.");
    if (fechas.some((f) => new Date(f).getTime() <= Date.now()))
      return setError("Las fechas tienen que ser en el futuro.");
    setGuardando(true);
    setError(null);
    const supabase = crearClienteNavegador();
    const { data, error } = await supabase
      .from("sondeos")
      .insert({
        nombre: nombre.trim(),
        lugar: lugar.trim() || null,
        comida: comida.trim() || null,
        tolerancia_min: tolerancia,
        casa_de: casaDe || null,
        puntos,
      })
      .select("id")
      .single();
    if (error || !data) {
      setGuardando(false);
      return setError("No se pudo abrir la votación.");
    }
    const { error: e2 } = await supabase
      .from("sondeo_opciones")
      .insert(fechas.map((inicio) => ({ sondeo_id: data.id, inicio })));
    if (e2) {
      await supabase.from("sondeos").delete().eq("id", data.id);
      setGuardando(false);
      return setError("No se pudieron guardar las fechas.");
    }
    router.replace(`/sondeo/${data.id}`);
  }

  async function proponer(e: React.FormEvent) {
    e.preventDefault();
    if (votarFecha) return abrirVotacion();
    setGuardando(true);
    setError(null);
    const supabase = crearClienteNavegador();
    const { data: sesion } = await supabase.auth.getClaims();
    const uid = sesion?.claims?.sub;
    const { data, error } = await supabase
      .from("juntadas")
      .insert({
        nombre: nombre.trim(),
        lugar: lugarFinal(),
        comida: comida.trim() || null,
        inicio_programado: desdeInputLocal(inicio),
        tolerancia_min: tolerancia,
        anfitrion_id: casaDe || uid,
        puntos,
      })
      .select("id")
      .single();
    if (error || !data) {
      setGuardando(false);
      setError("No se pudo crear la juntada.");
      return;
    }
    // el que propone y el anfitrión quedan anotados como que van (lo hace la base)
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
        <Campo etiqueta="¿En lo de quién? (opcional)">
          <select
            value={casaDe}
            onChange={(e) => setCasaDe(e.target.value)}
            className={estiloInput}
          >
            <option value="">No es en una casa / la organizo yo</option>
            {miembros.map((m) => (
              <option key={m.id} value={m.id}>
                En lo de {m.apodo}
              </option>
            ))}
          </select>
          {casaDe && (
            <span className="text-xs text-texto-suave">
              {miembros.find((m) => m.id === casaDe)?.apodo} va a ser el
              anfitrión: es el que escanea los QR al llegar.
            </span>
          )}
        </Campo>
        <CampoComida
          valor={comida}
          cambiar={setComida}
          claseInput={estiloInput}
        />
        <ElegirPuntos valor={puntos} cambiar={setPuntos} />
        <button
          type="button"
          onClick={() => setVotarFecha(!votarFecha)}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left ${
            votarFecha
              ? "border-acento bg-acento/10"
              : "border-borde bg-superficie"
          }`}
        >
          <CalendarRange
            className={`size-5 shrink-0 ${votarFecha ? "text-acento" : "text-texto-suave"}`}
          />
          <span className="flex-1 text-sm">
            <b>Votar día y hora.</b>{" "}
            {votarFecha
              ? "Cada uno marca las fechas que puede y se define sola cuando la mayoría coincide."
              : "Apagado: la juntada queda con una sola fecha fija."}
          </span>
          <span
            className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${votarFecha ? "bg-acento" : "bg-borde"}`}
          >
            <span
              className={`block size-5 rounded-full bg-white transition ${votarFecha ? "translate-x-5" : ""}`}
            />
          </span>
        </button>

        {votarFecha ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm text-texto-suave">Fechas posibles</span>
            {opciones.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input
                  required
                  type="datetime-local"
                  value={o}
                  onChange={(e) =>
                    setOpciones(
                      opciones.map((x, k) => (k === i ? e.target.value : x)),
                    )
                  }
                  className={estiloInput}
                />
                {opciones.length > 2 && (
                  <button
                    type="button"
                    onClick={() =>
                      setOpciones(opciones.filter((_, k) => k !== i))
                    }
                    className="rounded-xl border border-borde px-3 text-texto-suave"
                    aria-label="Quitar fecha"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
            {opciones.length < 5 && (
              <button
                type="button"
                onClick={() => {
                  const ultima = new Date(
                    desdeInputLocal(opciones.at(-1) ?? proximaHoraRedonda()),
                  );
                  ultima.setDate(ultima.getDate() + 1);
                  setOpciones([...opciones, aInputLocal(ultima)]);
                }}
                className="flex w-fit items-center gap-1 text-sm text-acento"
              >
                <Plus className="size-4" /> Otra fecha
              </button>
            )}
          </div>
        ) : (
          <Campo etiqueta="¿Cuándo arranca?">
            <input
              required
              type="datetime-local"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className={estiloInput}
            />
          </Campo>
        )}
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
          {votarFecha ? "Abrir votación" : "Proponer"}
        </button>
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </form>
    </div>
  );
}

function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-texto-suave">{etiqueta}</span>
      {children}
    </label>
  );
}
