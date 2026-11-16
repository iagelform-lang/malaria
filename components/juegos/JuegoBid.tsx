"use client";

import { useMemo, useState } from "react";
import { Crown, Gavel, Loader2, Minus, Plus, Shuffle, Trophy, Undo2 } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/errores";

/*
 * Bid Womens, jugado en un solo celular (el que maneja la partida):
 *  1. Se eligen los jugadores del torneo.
 *  2. Cada duelo es 1 vs 1: los que no juegan cargan 10 nombres, la app los sortea de a uno
 *     y se subastan con $15 por jugador hasta tener 5 cada uno.
 *  3. Al mejor de 3: cada uno presenta una de las suyas y los que miran eligen cuál gana.
 *  4. Torneo con cuadro de ganadores y de perdedores (al segundo duelo perdido, afuera).
 * Los nombres NUNCA se guardan: viven solo en este celular mientras dura el duelo.
 * Lo único que se guarda es la partida (quién jugó, quién ganó y el resultado).
 */

const PRESUPUESTO = 15;
const POR_JUGADOR = 5;
const NOMBRES = POR_JUGADOR * 2;

type Cuadro = "ganadores" | "perdedores" | "final";
type Duelo = { a: string; b: string; cuadro: Cuadro };
type Compra = { nombre: string; jugador: string; precio: number };

function mezclar<T>(lista: T[]) {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

/** Próximo duelo según cómo están los cuadros (o null si ya hay campeón) */
function proximoDuelo(ganadores: string[], perdedores: string[]): Duelo | null {
  if (ganadores.length >= 2) return { a: ganadores[0], b: ganadores[1], cuadro: "ganadores" };
  if (perdedores.length >= 2) return { a: perdedores[0], b: perdedores[1], cuadro: "perdedores" };
  if (ganadores.length === 1 && perdedores.length === 1) return { a: ganadores[0], b: perdedores[0], cuadro: "final" };
  return null;
}

export function JuegoBid({
  juntadaId,
  perfiles,
}: {
  juntadaId: string | null;
  perfiles: { id: string; apodo: string }[];
}) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const apodo = (id: string) => perfiles.find((p) => p.id === id)?.apodo ?? "?";

  // torneo
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [empezado, setEmpezado] = useState(false);
  const [ganadores, setGanadores] = useState<string[]>([]);
  const [perdedores, setPerdedores] = useState<string[]>([]);
  const [eliminados, setEliminados] = useState<string[]>([]);
  const [campeon, setCampeon] = useState<string | null>(null);

  // duelo en curso (solo en memoria)
  const [fase, setFase] = useState<"nombres" | "subasta" | "duelo" | "resultado">("nombres");
  const [nombres, setNombres] = useState<string[]>(Array(NOMBRES).fill(""));
  const [mazo, setMazo] = useState<string[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [precio, setPrecio] = useState(1);
  const [rondas, setRondas] = useState<{ a: string; b: string; gana: "a" | "b" }[]>([]);
  const [eleccion, setEleccion] = useState<{ a: string | null; b: string | null }>({ a: null, b: null });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<{ ganador: string; perdedor: string; marcador: string } | null>(null);

  const duelo = empezado && !campeon ? proximoDuelo(ganadores, perdedores) : null;

  function empezar() {
    setGanadores(mezclar(elegidos));
    setPerdedores([]);
    setEliminados([]);
    setCampeon(null);
    setEmpezado(true);
    nuevoDuelo();
  }

  function nuevoDuelo() {
    setFase("nombres");
    setNombres(Array(NOMBRES).fill(""));
    setMazo([]);
    setCompras([]);
    setPrecio(1);
    setRondas([]);
    setEleccion({ a: null, b: null });
    setError(null);
  }

  // ---------- Subasta ----------
  const compradas = (j: string) => compras.filter((c) => c.jugador === j);
  const plata = (j: string) => PRESUPUESTO - compradas(j).reduce((t, c) => t + c.precio, 0);
  const actual = mazo[compras.length];

  function vender(jugador: string) {
    if (!duelo || !actual) return;
    const p = Math.min(precio, plata(jugador));
    let nuevas = [...compras, { nombre: actual, jugador, precio: p }];
    // si uno ya completó sus 5, las que quedan van al otro sin costo
    const otro = jugador === duelo.a ? duelo.b : duelo.a;
    if (nuevas.filter((c) => c.jugador === jugador).length === POR_JUGADOR) {
      nuevas = [
        ...nuevas,
        ...mazo.slice(nuevas.length).map((nombre) => ({ nombre, jugador: otro, precio: 0 })),
      ];
    }
    setCompras(nuevas);
    setPrecio(1);
    if (nuevas.length === NOMBRES) setFase("duelo");
  }

  // ---------- Duelo al mejor de 3 ----------
  const puntos = (lado: "a" | "b") => rondas.filter((r) => r.gana === lado).length;
  const usadas = (lado: "a" | "b") => new Set(rondas.map((r) => r[lado]));

  async function definirRonda(gana: "a" | "b") {
    if (!duelo || !eleccion.a || !eleccion.b) return;
    const nuevas = [...rondas, { a: eleccion.a, b: eleccion.b, gana }];
    setRondas(nuevas);
    setEleccion({ a: null, b: null });
    const pa = nuevas.filter((r) => r.gana === "a").length;
    const pb = nuevas.filter((r) => r.gana === "b").length;
    if (pa === 2 || pb === 2) await cerrarDuelo(pa === 2 ? duelo.a : duelo.b, pa === 2 ? duelo.b : duelo.a, `${Math.max(pa, pb)} a ${Math.min(pa, pb)}`);
  }

  async function cerrarDuelo(ganador: string, perdedor: string, marcador: string) {
    if (!duelo) return;
    setGuardando(true);
    setError(null);
    // se guarda solo quién jugó y quién ganó: los nombres no salen de este celular
    const { data, error } = await supabase
      .from("partidas")
      .insert({ juntada_id: juntadaId, juego: "Bid Womens", resultado: marcador })
      .select("id")
      .single();
    if (!error && data) {
      const { error: e2 } = await supabase.from("partida_jugadores").insert([
        { partida_id: data.id, perfil_id: ganador, equipo: 1, gano: true },
        { partida_id: data.id, perfil_id: perdedor, equipo: 2, gano: false },
      ]);
      if (e2) await supabase.from("partidas").delete().eq("id", data.id);
      if (e2) setError(mensajeError(e2));
    } else if (error) {
      setError(mensajeError(error));
    }
    setGuardando(false);

    // mover en el cuadro
    let g = ganadores.filter((x) => x !== ganador && x !== perdedor);
    let p = perdedores.filter((x) => x !== ganador && x !== perdedor);
    if (duelo.cuadro === "final") {
      setCampeon(ganador);
      g = [ganador];
      p = [];
      setEliminados((e) => [...e, perdedor]);
    } else if (duelo.cuadro === "ganadores") {
      g = [...g, ganador];
      p = [...p, perdedor];
    } else {
      p = [...p, ganador];
      setEliminados((e) => [...e, perdedor]);
    }
    setGanadores(g);
    setPerdedores(p);
    if (!proximoDuelo(g, p) && duelo.cuadro !== "final") setCampeon(g[0] ?? p[0] ?? ganador);
    setUltimo({ ganador, perdedor, marcador });
    // los nombres se descartan
    setNombres(Array(NOMBRES).fill(""));
    setMazo([]);
    setCompras([]);
    setRondas([]);
    setFase("resultado");
  }

  const chip = (activo: boolean) =>
    `rounded-full px-3 py-1.5 text-sm ${activo ? "bg-acento font-semibold text-black" : "bg-superficie text-texto-suave ring-1 ring-borde"}`;

  // ---------- Pantallas ----------
  if (!empezado) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-texto-suave">
          ¿Quiénes juegan? El resto carga los nombres y vota. Se juega desde este celular y los nombres no se guardan.
        </p>
        <div className="flex flex-wrap gap-2">
          {perfiles.map((p) => {
            const ya = elegidos.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => setElegidos(ya ? elegidos.filter((x) => x !== p.id) : [...elegidos, p.id])}
                className={chip(ya)}
              >
                {p.apodo}
              </button>
            );
          })}
        </div>
        <button
          disabled={elegidos.length < 2}
          onClick={empezar}
          className="rounded-xl bg-acento py-3 font-bold text-black disabled:opacity-50"
        >
          Armar torneo ({elegidos.length} jugadores)
        </button>
      </div>
    );
  }

  const Cuadros = (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <Columna titulo="Ganadores" ids={ganadores} apodo={apodo} />
      <Columna titulo="Perdedores" ids={perdedores} apodo={apodo} />
      <Columna titulo="Afuera" ids={eliminados} apodo={apodo} tachado />
    </div>
  );

  if (campeon && fase === "resultado") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Crown className="size-16 text-amber-300" />
        <p className="text-sm uppercase tracking-widest text-texto-suave">Campeón de Bid Womens</p>
        <p className="text-4xl font-black">{apodo(campeon)}</p>
        {ultimo && (
          <p className="text-sm text-texto-suave">
            Final: {apodo(ultimo.ganador)} {ultimo.marcador} a {apodo(ultimo.perdedor)}
          </p>
        )}
        {error && <p className="text-sm text-red-400">No se pudo guardar el último duelo: {error}</p>}
        <div className="w-full">{Cuadros}</div>
        <button
          onClick={() => {
            setEmpezado(false);
            setCampeon(null);
          }}
          className="w-full rounded-xl bg-acento py-3 font-bold text-black"
        >
          Otro torneo
        </button>
      </div>
    );
  }

  if (fase === "resultado" && ultimo) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-acento/10 p-4 text-center ring-1 ring-acento/40">
          <Trophy className="mx-auto mb-1 size-8 text-acento" />
          <p className="text-xl font-bold">
            Ganó {apodo(ultimo.ganador)} {ultimo.marcador}
          </p>
          <p className="text-sm text-texto-suave">{apodo(ultimo.perdedor)} pierde este duelo</p>
          {guardando && <Loader2 className="mx-auto mt-2 size-4 animate-spin" />}
        </div>
        {error && <p className="text-sm text-red-400">No se pudo guardar el duelo: {error}</p>}
        {Cuadros}
        <button onClick={nuevoDuelo} className="rounded-xl bg-acento py-3 font-bold text-black">
          Siguiente duelo
        </button>
      </div>
    );
  }

  if (!duelo) return null;
  const etiqueta = { ganadores: "Cuadro de ganadores", perdedores: "Cuadro de perdedores", final: "Gran final" }[duelo.cuadro];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-superficie p-3 text-center">
        <p className="text-xs uppercase tracking-widest text-texto-suave">{etiqueta}</p>
        <p className="text-lg font-bold">
          {apodo(duelo.a)} <span className="text-texto-suave">vs</span> {apodo(duelo.b)}
        </p>
      </div>

      {fase === "nombres" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-texto-suave">
            Los que no juegan cargan {NOMBRES} nombres (que no miren {apodo(duelo.a)} ni {apodo(duelo.b)}).
          </p>
          {nombres.map((n, i) => (
            <input
              key={i}
              type="text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={40}
              placeholder={`Nombre ${i + 1}`}
              value={n}
              onChange={(e) => setNombres(nombres.map((x, k) => (k === i ? e.target.value : x)))}
              className="rounded-xl border border-borde bg-superficie px-3 py-2.5 outline-none focus:border-acento"
            />
          ))}
          <button
            disabled={nombres.some((n) => !n.trim())}
            onClick={() => {
              setMazo(mezclar(nombres.map((n) => n.trim())));
              setFase("subasta");
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-acento py-3 font-bold text-black disabled:opacity-50"
          >
            <Shuffle className="size-5" /> Sortear y empezar la subasta
          </button>
        </div>
      )}

      {fase === "subasta" && actual && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {[duelo.a, duelo.b].map((j) => (
              <div key={j} className="rounded-2xl bg-superficie p-3">
                <p className="truncate font-semibold">{apodo(j)}</p>
                <p className="text-2xl font-black text-acento">${plata(j)}</p>
                <p className="text-xs text-texto-suave">
                  {compradas(j).length}/{POR_JUGADOR}: {compradas(j).map((c) => c.nombre).join(", ") || "—"}
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-acento/30 to-amber-300/20 p-6 text-center">
            <p className="text-xs uppercase tracking-widest text-texto-suave">
              Sale a subasta ({compras.length + 1}/{NOMBRES})
            </p>
            <p className="text-3xl font-black">{actual}</p>
          </div>
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => setPrecio(Math.max(0, precio - 1))} className="rounded-full bg-superficie p-3" aria-label="Bajar">
              <Minus className="size-5" />
            </button>
            <p className="w-20 text-center text-3xl font-black">${precio}</p>
            <button
              onClick={() => setPrecio(Math.min(PRESUPUESTO, precio + 1))}
              className="rounded-full bg-superficie p-3"
              aria-label="Subir"
            >
              <Plus className="size-5" />
            </button>
          </div>
          <p className="-mt-2 text-center text-xs text-texto-suave">¿Quién se la llevó y por cuánto?</p>
          <div className="grid grid-cols-2 gap-2">
            {[duelo.a, duelo.b].map((j) => {
              const lleno = compradas(j).length >= POR_JUGADOR;
              const noAlcanza = precio > plata(j);
              return (
                <button
                  key={j}
                  disabled={lleno || noAlcanza}
                  onClick={() => vender(j)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-acento py-3 font-bold text-black disabled:opacity-40"
                >
                  <Gavel className="size-4" /> {apodo(j)}
                </button>
              );
            })}
          </div>
          {compras.length > 0 && (
            <button
              onClick={() => setCompras(compras.slice(0, -1))}
              className="flex items-center justify-center gap-1 text-sm text-texto-suave"
            >
              <Undo2 className="size-4" /> Deshacer la última
            </button>
          )}
        </div>
      )}

      {fase === "duelo" && (
        <div className="flex flex-col gap-4">
          <p className="text-center text-4xl font-black">
            {puntos("a")} <span className="text-texto-suave">-</span> {puntos("b")}
          </p>
          <p className="-mt-3 text-center text-xs text-texto-suave">Al mejor de 3 · ronda {rondas.length + 1}</p>
          {(["a", "b"] as const).map((lado) => {
            const j = lado === "a" ? duelo.a : duelo.b;
            return (
              <div key={lado} className="flex flex-col gap-2">
                <p className="text-sm font-semibold">{apodo(j)} presenta:</p>
                <div className="flex flex-wrap gap-2">
                  {compradas(j).map((c) => {
                    const usada = usadas(lado).has(c.nombre);
                    return (
                      <button
                        key={c.nombre}
                        disabled={usada}
                        onClick={() => setEleccion({ ...eleccion, [lado]: c.nombre })}
                        className={`${chip(eleccion[lado] === c.nombre)} disabled:line-through disabled:opacity-40`}
                      >
                        {c.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {eleccion.a && eleccion.b && (
            <div className="flex flex-col gap-2 rounded-2xl bg-superficie p-3">
              <p className="text-center text-sm text-texto-suave">Los que no juegan eligen: ¿cuál gana?</p>
              <div className="grid grid-cols-2 gap-2">
                {(["a", "b"] as const).map((lado) => (
                  <button
                    key={lado}
                    disabled={guardando}
                    onClick={() => definirRonda(lado)}
                    className="rounded-xl bg-acento py-3 font-bold text-black disabled:opacity-50"
                  >
                    {eleccion[lado]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {rondas.length > 0 && (
            <div className="flex flex-col gap-1 text-xs text-texto-suave">
              {rondas.map((r, i) => (
                <p key={i}>
                  Ronda {i + 1}: {r.a} vs {r.b} → gana {apodo(r.gana === "a" ? duelo.a : duelo.b)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {Cuadros}
    </div>
  );
}

function Columna({
  titulo,
  ids,
  apodo,
  tachado = false,
}: {
  titulo: string;
  ids: string[];
  apodo: (id: string) => string;
  tachado?: boolean;
}) {
  return (
    <div className="rounded-xl bg-superficie p-2">
      <p className="mb-1 font-semibold text-texto-suave">{titulo}</p>
      {ids.length ? (
        ids.map((id) => (
          <p key={id} className={`truncate ${tachado ? "text-texto-suave line-through" : ""}`}>
            {apodo(id)}
          </p>
        ))
      ) : (
        <p className="text-texto-suave">—</p>
      )}
    </div>
  );
}
