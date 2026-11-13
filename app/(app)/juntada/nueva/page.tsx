import { Suspense } from "react";
import { FormNuevaJuntada } from "@/components/juntada/FormNuevaJuntada";

export default function NuevaJuntadaPage() {
  return (
    <Suspense fallback={<div className="mt-12 h-96 animate-pulse rounded-2xl bg-superficie" />}>
      <FormNuevaJuntada />
    </Suspense>
  );
}
