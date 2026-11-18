/**
 * 全站统一的「数据可信度与执行域」标识规范
 * 用于严格区分真实测量/权威地理数据、公开联网核验信息、大模型推理结论与原生客户端专属能力。
 */

export type ProvenanceKind =
  | "measured"
  | "web_verified"
  | "ai_inferred"
  | "native_only";

export interface ProvenanceDescriptor {
  kind: ProvenanceKind;
  label: string;
  shortLabel: string;
  description: string;
}

export const PROVENANCE_META: Record<ProvenanceKind, ProvenanceDescriptor> = {
  measured: {
    kind: "measured",
    label: "实测 / 权威数据",
    shortLabel: "实测数据",
    description:
      "来自浏览器标准硬件/网络接口实测、OpenStreetMap 权威地理库或原生客户端底层传感器读取的数据。",
  },
  web_verified: {
    kind: "web_verified",
    label: "公开联网核验",
    shortLabel: "联网核验",
    description:
      "来自公开互联网检索、官方软件仓库或第三方公开路由/信誉数据库，附带可核查来源链接与时间。",
  },
  ai_inferred: {
    kind: "ai_inferred",
    label: "AI 综合推断",
    shortLabel: "AI 推断",
    description:
      "由所选大语言模型基于上下文综合分析生成，仅供参考，不替代实测参数或官方文档。",
  },
  native_only: {
    kind: "native_only",
    label: "需原生客户端",
    shortLabel: "原生端能力",
    description:
      "受操作系统与浏览器安全沙盒限制，该能力必须通过本地运行的「基米大师」或原生移动工具执行。",
  },
};
