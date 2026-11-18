import type { Metadata } from "next";
import { HubWorkspace } from "@/components/hub/hub-workspace";
import { listHubSites } from "@/lib/hub/service";
import { resolveClientWorkspaceId } from "@/lib/session/client-id";

export const metadata: Metadata = {
  title: "常用网址导引",
  description:
    "可搜索、分类、收藏与自定义扩展的正版游戏、开源工程、大模型与权威开发者网站导航中心。",
};

export const dynamic = "force-dynamic";

export default async function HubPage() {
  const { clientId } = await resolveClientWorkspaceId();
  const initialData = await listHubSites({ clientId });

  return <HubWorkspace initialData={initialData} />;
}
