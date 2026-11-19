import type { Metadata } from "next";
import { BenchWorkspace } from "@/components/bench/bench-workspace";
import type { LatencyNode } from "@/lib/bench/protocol";

export const metadata: Metadata = {
  title: "Windows 测试",
  description: "浏览器性能实测、设备信息、历史对比与网络延迟。",
};
export const dynamic = "force-dynamic";

function getNodes(): LatencyNode[] {
  const nodes = new Map<string, string>([["当前站点", "/bench/ping.json"]]);
  for (const item of (process.env.BENCH_LATENCY_ENDPOINTS || "").split(",").slice(0, 5)) {
    const separator = item.indexOf("=");
    if (separator < 1) continue;
    const name = item.slice(0, separator).trim();
    if (nodes.has(name) || name.length > 40) continue;
    try {
      const url = new URL(item.slice(separator + 1).trim());
      if (url.protocol === "https:" && !url.username && !url.password) nodes.set(name, url.href);
    } catch { /* 忽略未正确配置的节点。 */ }
  }
  return Array.from(nodes, ([name, url]) => ({ name, url }));
}

export default function WindowsBenchPage() {
  return <BenchWorkspace nodes={getNodes()} />;
}
