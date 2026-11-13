// Fechas especiales del grupo: cuánto falta para la próxima y cuántos años cumplen.
// Todo en hora de Buenos Aires (UTC-3 fijo).

export type FechaEspecial = { id: number; nombre: string; dia: number; mes: number; desde_anio: number | null };

export type Proxima = FechaEspecial & {
  /** 0 = hoy */
  dias: number;
  /** año en que cae la próxima vez */
  anio: number;
  /** años que se cumplen ese día (si se cargó desde cuándo) */
  cumple: number | null;
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const nombreFecha = (dia: number, mes: number) => `${dia} de ${MESES[mes - 1]}`;

/** "Hoy" en Buenos Aires como fecha UTC a medianoche */
function hoyBA(ahora: Date) {
  const ba = new Date(ahora.getTime() - 3 * 3600_000);
  return Date.UTC(ba.getUTCFullYear(), ba.getUTCMonth(), ba.getUTCDate());
}

function esBisiesto(a: number) {
  return (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
}

export function proximaOcurrencia(f: FechaEspecial, ahora = new Date()): Proxima {
  const hoy = hoyBA(ahora);
  let anio = new Date(hoy).getUTCFullYear();
  const fecha = (a: number) => {
    // 29/2 en años no bisiestos se festeja el 28/2
    const dia = f.mes === 2 && f.dia === 29 && !esBisiesto(a) ? 28 : f.dia;
    return Date.UTC(a, f.mes - 1, dia);
  };
  if (fecha(anio) < hoy) anio++;
  const dias = Math.round((fecha(anio) - hoy) / 86_400_000);
  return { ...f, dias, anio, cumple: f.desde_anio ? anio - f.desde_anio : null };
}

export function ordenarProximas(fechas: FechaEspecial[], ahora = new Date()) {
  return fechas.map((f) => proximaOcurrencia(f, ahora)).sort((a, b) => a.dias - b.dias);
}
