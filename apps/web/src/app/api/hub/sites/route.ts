import { NextRequest } from "next/server";
import {
  CreateCustomSiteSchema,
  SITE_CATEGORIES,
  type SiteCategory,
} from "@omnikit/shared";
import { createCustomSite, listHubSites } from "@/lib/hub/service";
import { getCacheStore } from "@/lib/cache/store";
import {
  apiError,
  apiOk,
  handleUnexpectedApiError,
} from "@/lib/http/api-response";
import {
  buildClientCookieHeader,
  resolveClientWorkspaceId,
} from "@/lib/session/client-id";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const { clientId, isNewCookie } = await resolveClientWorkspaceId();
    const { searchParams } = new URL(req.url);

    const query = searchParams.get("q") || undefined;
    const rawCat = searchParams.get("category") || "all";
    const category: SiteCategory | "all" =
      rawCat === "all" || (SITE_CATEGORIES as readonly string[]).includes(rawCat)
        ? (rawCat as SiteCategory | "all")
        : "all";
    const officialOnly = searchParams.get("official") === "true";
    const favoritesOnly = searchParams.get("favorites") === "true";

    const result = await listHubSites({
      clientId,
      query,
      category,
      officialOnly,
      favoritesOnly,
    });

    return apiOk(result, {
      startedAt,
      headers: isNewCookie
        ? { "Set-Cookie": buildClientCookieHeader(clientId) }
        : undefined,
    });
  } catch (err) {
    return handleUnexpectedApiError(err, startedAt);
  }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const { clientId, isNewCookie } = await resolveClientWorkspaceId();

    const cache = getCacheStore();
    const rl = await cache.checkRateLimit(`hub:create:${clientId}`, 30, 60);
    if (!rl.allowed) {
      return apiError(
        "RATE_LIMITED",
        `操作过于频繁，请在 ${rl.resetInSeconds} 秒后重试`,
        { status: 429, startedAt }
      );
    }

    const body = await req.json();
    const parsed = CreateCustomSiteSchema.parse(body);
    const created = await createCustomSite(clientId, parsed);

    return apiOk(created, {
      status: 201,
      startedAt,
      headers: isNewCookie
        ? { "Set-Cookie": buildClientCookieHeader(clientId) }
        : undefined,
    });
  } catch (err) {
    return handleUnexpectedApiError(err, startedAt);
  }
}
