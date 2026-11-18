import { NextRequest } from "next/server";
import { searchGeoPlaces } from "@/lib/geo/service";
import { getCacheStore } from "@/lib/cache/store";
import {
  apiError,
  apiOk,
  handleUnexpectedApiError,
} from "@/lib/http/api-response";
import { resolveClientWorkspaceId } from "@/lib/session/client-id";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const { clientId } = await resolveClientWorkspaceId();
    const rl = await getCacheStore().checkRateLimit(
      `geo:search:${clientId}`,
      60,
      60
    );
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", "地图搜索过于频繁，请稍后重试", {
        status: 429,
        startedAt,
      });
    }

    const q = new URL(req.url).searchParams.get("q") || "";
    const items = await searchGeoPlaces(q);
    return apiOk({ items }, { startedAt });
  } catch (err) {
    return handleUnexpectedApiError(err, startedAt);
  }
}
