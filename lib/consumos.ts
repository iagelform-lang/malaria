export type TipoConsumo = "comida" | "postre" | "bebida" | "otro";

export const TIPOS: { clave: TipoConsumo; etiqueta: string; emoji: string }[] = [
  { clave: "comida", etiqueta: "Comida", emoji: "🍖" },
  { clave: "postre", etiqueta: "Postre", emoji: "🍰" },
  { clave: "bebida", etiqueta: "Bebida", emoji: "🍺" },
  { clave: "otro", etiqueta: "Otro", emoji: "🧾" },
];
