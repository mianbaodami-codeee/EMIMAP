import React from "react";
import {
  Cable,
  Compass,
  Cpu,
  Globe2,
  LayoutGrid,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import type { PlatformModuleMeta } from "@omnikit/shared";

const ICON_MAP: Record<
  PlatformModuleMeta["iconName"],
  React.ComponentType<{ className?: string }>
> = {
  LayoutGrid,
  Compass,
  Globe2,
  Sparkles,
  Cpu,
  ShieldCheck,
  Smartphone,
  Cable,
};

export function ModuleIcon({
  name,
  className = "h-4 w-4",
}: {
  name: PlatformModuleMeta["iconName"];
  className?: string;
}) {
  const Icon = ICON_MAP[name] ?? LayoutGrid;
  return <Icon className={className} />;
}
