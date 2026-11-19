import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { cpuIterations, cpuVersion, cpuWorkload } from "../../../../../public/bench/workload.mjs";
import { getCacheStore } from "@/lib/cache/store";
import { getReadyDb } from "@/lib/db/client";
import { benchmarkRuns } from "@/lib/db/schema";
import { resolveClientWorkspaceId } from "@/lib/session/client-id";

const mode = "browser-cpu";
const resultInput = z.object({
  id: z.string().uuid(),
  durationMs: z.number().finite().min(1).max(30_000),
  proof: z.number().int().min(0).max(0xffff_ffff),
  logicalCores: z.number().int().min(1).max(1024),
});

export async function GET() {
  const { db } = await getReadyDb();
  const scores = await db.select({
    id: benchmarkRuns.id,
    cpuSingleScore: benchmarkRuns.cpuSingleScore,
    logicalCores: benchmarkRuns.logicalCores,
    osInfo: benchmarkRuns.osInfo,
    createdAt: benchmarkRuns.createdAt,
  }).from(benchmarkRuns)
    .where(and(eq(benchmarkRuns.executionMode, mode), eq(benchmarkRuns.suiteVersion, cpuVersion)))
    .orderBy(desc(benchmarkRuns.cpuSingleScore), benchmarkRuns.createdAt)
    .limit(20);
  return Response.json(scores, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const input = resultInput.safeParse(await req.json().catch(() => null));
  if (!input.success) return Response.json({ error: "成绩格式无效" }, { status: 400 });
  const { clientId } = await resolveClientWorkspaceId();
  const cache = getCacheStore();
  const allowed = await cache.checkRateLimit("bench:submit:" + clientId, 8, 60);
  if (!allowed.allowed) return Response.json({ error: "请稍后再提交" }, { status: 429 });
  const key = "bench:challenge:" + input.data.id;
  const challenge = await cache.get<{ clientId: string; seed: number; started: number }>(key);
  if (!challenge || challenge.clientId !== clientId
      || input.data.durationMs > Date.now() - challenge.started + 2
      || cpuWorkload(challenge.seed) !== input.data.proof) {
    return Response.json({ error: "测试挑战已过期或未通过校验，请重新跑分" }, { status: 422 });
  }

  const score = Math.round(cpuIterations / input.data.durationMs);
  const agent = req.headers.get("user-agent") || "";
  const os = /Windows/i.test(agent) ? "Windows" : /Android/i.test(agent) ? "Android" :
    /iPhone|iPad/i.test(agent) ? "iOS / iPadOS" : /Macintosh/i.test(agent) ? "macOS" :
    /Linux/i.test(agent) ? "Linux" : "未识别";
  const { db } = await getReadyDb();
  // 同一个挑战 UUID 只能插入一次，跨实例重放也受 PostgreSQL 主键约束。
  const [saved] = await db.insert(benchmarkRuns).values({
    id: input.data.id,
    executionMode: mode,
    suiteVersion: cpuVersion,
    osInfo: os,
    logicalCores: input.data.logicalCores,
    cpuLabel: "浏览器未提供",
    gpuLabel: "未采集",
    cpuSingleScore: score,
    cpuMultiScore: 0,
    gpuScore: 0,
    memoryScore: 0,
    storageScore: 0,
    totalScore: score,
    environmentMeta: { proofChecked: true, durationMs: input.data.durationMs },
  }).onConflictDoNothing().returning({ id: benchmarkRuns.id });
  if (!saved) return Response.json({ error: "这个测试挑战已提交" }, { status: 409 });
  return Response.json({ id: saved.id }, { status: 201 });
}
