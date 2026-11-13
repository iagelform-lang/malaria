// Todo se muestra en hora de Buenos Aires, sin importar la zona del teléfono
export const ZONA = "America/Argentina/Buenos_Aires";

const fmtHora = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false });
const fmtFecha = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, weekday: "short", day: "numeric", month: "short" });

export function hora(iso: string) {
  return fmtHora.format(new Date(iso));
}

export function fechaCorta(iso: string) {
  return fmtFecha.format(new Date(iso));
}

export function fechaYHora(iso: string) {
  return `${fechaCorta(iso)} · ${hora(iso)}`;
}

/** 135 → "2 h 15 min" */
export function duracion(minutos: number | null | undefined) {
  if (minutos == null) return "—";
  const m = Math.max(0, Math.round(minutos));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

/** Contador en vivo: "1:07:42" */
export function cronometro(desdeIso: string, ahora: number) {
  const s = Math.max(0, Math.floor((ahora - new Date(desdeIso).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
}

/** Valor para <input type="datetime-local"> en hora de Buenos Aires */
export function aInputLocal(fecha: Date) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(fecha);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "00";
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour") === "24" ? "00" : p("hour")}:${p("minute")}`;
}

/** "2026-11-13T21:30" (hora de Buenos Aires, UTC-3 fijo) → ISO UTC */
export function desdeInputLocal(valor: string) {
  return new Date(`${valor}:00-03:00`).toISOString();
}
