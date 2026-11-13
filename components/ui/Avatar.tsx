// Círculo con la inicial y un color estable por apodo
const COLORES = ["#a3e635", "#38bdf8", "#f472b6", "#fbbf24", "#a78bfa", "#34d399", "#fb7185", "#60a5fa"];

function colorDe(texto: string) {
  let h = 0;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES[h % COLORES.length];
}

export function Avatar({
  apodo,
  activo,
  apagado,
  grande,
}: {
  apodo: string;
  activo?: boolean;
  apagado?: boolean;
  grande?: boolean;
}) {
  const color = colorDe(apodo);
  return (
    <div
      className={`relative grid shrink-0 place-items-center rounded-full font-bold text-black ${grande ? "size-14 text-xl" : "size-10"} ${
        apagado ? "opacity-50" : ""
      }`}
      style={{ background: color }}
    >
      {apodo.trim().charAt(0).toUpperCase() || "?"}
      {activo && (
        <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-superficie bg-acento" />
      )}
    </div>
  );
}
