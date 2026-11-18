import { NextRequest } from "next/server";
import { CreateSavedPlaceSchema } from "@omnikit/shared";
import { createSavedPlace, listSavedPlaces } from "@/lib/geo/service";
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

export async function GET() {
  const startedAt = Date.now();
  try {
    const { clientId, isNewCookie } = await resolveClientWorkspaceId();
    const items = await listSavedPlaces(clientId);
    return apiOk(
      { items },
      {
        startedAt,
        headers: isNewCookie
          ? { "Set-Cookie": buildClientCookieHeader(clientId) }
          : undefined,
      }
    );
  } catch (err) {
    return handleUnexpectedApiError(err, startedAt);
  }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const { clientId, isNewCookie } = await resolveClientWorkspaceId();
    const rl = await getCacheStore().checkRateLimit(
      `geo:save:${clientId}`,
      30,
      60
    );
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", "收藏地点操作过于频繁，请稍后再试", {
        status: 429,
        startedAt,
      });
    }

    const body = await req.json();
    const parsed = CreateSavedPlaceSchema.parse(body);
    const created = await createSavedPlace(clientId, parsed);

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
