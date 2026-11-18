import { NextRequest } from "next/server";
import { deleteSavedPlace } from "@/lib/geo/service";
import {
  apiError,
  apiOk,
  handleUnexpectedApiError,
} from "@/lib/http/api-response";
import { resolveClientWorkspaceId } from "@/lib/session/client-id";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  try {
    const { clientId } = await resolveClientWorkspaceId();
    const { id } = await context.params;
    const removed = await deleteSavedPlace(clientId, id);
    if (!removed) {
      return apiError("NOT_FOUND", "未找到对应的收藏地点或无权删除", {
        status: 404,
        startedAt,
      });
    }
    return apiOk({ deletedId: id }, { startedAt });
  } catch (err) {
    return handleUnexpectedApiError(err, startedAt);
  }
}
