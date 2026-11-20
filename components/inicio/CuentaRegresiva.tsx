import { FotoAmpliable } from "@/components/inicio/FotoAmpliable";
import { diasQueFaltan, fotoDelDia, FOTOS, NOMBRE_EVENTO, type FechaParaCuenta } from "@/lib/cuentaRegresiva";

/** Tarjeta grande en Inicio: "Faltan X días para El Malariaso" con la foto del día */
export function CuentaRegresiva({ fechas, hoyBA }: { fechas: FechaParaCuenta[]; hoyBA: string }) {
  if (FOTOS.length === 0) return null;
  const evento = fechas.find((f) => NOMBRE_EVENTO.test(f.nombre));
  if (!evento) return null;
  const faltan = diasQueFaltan(evento, hoyBA);
  const maximo = Math.max(...FOTOS);
  const dur = Math.max(1, evento.duracion_dias ?? 1);
  // se muestra desde la primera foto hasta el último día del evento
  if (faltan > maximo || faltan < -(dur - 1)) return null;
  const foto = fotoDelDia(faltan);

  return (
    <div className="overflow-hidden rounded-3xl bg-superficie shadow-sm ring-1 ring-borde">
      {foto && <FotoAmpliable src={foto} alt={`Cuenta regresiva: faltan ${faltan} días`} />}
      <div className="flex items-center gap-4 p-4">
        {faltan > 0 ? (
          <>
            <div className="flex flex-col items-center leading-none">
              <span className="text-5xl font-black text-acento">{faltan}</span>
              <span className="text-sm text-texto-suave">{faltan === 1 ? "día" : "días"}</span>
            </div>
            <p className="text-xl font-bold leading-tight">
              {faltan === 1 ? "Falta" : "Faltan"} {faltan} {faltan === 1 ? "día" : "días"} para {evento.nombre} 🦟
            </p>
          </>
        ) : (
          <p className="text-2xl font-black leading-tight">¡Arrancó {evento.nombre}! 🦟</p>
        )}
      </div>
    </div>
  );
}
