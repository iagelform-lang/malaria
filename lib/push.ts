// Clave pública VAPID (es pública: va en el navegador). La privada está en Vercel (VAPID_PRIVATE_KEY).
export const CLAVE_PUBLICA_PUSH =
  "BCCyj91K3IlRlEYRwBgdiAcva1iiyxGk7LdWsK4-uoHnBF9kcNrCdylsXHanksxTZBzDG054nqmzaVzqfOxNrRI";

export function claveABytes(base64: string) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = atob(b64);
  return Uint8Array.from([...crudo].map((c) => c.charCodeAt(0)));
}
