import React from "react";
import {
  CheckCircle2,
  ExternalLink,
  HardDrive,
  Sparkles,
} from "lucide-react";
import { PROVENANCE_META, type ProvenanceKind } from "@omnikit/shared";

const STYLE_MAP: Record<
  ProvenanceKind,
  {
    style: React.CSSProperties;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  measured: {
    style: {
      color: "var(--status-measured-fg)",
      backgroundColor: "var(--status-measured-bg)",
      borderColor: "var(--status-measured-border)",
    },
    Icon: CheckCircle2,
  },
  web_verified: {
    style: {
      color: "var(--status-verified-fg)",
      backgroundColor: "var(--status-verified-bg)",
      borderColor: "var(--status-verified-border)",
    },
    Icon: ExternalLink,
  },
  ai_inferred: {
    style: {
      color: "var(--status-inferred-fg)",
      backgroundColor: "var(--status-inferred-bg)",
      borderColor: "var(--status-inferred-border)",
    },
    Icon: Sparkles,
  },
  native_only: {
    style: {
      color: "var(--status-native-fg)",
      backgroundColor: "var(--status-native-bg)",
      borderColor: "var(--status-native-border)",
    },
    Icon: HardDrive,
  },
};

export function ProvenanceBadge({
  kind,
  customLabel,
  compact = false,
}: {
  kind: ProvenanceKind;
  customLabel?: string;
  compact?: boolean;
}) {
  const meta = PROVENANCE_META[kind];
  const { style, Icon } = STYLE_MAP[kind];
  const text = customLabel || (compact ? meta.shortLabel : meta.label);

  return (
    <span
      style={style}
      title={meta.description}
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium leading-none select-none shrink-0"
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span>{text}</span>
    </span>
  );
}
