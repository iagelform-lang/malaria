"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";

type Foto = { id: number; ruta: string; subido_por: string; url?: string };

/** Achica la foto en el celular antes de subirla (máx. 1600 px, JPEG) */
async function achicar(archivo: File): Promise<Blob> {
  const img = await createImageBitmap(archivo);
  const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(img.width * escala);
  lienzo.height = Math.round(img.height * escala);
  lienzo.getContext("2d")!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  return new Promise((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error("foto"))), "image/jpeg", 0.82));
}

/** Fotos de la juntada: se suben mientras está en curso o después */
export function SeccionFotos({
  juntadaId,
  uid,
  puedeGestionar,
  puedeSubir,
}: {
  juntadaId: string;
  uid: string;
  puedeGestionar: boolean;
  puedeSubir: boolean;
}) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [subiendo, setSubiendo] = useState(0);
  const [abierta, setAbierta] = useState<Foto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const recargar = useCallback(async () => {
    const { data } = await supabase.from("fotos").select("id, ruta, subido_por").eq("juntada_id", juntadaId).order("creado_en");
    if (!data) return;
    if (data.length === 0) return setFotos([]);
    const { data: firmadas } = await supabase.storage.from("fotos").createSignedUrls(
      data.map((f) => f.ruta),
      60 * 60,
    );
    const urls = new Map((firmadas ?? []).map((f) => [f.path, f.signedUrl]));
    setFotos(data.map((f) => ({ ...f, url: urls.get(f.ruta) ?? undefined })));
  }, [supabase, juntadaId]);

  useEffect(() => {
    const t = setTimeout(recargar, 0);
    const canal = supabase
      .channel(`fotos-${juntadaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "fotos", filter: `juntada_id=eq.${juntadaId}` }, recargar)
      .subscribe();
    return () => {
      clearTimeout(t);
      supabase.removeChannel(canal);
    };
  }, [supabase, juntadaId, recargar]);

  async function subir(archivos: FileList | null) {
    if (!archivos?.length) return;
    setError(null);
    const lista = [...archivos].slice(0, 10);
    setSubiendo(lista.length);
    let fallaron = 0;
    for (const archivo of lista) {
      try {
        const blob = await achicar(archivo);
        const ruta = `${juntadaId}/${crypto.randomUUID()}.jpg`;
        const { error: e1 } = await supabase.storage.from("fotos").upload(ruta, blob, { contentType: "image/jpeg" });
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("fotos").insert({ juntada_id: juntadaId, ruta });
        if (e2) {
          await supabase.storage.from("fotos").remove([ruta]);
          throw e2;
        }
      } catch {
        fallaron++;
      }
      setSubiendo((n) => n - 1);
    }
    if (fallaron) setError(fallaron === 1 ? "Una foto no se pudo subir." : `${fallaron} fotos no se pudieron subir.`);
    if (entrada.current) entrada.current.value = "";
    await recargar();
  }

  async function borrar(f: Foto) {
    setAbierta(null);
    await supabase.from("fotos").delete().eq("id", f.id);
    await supabase.storage.from("fotos").remove([f.ruta]);
    await recargar();
  }

  if (!puedeSubir && fotos.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-texto-suave">
          <Camera className="size-4" /> Fotos {fotos.length > 0 && `(${fotos.length})`}
        </h2>
        {puedeSubir && (
          <button
            onClick={() => entrada.current?.click()}
            disabled={subiendo > 0}
            className="flex items-center gap-1 rounded-full bg-acento px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-60"
          >
            {subiendo > 0 ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Subiendo {subiendo}
              </>
            ) : (
              <>
                <ImagePlus className="size-4" /> Subir
              </>
            )}
          </button>
        )}
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => subir(e.target.files)}
        />
      </div>

      {fotos.length === 0 ? (
        <p className="text-sm text-texto-suave">Todavía no hay fotos. ¡Subí la primera!</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {fotos.map((f) => (
            <button key={f.id} onClick={() => setAbierta(f)} className="aspect-square overflow-hidden rounded-lg bg-superficie">
              {f.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt="" loading="lazy" className="size-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {abierta && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={() => setAbierta(null)}>
          <div className="flex items-center justify-between p-3">
            {(abierta.subido_por === uid || puedeGestionar) ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  borrar(abierta);
                }}
                className="rounded-lg bg-red-500/90 px-3 py-1.5 text-sm font-semibold text-white"
              >
                Borrar foto
              </button>
            ) : (
              <span />
            )}
            <button className="p-2 text-white" aria-label="Cerrar">
              <X className="size-6" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center p-2">
            {abierta.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={abierta.url} alt="" className="max-h-full max-w-full object-contain" />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
