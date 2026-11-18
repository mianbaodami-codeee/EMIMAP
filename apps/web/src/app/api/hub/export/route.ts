import { NextRequest } from "next/server";
import { ImportCustomSitesSchema } from "@omnikit/shared";
import { importCustomSites, listHubSites } from "@/lib/hub/service";
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
    const { items } = await listHubSites({ clientId });
    const customSites = items
      .filter((s) => !s.isBuiltin)
      .map((s) => ({
        name: s.name,
        url: s.url,
        category: s.category,
        description: s.description,
        tags: s.tags,
      }));

    return apiOk(
      {
        exportedAt: new Date().toISOString(),
        count: customSites.length,
        sites: customSites,
      },
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
    const body = await req.json();
    const parsed = ImportCustomSitesSchema.parse(body);
    const summary = await importCustomSites(clientId, parsed.sites);

    return apiOk(summary, {
      startedAt,
      headers: isNewCookie
        ? { "Set-Cookie": buildClientCookieHeader(clientId) }
        : undefined,
    });
  } catch (err) {
    return handleUnexpectedApiError(err, startedAt);
  }
}
