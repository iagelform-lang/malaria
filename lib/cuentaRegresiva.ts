// Cuenta regresiva con una foto por día para un evento del grupo (El Malariaso).
// Las fotos están en public/<CARPETA>/NN.jpg, donde NN = cuántos días faltan (00 = el día del evento).
// La carpeta tiene un nombre imposible de adivinar: solo la ve quien tiene la app.

export const CARPETA = "cr-db6d31288d68";

/** Números de foto cargados (días que faltan). Se completa al subir las fotos. */
export const FOTOS: number[] = Array.from({ length: 104 }, (_, i) => i); // 00 a 32 (una por día) + 33 a 103 (las del grupo)

/** El evento al que apunta la cuenta (se busca por nombre en las fechas del grupo) */
export const NOMBRE_EVENTO = /malariaso/i;

export type FechaParaCuenta = {
  nombre: string;
  dia: number;
  mes: number;
  duracion_dias?: number | null;
};

/** Días que faltan para la próxima vez que empieza el evento (0 = hoy), según el día de Buenos Aires */
export function diasQueFaltan(f: FechaParaCuenta, hoyBA: string) {
  const [y, m, d] = hoyBA.split("-").map(Number);
  const hoy = Date.UTC(y, m - 1, d);
  let inicio = Date.UTC(y, f.mes - 1, f.dia);
  const dur = Math.max(1, f.duracion_dias ?? 1);
  // si ya terminó este año, va el del año que viene
  if (inicio + (dur - 1) * 86_400_000 < hoy)
    inicio = Date.UTC(y + 1, f.mes - 1, f.dia);
  return Math.round((inicio - hoy) / 86_400_000);
}

/** La foto para hoy: la del número exacto, o si falta, la más cercana ya pasada (número más alto) */
export function fotoDelDia(faltan: number) {
  const n = Math.max(0, faltan);
  if (FOTOS.includes(n)) return `/${CARPETA}/${String(n).padStart(2, "0")}.jpg`;
  const anteriores = FOTOS.filter((x) => x > n).sort((a, b) => a - b);
  return anteriores.length
    ? `/${CARPETA}/${String(anteriores[0]).padStart(2, "0")}.jpg`
    : null;
}

// ---- Foto cada 2 horas, de 9 a 0; de noche, cartel ----
/** Días que faltaban cuando arrancó la cuenta */
export const PRIMER_DIA = 32;
export const PRIMERA_HORA = 9;
export const CADA_HORAS = 2;
export const TURNOS_POR_DIA = Math.ceil((24 - PRIMERA_HORA) / CADA_HORAS); // 8: 9, 11, 13, 15, 17, 19, 21, 23

/** Números que son copia de otra foto (rellenaban días): no entran en la rotación */
const REPETIDAS = [0, 30, 25, 23, 13];
/** Fotos distintas (sin las repetidas), mezcladas: es el orden en que salen */
export const FOTOS_UNICAS: number[] = [
  39, 82, 57, 24, 53, 32, 102, 91, 86, 78, 52, 33, 21, 49, 54, 10, 88, 11, 77,
  93, 51, 94, 3, 63, 56, 26, 90, 17, 67, 59, 42, 15, 92, 69, 58, 74, 48, 44, 68,
  7, 41, 75, 79, 71, 37, 66, 98, 18, 50, 60, 40, 31, 19, 95, 34, 84, 47, 1, 36,
  87, 45, 16, 38, 29, 61, 46, 101, 4, 35, 97, 5, 8, 9, 72, 2, 22, 89, 55, 81, 6,
  73, 12, 20, 43, 100, 14, 96, 83, 85, 65, 99, 27, 28, 80, 70, 103, 64, 76, 62,
].filter((n) => FOTOS.includes(n) && !REPETIDAS.includes(n));

/** true de 0 a 9 de la mañana (hora de Buenos Aires): en lugar de foto, "andá a dormir" */
export function esDeNoche(horaBA: number) {
  return horaBA < PRIMERA_HORA;
}

/**
 * La foto de este momento: cambia cada 2 horas y recorre todas las fotos distintas
 * en orden antes de repetir (el turno sigue contando de un día al otro).
 */
export function fotoDelMomento(faltan: number, horaBA: number) {
  if (esDeNoche(horaBA) || FOTOS_UNICAS.length === 0) return null;
  const turno = Math.floor((horaBA - PRIMERA_HORA) / CADA_HORAS);
  const dia = PRIMER_DIA - faltan; // 0 = el primer día de la cuenta
  const i =
    (((dia * TURNOS_POR_DIA + turno) % FOTOS_UNICAS.length) +
      FOTOS_UNICAS.length) %
    FOTOS_UNICAS.length;
  return `/${CARPETA}/${String(FOTOS_UNICAS[i]).padStart(2, "0")}.jpg`;
}
