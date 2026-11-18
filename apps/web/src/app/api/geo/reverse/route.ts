import { NextRequest } from "next/server";
import { GeoCoordinateSchema } from "@omnikit/shared";
import { reverseGeocodeCoordinate } from "@/lib/geo/service";
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
      `geo:reverse:${clientId}`,
      60,
      60
    );
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", "坐标逆编码请求过于频繁，请稍后再试", {
        status: 429,
        startedAt,
      });
    }

    const { searchParams } = new URL(req.url);
    const parsed = GeoCoordinateSchema.parse({
      lat: searchParams.get("lat"),
      lon: searchParams.get("lon"),
    });

    const result = await reverseGeocodeCoordinate(parsed.lat, parsed.lon);
    return apiOk(result, { startedAt });
  } catch (err) {
    return handleUnexpectedApiError(err, startedAt);
  }
}
