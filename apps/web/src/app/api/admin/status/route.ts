import { readAdminReport } from "@/lib/admin/report";

export const dynamic = "force-dynamic";
export async function GET() {
  const report = await readAdminReport();
  return Response.json(report ? { ok: true, data: report } : { ok: false }, {
    status: report ? 200 : 403, headers: { "Cache-Control": "private, no-store" },
  });
}
