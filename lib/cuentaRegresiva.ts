// Cuenta regresiva con una foto por día para un evento del grupo (El Malariaso).
// Las fotos están en public/<CARPETA>/NN.jpg, donde NN = cuántos días faltan (00 = el día del evento).
// La carpeta tiene un nombre imposible de adivinar: solo la ve quien tiene la app.

export const CARPETA = "cr-db6d31288d68";

/** Números de foto cargados (días que faltan). Se completa al subir las fotos. */
export const FOTOS: number[] = [];

/** El evento al que apunta la cuenta (se busca por nombre en las fechas del grupo) */
export const NOMBRE_EVENTO = /malariaso/i;

export type FechaParaCuenta = { nombre: string; dia: number; mes: number; duracion_dias?: number | null };

/** Días que faltan para la próxima vez que empieza el evento (0 = hoy), según el día de Buenos Aires */
export function diasQueFaltan(f: FechaParaCuenta, hoyBA: string) {
  const [y, m, d] = hoyBA.split("-").map(Number);
  const hoy = Date.UTC(y, m - 1, d);
  let inicio = Date.UTC(y, f.mes - 1, f.dia);
  const dur = Math.max(1, f.duracion_dias ?? 1);
  // si ya terminó este año, va el del año que viene
  if (inicio + (dur - 1) * 86_400_000 < hoy) inicio = Date.UTC(y + 1, f.mes - 1, f.dia);
  return Math.round((inicio - hoy) / 86_400_000);
}

/** La foto para hoy: la del número exacto, o si falta, la más cercana ya pasada (número más alto) */
export function fotoDelDia(faltan: number) {
  const n = Math.max(0, faltan);
  if (FOTOS.includes(n)) return `/${CARPETA}/${String(n).padStart(2, "0")}.jpg`;
  const anteriores = FOTOS.filter((x) => x > n).sort((a, b) => a - b);
  return anteriores.length ? `/${CARPETA}/${String(anteriores[0]).padStart(2, "0")}.jpg` : null;
}
