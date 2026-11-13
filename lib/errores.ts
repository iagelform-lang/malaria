// Traduce los códigos que lanzan las funciones SQL a mensajes para mostrar
const MENSAJES: Record<string, string> = {
  NO_AUTORIZADO: "Solo el anfitrión o un admin puede hacer eso.",
  JUNTADA_NO_ACTIVA: "La juntada no está en curso.",
  QR_INVALIDO: "Ese QR no es válido (¿lo regeneró?).",
  YA_HAY_UNA_ACTIVA: "Ya hay otra juntada en curso. Finalizala primero.",
  NO_ESTA_PROPUESTA: "La juntada ya no está propuesta.",
  NO_ESTA_ACTIVA: "La juntada no está en curso.",
  YA_TIENE_SALIDA: "Ya tenía la salida marcada.",
  HORA_INVALIDA: "Esa hora no tiene sentido (antes de entrar o en el futuro).",
  ASISTENCIA_INEXISTENTE: "No encontramos ese registro.",
};

export function mensajeError(error: { message?: string } | null | undefined) {
  if (!error?.message) return "Algo salió mal. Probá de nuevo.";
  const codigo = Object.keys(MENSAJES).find((c) => error.message!.includes(c));
  return codigo ? MENSAJES[codigo] : "Algo salió mal. Probá de nuevo.";
}
