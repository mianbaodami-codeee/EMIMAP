/**
 * 外部 URL 安全规范化与防 SSRF / 防伪协议注入工具
 * 供「常用网址导引」存储校验及后续「AI 资源检索」外部访问网关共同使用。
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
  "169.254.169.254",
]);

/**
 * 判断 IPv4 字面量是否属于内网/回环/链路本地保留地址段
 */
export function isPrivateOrReservedIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = nums as [number, number, number, number];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/**
 * 规范化并校验外部 HTTP/HTTPS 网址，拦截 javascript:/data: 等危险协议
 */
export function normalizeExternalHttpUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl.trim());
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("仅允许 http:// 或 https:// 协议");
  }
  if (parsed.username || parsed.password) {
    throw new Error("不允许在网址中嵌入认证凭据");
  }
  return parsed.toString();
}

/**
 * 校验服务端主动抓取目标是否为安全的公网地址（防 SSRF）
 */
export function assertSafeOutboundUrl(rawUrl: string): URL {
  const parsed = new URL(normalizeExternalHttpUrl(rawUrl));
  const host = parsed.hostname.toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    isPrivateOrReservedIpv4(host)
  ) {
    throw new Error("安全策略已拦截对本地或内网保留地址的访问");
  }
  return parsed;
}

/**
 * 规范化 AI 服务端点 Base URL（校验公网地址、拒绝查询串与锚点、剥离末尾斜杠），
 * 用于精确比对管理员可信端点与用户自定义端点。
 */
export function normalizeEndpointBaseUrl(rawUrl: string): string {
  const safe = assertSafeOutboundUrl(rawUrl);
  if (safe.search || safe.hash) {
    throw new Error("API Base URL 不允许包含查询参数或锚点片段");
  }
  const cleanPath = safe.pathname.replace(/\/+$/, "");
  return `${safe.origin}${cleanPath}`;
}

/**
 * 提取干净的站点主域名用于卡片展示（去除 www. 前缀）
 */
export function extractDomain(rawUrl: string): string {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return rawUrl;
  }
}

/**
 * 根据名称和随机后缀生成可读的唯一 slug
 */
export function buildCustomSiteSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "site"}-${suffix}`;
}
