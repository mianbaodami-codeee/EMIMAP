import type { Metadata } from "next";
import { PLATFORM_MODULES } from "@omnikit/shared";
import { runResourceDiscoveryAgent } from "@/lib/discover/agent";
import { DiscoverWorkspace } from "@/components/discover/discover-workspace";

export const dynamic = "force-dynamic";

const mod = PLATFORM_MODULES.find((m) => m.id === "discover")!;

export const metadata: Metadata = {
  title: mod.name,
  description: mod.summary,
};

export default async function ResourceDiscoveryPage() {
  const initialResult = await runResourceDiscoveryAgent({
    query: "Cyberpunk 2077 官方正版购买渠道",
    category: "all",
    officialOnly: false,
    conversationHistory: [],
  });

  return <DiscoverWorkspace initialResult={initialResult} />;
}
