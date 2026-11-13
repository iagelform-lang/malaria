// Fechas especiales del grupo: pueden durar varios días (ej: El Malariaso del 22 al 27/12).
// Todo en hora de Buenos Aires (UTC-3 fijo).

export type FechaEspecial = {
  id: number;
  nombre: string;
  dia: number;
  mes: number;
  desde_anio: number | null;
  lugar?: string | null;
  creado_por?: string | null;
  duracion_dias?: number | null;
};

export type Proxima = FechaEspecial & {
  /** días hasta que empieza: 0 = empieza hoy, negativo = ya empezó y sigue */
  dias: number;
  enCurso: boolean;
  /** número de día del evento si está en curso (1 = primer día) */
  diaDelEvento: number | null;
  duracion: number;
  /** año en que empieza esta vez */
  anio: number;
  /** días del evento como "AAAA-MM-DD" */
  diasEvento: string[];
  cumple: number | null;
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const DIA_MS = 86_400_000;

export const nombreFecha = (dia: number, mes: number) => `${dia} de ${MESES[mes - 1]}`;

/** "lun 22" a partir de "2026-12-22" */
export function etiquetaDia(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${SEMANA[d.getUTCDay()]} ${d.getUTCDate()}`;
}

/** "22 de dic" o "22 al 27 de dic" o "30 de dic al 2 de ene" */
export function nombreRango(f: FechaEspecial) {
  const dur = f.duracion_dias ?? 1;
  if (dur <= 1) return nombreFecha(f.dia, f.mes);
  const fin = new Date(Date.UTC(2001, f.mes - 1, f.dia) + (dur - 1) * DIA_MS);
  const finMes = fin.getUTCMonth() + 1;
  return finMes === f.mes
    ? `${f.dia} al ${fin.getUTCDate()} de ${MESES[f.mes - 1]}`
    : `${nombreFecha(f.dia, f.mes)} al ${nombreFecha(fin.getUTCDate(), finMes)}`;
}

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
  const duracion = Math.max(1, f.duracion_dias ?? 1);
  const inicio = (a: number) => {
    // 29/2 en años no bisiestos se festeja el 28/2
    const dia = f.mes === 2 && f.dia === 29 && !esBisiesto(a) ? 28 : f.dia;
    return Date.UTC(a, f.mes - 1, dia);
  };
  // si el evento del año pasado todavía no terminó (ej: arranca el 30/12), es ese
  let anio = new Date(hoy).getUTCFullYear() - 1;
  while (inicio(anio) + (duracion - 1) * DIA_MS < hoy) anio++;

  const ini = inicio(anio);
  const dias = Math.round((ini - hoy) / DIA_MS);
  const enCurso = dias <= 0;
  const diasEvento = Array.from({ length: duracion }, (_, i) => new Date(ini + i * DIA_MS).toISOString().slice(0, 10));
  return {
    ...f,
    dias,
    enCurso,
    diaDelEvento: enCurso ? 1 - dias : null,
    duracion,
    anio,
    diasEvento,
    cumple: f.desde_anio ? anio - f.desde_anio : null,
  };
}

export function ordenarProximas(fechas: FechaEspecial[], ahora = new Date()) {
  return fechas.map((f) => proximaOcurrencia(f, ahora)).sort((a, b) => a.dias - b.dias);
}
