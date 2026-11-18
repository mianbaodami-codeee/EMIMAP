import { NextRequest } from "next/server";
import { z } from "zod";
import { UpdateSitePatchSchema } from "@omnikit/shared";
import {
  deleteCustomSite,
  HubServiceError,
  updateSiteForClient,
} from "@/lib/hub/service";
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

const SiteIdSchema = z.string().uuid("无效的站点 ID 格式");

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  try {
    const { id } = await context.params;
    const validId = SiteIdSchema.parse(id);
    const { clientId, isNewCookie } = await resolveClientWorkspaceId();
    const body = await req.json();
    const patch = UpdateSitePatchSchema.parse(body);

    const updated = await updateSiteForClient(clientId, validId, patch);
    return apiOk(updated, {
      startedAt,
      headers: isNewCookie
        ? { "Set-Cookie": buildClientCookieHeader(clientId) }
        : undefined,
    });
  } catch (err) {
    if (err instanceof HubServiceError) {
      return apiError(err.code, err.message, {
        status: err.code === "NOT_FOUND" ? 404 : 403,
        startedAt,
      });
    }
    return handleUnexpectedApiError(err, startedAt);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  try {
    const { id } = await context.params;
    const validId = SiteIdSchema.parse(id);
    const { clientId, isNewCookie } = await resolveClientWorkspaceId();

    const deleted = await deleteCustomSite(clientId, validId);
    return apiOk(deleted, {
      startedAt,
      headers: isNewCookie
        ? { "Set-Cookie": buildClientCookieHeader(clientId) }
        : undefined,
    });
  } catch (err) {
    if (err instanceof HubServiceError) {
      return apiError(err.code, err.message, {
        status: err.code === "NOT_FOUND" ? 404 : 403,
        startedAt,
      });
    }
    return handleUnexpectedApiError(err, startedAt);
  }
}
