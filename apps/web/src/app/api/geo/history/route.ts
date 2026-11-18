import { listGeoQueryHistory } from "@/lib/geo/service";
import { apiOk, handleUnexpectedApiError } from "@/lib/http/api-response";
import {
  buildClientCookieHeader,
  resolveClientWorkspaceId,
} from "@/lib/session/client-id";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    const { clientId, isNewCookie } = await resolveClientWorkspaceId();
    const items = await listGeoQueryHistory(clientId, 25);
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
