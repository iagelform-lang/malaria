import * as webpush from "web-push";
import { NextResponse, type NextRequest } from "next/server";
import { CLAVE_PUBLICA_PUSH } from "@/lib/push";

// Recibe desde Supabase (job cada minuto) los avisos pendientes y los reenvía a cada celular.
// Protegido con una clave compartida (PUSH_SECRET) que solo conocen Supabase y Vercel.

type Item = { endpoint: string; p256dh: string; auth: string; titulo: string; cuerpo: string; url: string };

export async function POST(request: NextRequest) {
  const secreto = process.env.PUSH_SECRET;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!secreto || !privada) return NextResponse.json({ error: "push sin configurar" }, { status: 503 });
  if (request.headers.get("x-push-secret") !== secreto) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const { items } = (await request.json()) as { items: Item[] };
  webpush.setVapidDetails("https://malaria-six.vercel.app", CLAVE_PUBLICA_PUSH, privada);

  const resultados = await Promise.allSettled(
    (items ?? []).map((i) =>
      webpush.sendNotification(
        { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
        JSON.stringify({ titulo: i.titulo, cuerpo: i.cuerpo, url: i.url }),
        { TTL: 60 * 60 },
      ),
    ),
  );

  const enviados = resultados.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ enviados, fallidos: resultados.length - enviados });
}
