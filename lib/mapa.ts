// Estado compartido de "compartir mi ubicación en vivo" (lo usa el mapa y el que manda la ubicación desde cualquier pantalla)

export type EstadoVivo = "apagado" | "buscando" | "activo" | "sin-permiso" | "sin-gps" | "error";

const CLAVE = "malaria-compartir-ubicacion";

/** Menos de esto: "En vivo" */
export const MIN_EN_VIVO = 2;
/** Más de esto: el pin se ve apagado ("inactivo") */
export const MIN_INACTIVO = 15;
/** Más de esto: el pin ya no se muestra */
export const MIN_OCULTO = 180;

let estado: EstadoVivo = "apagado";
const oyentes = new Set<() => void>();

function avisar() {
  for (const o of oyentes) o();
}

export function suscribirVivo(fn: () => void) {
  oyentes.add(fn);
  const alCambiarOtraPestana = (e: StorageEvent) => e.key === CLAVE && fn();
  window.addEventListener("storage", alCambiarOtraPestana);
  return () => {
    oyentes.delete(fn);
    window.removeEventListener("storage", alCambiarOtraPestana);
  };
}

export function quiereCompartir() {
  try {
    return localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

export function setQuiereCompartir(si: boolean) {
  try {
    if (si) localStorage.setItem(CLAVE, "1");
    else localStorage.removeItem(CLAVE);
  } catch {}
  avisar();
}

export function estadoVivo() {
  return estado;
}

export function setEstadoVivo(e: EstadoVivo) {
  if (e === estado) return;
  estado = e;
  avisar();
}

/** Minutos desde una fecha ISO */
export function minutosDesde(iso: string, ahora: number) {
  return Math.max(0, (ahora - new Date(iso).getTime()) / 60000);
}

export function haceCuanto(min: number) {
  if (min < MIN_EN_VIVO) return "En vivo";
  if (min < 60) return `Hace ${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  return `Hace ${h} h`;
}

/** Distancia aproximada en metros (para no mandar la ubicación si casi no se movió) */
export function metrosEntre(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

export function escaparHtml(t: string) {
  return t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
