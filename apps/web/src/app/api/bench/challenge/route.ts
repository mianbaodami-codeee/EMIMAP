import { randomInt, randomUUID } from "node:crypto";
import { getCacheStore } from "@/lib/cache/store";
import { buildClientCookieHeader, resolveClientWorkspaceId } from "@/lib/session/client-id";

export async function POST() {
  const { clientId, isNewCookie } = await resolveClientWorkspaceId();
  const cache = getCacheStore();
  const limited = await cache.checkRateLimit("bench:issue:" + clientId, 8, 60);
  if (!limited.allowed) return Response.json({ error: "请稍后再试" }, { status: 429 });
  const id = randomUUID();
  const seed = randomInt(1, 0x7fffffff);
  await cache.set("bench:challenge:" + id, { clientId, seed, started: Date.now() }, 180);
  return Response.json({ id, seed }, {
    headers: {
      "Cache-Control": "no-store",
      ...(isNewCookie ? { "Set-Cookie": buildClientCookieHeader(clientId) } : {}),
    },
  });
}
