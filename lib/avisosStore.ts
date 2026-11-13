"use client";

import { useSyncExternalStore } from "react";

// Contador global de avisos sin leer (lo actualiza AvisosEnVivo, lo lee la barra de abajo)
let noLeidos = 0;
const oyentes = new Set<() => void>();

export function setNoLeidos(n: number) {
  noLeidos = n;
  oyentes.forEach((f) => f());
}

export function useNoLeidos() {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => noLeidos,
    () => 0,
  );
}
