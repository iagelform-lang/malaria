import { Suspense } from "react";
import { NavInferior } from "@/components/ui/NavInferior";
import { AvisosEnVivo } from "@/components/avisos/AvisosEnVivo";
import { Campana } from "@/components/ui/Campana";

// Todo lo que está dentro de (app) requiere sesión: lo garantiza proxy.ts
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-seguro pb-28">{children}</main>
      <AvisosEnVivo />
      <Suspense fallback={null}>
        <Campana />
      </Suspense>
      <Suspense fallback={<NavInferior rutaFija="" />}>
        <NavInferior />
      </Suspense>
    </>
  );
}
