"use client";

import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as MapaLeaflet, Marker } from "leaflet";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Crosshair, Home, LoaderCircle, MapPin, Navigation, Search, Trash2, X } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { Avatar, colorDe } from "@/components/ui/Avatar";
import {
  escaparHtml,
  estadoVivo,
  haceCuanto,
  MIN_INACTIVO,
  MIN_OCULTO,
  minutosDesde,
  quiereCompartir,
  setQuiereCompartir,
  suscribirVivo,
  type EstadoVivo,
} from "@/lib/mapa";

export type Integrante = { id: string; apodo: string };
export type UbicacionVivo = {
  perfil_id: string;
  lat: number;
  lng: number;
  precision_m: number | null;
  actualizado_en: string;
};
export type Casa = { perfil_id: string; lat: number; lng: number; direccion: string | null };
type Filtro = "todo" | "vivo" | "casas";
type Resultado = { lat: number; lng: number; nombre: string };

// Centro por defecto: CABA
const CENTRO: [number, number] = [-34.6037, -58.4116];

const MENSAJE_ESTADO: Record<EstadoVivo, string> = {
  apagado: "",
  buscando: "Buscando tu ubicación…",
  activo: "Compartiendo mientras tengas la app abierta.",
  "sin-permiso":
    "El celular no le da permiso a la app para usar tu ubicación. Activalo en Ajustes → Apps (o en el candado al lado de la dirección, si la usás desde el navegador).",
  "sin-gps": "Este navegador no puede usar la ubicación.",
  error: "No pudimos leer tu ubicación. Probá salir al aire libre o reintentar.",
};

export function MapaGrupo({
  uid,
  integrantes,
  vivosIniciales,
  casasIniciales,
}: {
  uid: string;
  integrantes: Integrante[];
  vivosIniciales: UbicacionVivo[];
  casasIniciales: Casa[];
}) {
  const [vivos, setVivos] = useState(() => new Map(vivosIniciales.map((v) => [v.perfil_id, v])));
  const [casas, setCasas] = useState(() => new Map(casasIniciales.map((c) => [c.perfil_id, c])));
  const [filtro, setFiltro] = useState<Filtro>("todo");
  const [ahora, setAhora] = useState(() => Date.now());
  const [mapaListo, setMapaListo] = useState(false);
  const [errorMapa, setErrorMapa] = useState(false);
  const [panelCasa, setPanelCasa] = useState(false);
  const [tocando, setTocando] = useState(false);
  const [aviso, setAviso] = useState("");

  const quiere = useSyncExternalStore(suscribirVivo, quiereCompartir, () => false);
  const estado = useSyncExternalStore(suscribirVivo, estadoVivo, () => "apagado" as EstadoVivo);

  const supabase = useMemo(() => crearClienteNavegador(), []);
  const divRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapaLeaflet | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const capaVivos = useRef<LayerGroup | null>(null);
  const capaCasas = useRef<LayerGroup | null>(null);
  const marcadores = useRef(new Map<string, Marker>());
  const encuadrado = useRef(false);
  const tocandoRef = useRef(false);
  const guardarCasaRef = useRef<(lat: number, lng: number, direccion: string | null) => void>(() => {});

  const nombres = useMemo(() => new Map(integrantes.map((i) => [i.id, i.apodo])), [integrantes]);

  // Reloj para el "Hace X min"
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Cambios en vivo de los demás
  useEffect(() => {
    const canal = supabase
      .channel("mapa-grupo")
      .on("postgres_changes", { event: "*", schema: "public", table: "ubicaciones_vivo" }, (p) => {
        setVivos((prev) => {
          const m = new Map(prev);
          if (p.eventType === "DELETE") m.delete((p.old as { perfil_id: string }).perfil_id);
          else m.set((p.new as UbicacionVivo).perfil_id, p.new as UbicacionVivo);
          return m;
        });
        setAhora(Date.now());
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "casas" }, (p) => {
        setCasas((prev) => {
          const m = new Map(prev);
          if (p.eventType === "DELETE") m.delete((p.old as { perfil_id: string }).perfil_id);
          else m.set((p.new as Casa).perfil_id, p.new as Casa);
          return m;
        });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [supabase]);

  // Crear el mapa (Leaflet solo existe en el navegador)
  useEffect(() => {
    let cancelado = false;
    let mapa: MapaLeaflet | null = null;
    import("leaflet")
      .then((L) => {
        if (cancelado || !divRef.current) return;
        LRef.current = L;
        mapa = L.map(divRef.current, { zoomControl: false, attributionControl: true }).setView(CENTRO, 11);
        L.control.zoom({ position: "topright" }).addTo(mapa);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapa);
        capaCasas.current = L.layerGroup().addTo(mapa);
        capaVivos.current = L.layerGroup().addTo(mapa);
        mapa.on("click", (e) => {
          if (!tocandoRef.current) return;
          tocandoRef.current = false;
          setTocando(false);
          guardarCasaRef.current(e.latlng.lat, e.latlng.lng, null);
        });
        mapaRef.current = mapa;
        setMapaListo(true);
      })
      .catch(() => setErrorMapa(true));
    return () => {
      cancelado = true;
      mapa?.remove();
      mapaRef.current = null;
    };
  }, []);

  // Qué se ve
  const vivosVisibles = useMemo(
    () =>
      [...vivos.values()]
        .filter((v) => nombres.has(v.perfil_id))
        .map((v) => ({ ...v, min: minutosDesde(v.actualizado_en, ahora) }))
        .filter((v) => v.min < MIN_OCULTO),
    [vivos, nombres, ahora],
  );
  const casasVisibles = useMemo(() => [...casas.values()].filter((c) => nombres.has(c.perfil_id)), [casas, nombres]);
  const mostrarVivos = filtro !== "casas";
  const mostrarCasas = filtro !== "vivo";

  // Dibujar los pines
  useEffect(() => {
    const L = LRef.current;
    const mapa = mapaRef.current;
    if (!mapaListo || !L || !mapa || !capaVivos.current || !capaCasas.current) return;
    capaVivos.current.clearLayers();
    capaCasas.current.clearLayers();
    marcadores.current.clear();

    if (mostrarCasas) {
      for (const c of casasVisibles) {
        const apodo = nombres.get(c.perfil_id)!;
        const icono = L.divIcon({
          className: "",
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          html: `<div style="position:relative;width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#fff;border:2px solid ${colorDe(apodo)};box-shadow:0 1px 4px rgba(0,0,0,.25);font-size:18px">🏠<span style="position:absolute;top:36px;left:50%;transform:translateX(-50%);white-space:nowrap;font:600 11px system-ui,sans-serif;color:#18181b;background:rgba(255,255,255,.9);padding:1px 6px;border-radius:999px">Casa de ${escaparHtml(apodo)}</span></div>`,
        });
        const m = L.marker([c.lat, c.lng], { icon: icono, zIndexOffset: 0 })
          .bindPopup(
            `<b>Casa de ${escaparHtml(apodo)}</b>${c.direccion ? `<br>${escaparHtml(c.direccion)}` : ""}`,
          )
          .addTo(capaCasas.current);
        marcadores.current.set(`casa-${c.perfil_id}`, m);
      }
    }

    if (mostrarVivos) {
      for (const v of vivosVisibles) {
        const apodo = nombres.get(v.perfil_id)!;
        const inactivo = v.min >= MIN_INACTIVO;
        const cuando = inactivo ? `${haceCuanto(v.min)} · sin señal` : haceCuanto(v.min);
        const yo = v.perfil_id === uid;
        const icono = L.divIcon({
          className: "",
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          html: `<div style="position:relative;width:40px;height:40px;${inactivo ? "filter:grayscale(1);opacity:.55;" : ""}"><div style="width:40px;height:40px;border-radius:999px;display:grid;place-items:center;background:${colorDe(apodo)};border:3px solid ${yo ? "#15803d" : "#fff"};box-shadow:0 1px 5px rgba(0,0,0,.35);font:700 17px system-ui,sans-serif;color:#000">${escaparHtml(apodo.trim().charAt(0).toUpperCase() || "?")}</div>${inactivo ? "" : '<span style="position:absolute;right:-1px;bottom:-1px;width:12px;height:12px;border-radius:999px;background:#16a34a;border:2px solid #fff"></span>'}<span style="position:absolute;top:42px;left:50%;transform:translateX(-50%);white-space:nowrap;font:600 11px system-ui,sans-serif;color:#18181b;background:rgba(255,255,255,.92);padding:1px 6px;border-radius:999px">${escaparHtml(yo ? "Vos" : apodo)} · ${cuando}</span></div>`,
        });
        const m = L.marker([v.lat, v.lng], { icon: icono, zIndexOffset: 1000 })
          .bindPopup(`<b>${escaparHtml(apodo)}</b><br>${cuando}`)
          .addTo(capaVivos.current);
        marcadores.current.set(`vivo-${v.perfil_id}`, m);
      }
    }

    // La primera vez, encuadrar a todos los que se ven
    if (!encuadrado.current) {
      const puntos: [number, number][] = [
        ...(mostrarVivos ? vivosVisibles.map((v) => [v.lat, v.lng] as [number, number]) : []),
        ...(mostrarCasas ? casasVisibles.map((c) => [c.lat, c.lng] as [number, number]) : []),
      ];
      if (puntos.length === 1) mapa.setView(puntos[0], 15);
      else if (puntos.length > 1) mapa.fitBounds(L.latLngBounds(puntos), { padding: [50, 50], maxZoom: 15 });
      encuadrado.current = puntos.length > 0;
    }
  }, [mapaListo, vivosVisibles, casasVisibles, mostrarVivos, mostrarCasas, nombres, uid]);

  function encuadrarTodo() {
    const L = LRef.current;
    const mapa = mapaRef.current;
    if (!L || !mapa) return;
    const puntos = [...marcadores.current.values()].map((m) => m.getLatLng());
    if (puntos.length === 0) return;
    if (puntos.length === 1) mapa.flyTo(puntos[0], 15);
    else mapa.flyToBounds(L.latLngBounds(puntos), { padding: [50, 50], maxZoom: 15 });
  }

  function irA(id: string) {
    const mapa = mapaRef.current;
    if (!mapa) return;
    const m =
      (mostrarVivos && marcadores.current.get(`vivo-${id}`)) || (mostrarCasas && marcadores.current.get(`casa-${id}`));
    if (!m) return;
    mapa.flyTo(m.getLatLng(), 16, { duration: 1 });
    setTimeout(() => m.openPopup(), 1000);
    divRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function alternarCompartir() {
    if (quiere) {
      setQuiereCompartir(false);
      setVivos((prev) => {
        const m = new Map(prev);
        m.delete(uid);
        return m;
      });
      await supabase.from("ubicaciones_vivo").delete().eq("perfil_id", uid);
    } else {
      setQuiereCompartir(true);
    }
  }

  async function guardarCasa(lat: number, lng: number, direccion: string | null) {
    setAviso("Guardando…");
    const { data, error } = await supabase
      .from("casas")
      .upsert({ perfil_id: uid, lat, lng, direccion }, { onConflict: "perfil_id" })
      .select("perfil_id, lat, lng, direccion")
      .single();
    if (error || !data) {
      setAviso("No se pudo guardar. Probá de nuevo.");
      return;
    }
    setCasas((prev) => new Map(prev).set(uid, data as Casa));
    setAviso("¡Listo! Tu casa quedó guardada.");
    setPanelCasa(false);
    if (filtro === "vivo") setFiltro("todo");
    mapaRef.current?.flyTo([lat, lng], 16, { duration: 1 });
  }
  useEffect(() => {
    guardarCasaRef.current = guardarCasa;
  });

  async function borrarCasa() {
    await supabase.from("casas").delete().eq("perfil_id", uid);
    setCasas((prev) => {
      const m = new Map(prev);
      m.delete(uid);
      return m;
    });
    setAviso("Borraste tu casa del mapa.");
  }

  const miCasa = casas.get(uid);
  const vivosActivos = vivosVisibles.filter((v) => v.min < MIN_INACTIVO).length;
  const vacio =
    (filtro === "vivo" && vivosVisibles.length === 0) ||
    (filtro === "casas" && casasVisibles.length === 0) ||
    (filtro === "todo" && vivosVisibles.length === 0 && casasVisibles.length === 0);

  const ordenados = [...integrantes].sort((a, b) => {
    const va = vivos.get(a.id);
    const vb = vivos.get(b.id);
    const pa = va ? minutosDesde(va.actualizado_en, ahora) : Infinity;
    const pb = vb ? minutosDesde(vb.actualizado_en, ahora) : Infinity;
    return pa - pb || a.apodo.localeCompare(b.apodo);
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Compartir en vivo */}
      <div className="rounded-2xl border border-borde bg-superficie p-4">
        <div className="flex items-center gap-3">
          <Navigation className={`size-6 shrink-0 ${quiere && estado === "activo" ? "text-acento" : "text-texto-suave"}`} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Compartir mi ubicación en vivo</p>
            <p className="text-sm text-texto-suave">
              {quiere ? MENSAJE_ESTADO[estado] : "Solo la ven los del grupo. La podés apagar cuando quieras."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={quiere}
            aria-label="Compartir mi ubicación en vivo"
            onClick={alternarCompartir}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${quiere ? "bg-acento" : "bg-zinc-300"}`}
          >
            <span
              className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${quiere ? "left-7" : "left-1"}`}
            />
          </button>
        </div>
        {quiere && (estado === "sin-permiso" || estado === "error") && (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{MENSAJE_ESTADO[estado]}</p>
        )}
        {quiere && estado === "activo" && (
          <p className="mt-2 text-xs text-texto-suave">
            Si bloqueás el celular o cerrás la app, deja de actualizarse y tu pin se apaga a los {MIN_INACTIVO} min.
          </p>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {(
          [
            ["todo", "Ver todo"],
            ["vivo", "Solo en vivo"],
            ["casas", "Solo casas"],
          ] as [Filtro, string][]
        ).map(([f, t]) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={`flex-1 rounded-full border px-3 py-2 text-sm font-medium ${
              filtro === f ? "border-acento bg-acento text-white" : "border-borde bg-superficie text-texto"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Mapa */}
      <div className="relative isolate overflow-hidden rounded-2xl border border-borde">
        <div ref={divRef} className="h-[55dvh] w-full bg-zinc-100" />
        {!mapaListo && !errorMapa && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-100 text-texto-suave">
            <LoaderCircle className="size-8 animate-spin" />
          </div>
        )}
        {errorMapa && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-100 p-6 text-center text-texto-suave">
            No se pudo cargar el mapa. Revisá la conexión y volvé a entrar.
          </div>
        )}
        {mapaListo && vacio && (
          <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] rounded-xl bg-white/95 p-3 text-center text-sm shadow">
            {filtro === "casas"
              ? "Nadie cargó su casa todavía."
              : filtro === "vivo"
                ? "Nadie está compartiendo su ubicación ahora."
                : "Todavía no hay nadie en el mapa. Prendé tu ubicación o cargá tu casa."}
          </div>
        )}
        {tocando && (
          <div className="absolute inset-x-3 top-3 z-[500] flex items-center gap-2 rounded-xl bg-acento p-3 text-sm text-white shadow">
            <MapPin className="size-5 shrink-0" />
            <span className="flex-1">Tocá en el mapa dónde está tu casa.</span>
            <button
              type="button"
              onClick={() => {
                tocandoRef.current = false;
                setTocando(false);
              }}
              aria-label="Cancelar"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
        {mapaListo && !vacio && (
          <button
            type="button"
            onClick={encuadrarTodo}
            className="absolute bottom-3 right-3 z-[500] flex items-center gap-1 rounded-full bg-white px-3 py-2 text-sm font-medium shadow"
          >
            <Crosshair className="size-4" /> Ver a todos
          </button>
        )}
      </div>

      {aviso && (
        <p className="rounded-xl bg-zinc-100 p-3 text-center text-sm" onClick={() => setAviso("")}>
          {aviso}
        </p>
      )}

      {/* Mi casa */}
      <div className="rounded-2xl border border-borde bg-superficie p-4">
        <div className="flex items-center gap-3">
          <Home className="size-6 shrink-0 text-texto-suave" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Mi casa</p>
            <p className="truncate text-sm text-texto-suave">
              {miCasa ? (miCasa.direccion ?? "Guardada en el mapa") : "No la cargaste todavía"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPanelCasa((v) => !v)}
            className="shrink-0 rounded-full border border-borde px-4 py-2 text-sm font-medium"
          >
            {panelCasa ? "Cerrar" : miCasa ? "Cambiar" : "Cargar"}
          </button>
        </div>
        {panelCasa && (
          <PanelCasa
            onActual={(lat, lng) => guardarCasa(lat, lng, null)}
            onResultado={(r) => guardarCasa(r.lat, r.lng, r.nombre)}
            onTocar={() => {
              tocandoRef.current = true;
              setTocando(true);
              setPanelCasa(false);
              if (filtro === "vivo") setFiltro("todo");
              divRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            onBorrar={miCasa ? borrarCasa : undefined}
            setAviso={setAviso}
          />
        )}
      </div>

      {/* Integrantes */}
      <div className="flex flex-col gap-2">
        <h2 className="flex items-baseline justify-between font-semibold">
          Integrantes
          <span className="text-sm font-normal text-texto-suave">
            {vivosActivos === 0 ? "Nadie en vivo" : vivosActivos === 1 ? "1 en vivo" : `${vivosActivos} en vivo`}
          </span>
        </h2>
        <ul className="flex flex-col gap-2">
          {ordenados.map((i) => {
            const v = vivos.get(i.id);
            const min = v ? minutosDesde(v.actualizado_en, ahora) : null;
            const enMapaVivo = min !== null && min < MIN_OCULTO;
            const casa = casas.get(i.id);
            const sePuede = (mostrarVivos && enMapaVivo) || (mostrarCasas && !!casa);
            return (
              <li key={i.id}>
                <button
                  type="button"
                  disabled={!sePuede}
                  onClick={() => irA(i.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-borde bg-superficie p-3 text-left disabled:opacity-60"
                >
                  <Avatar apodo={i.apodo} activo={min !== null && min < MIN_INACTIVO} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {i.apodo}
                      {i.id === uid && <span className="text-texto-suave"> (vos)</span>}
                    </p>
                    <p className="text-sm text-texto-suave">
                      {enMapaVivo
                        ? min! >= MIN_INACTIVO
                          ? `${haceCuanto(min!)} · sin señal`
                          : haceCuanto(min!)
                        : "No comparte ubicación"}
                    </p>
                  </div>
                  {casa && <Home className="size-5 shrink-0 text-texto-suave" aria-label="Tiene la casa cargada" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function PanelCasa({
  onActual,
  onResultado,
  onTocar,
  onBorrar,
  setAviso,
}: {
  onActual: (lat: number, lng: number) => void;
  onResultado: (r: Resultado) => void;
  onTocar: () => void;
  onBorrar?: () => void;
  setAviso: (t: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [ubicando, setUbicando] = useState(false);

  function usarActual() {
    if (!("geolocation" in navigator)) {
      setAviso("Este navegador no puede usar la ubicación.");
      return;
    }
    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setUbicando(false);
        onActual(p.coords.latitude, p.coords.longitude);
      },
      (e) => {
        setUbicando(false);
        setAviso(
          e.code === e.PERMISSION_DENIED
            ? "El celular no le da permiso a la app para usar tu ubicación. Activalo en Ajustes, o buscá la dirección."
            : "No pudimos leer tu ubicación. Probá buscar la dirección.",
        );
      },
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  }

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const q = texto.trim();
    if (q.length < 3) return;
    setBuscando(true);
    setResultados(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ar&accept-language=es&q=${encodeURIComponent(q)}`;
      const r = await fetch(url);
      const datos = (await r.json()) as { lat: string; lon: string; display_name: string }[];
      setResultados(
        datos.map((d) => ({
          lat: Number(d.lat),
          lng: Number(d.lon),
          nombre: d.display_name.split(",").slice(0, 3).join(",").trim().slice(0, 160),
        })),
      );
    } catch {
      setAviso("No se pudo buscar la dirección. Probá de nuevo.");
    }
    setBuscando(false);
  }

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-borde pt-4">
      <button
        type="button"
        onClick={usarActual}
        disabled={ubicando}
        className="flex items-center justify-center gap-2 rounded-xl bg-acento px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {ubicando ? <LoaderCircle className="size-5 animate-spin" /> : <Crosshair className="size-5" />}
        Estoy en casa: guardar donde estoy
      </button>
      <form onSubmit={buscar} className="flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar dirección (ej: Malabia 1200, CABA)"
          className="min-w-0 flex-1 rounded-xl border border-borde bg-fondo px-3 py-2"
        />
        <button
          type="submit"
          disabled={buscando || texto.trim().length < 3}
          className="rounded-xl border border-borde px-3 disabled:opacity-50"
          aria-label="Buscar"
        >
          {buscando ? <LoaderCircle className="size-5 animate-spin" /> : <Search className="size-5" />}
        </button>
      </form>
      {resultados &&
        (resultados.length === 0 ? (
          <p className="text-sm text-texto-suave">No encontramos esa dirección. Probá agregando el barrio o la ciudad.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {resultados.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onResultado(r)}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-zinc-100"
                >
                  {r.nombre}
                </button>
              </li>
            ))}
          </ul>
        ))}
      <button type="button" onClick={onTocar} className="flex items-center justify-center gap-2 py-2 text-sm font-medium">
        <MapPin className="size-4" /> O marcala tocando el mapa
      </button>
      {onBorrar && (
        <button
          type="button"
          onClick={onBorrar}
          className="flex items-center justify-center gap-2 py-1 text-sm text-red-600"
        >
          <Trash2 className="size-4" /> Sacar mi casa del mapa
        </button>
      )}
    </div>
  );
}
