import type { Metadata } from "next";
import { PLATFORM_MODULES } from "@omnikit/shared";
import { PhaseBlueprintView } from "@/components/blueprint/phase-blueprint-view";

const mod = PLATFORM_MODULES.find((m) => m.id === "wanjiqi")!;

export const metadata: Metadata = {
  title: mod.name,
  description: mod.summary,
};

export default function WanjiqiBlueprintPage() {
  return <PhaseBlueprintView moduleMeta={mod} />;
}
