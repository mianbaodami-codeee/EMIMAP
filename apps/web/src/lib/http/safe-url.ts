import net from "node:net";

/**
 * 外部 URL 安全规范化与防 SSRF / 防伪协议注入工具
 * 供「常用网址导引」存储校验、「AI 连接检查」及外部访问网关共同使用。
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
]);

/**
 * IANA / RFC 6890 / RFC 4193 / RFC 4291 非公网与特殊保留地址段黑名单
 * Node.js 内置 net.BlockList 原生支持 IPv4、IPv6 及 IPv4-mapped IPv6（如 ::ffff:127.0.0.1 / ::ffff:7f00:1）匹配。
 */
const NON_PUBLIC_IP_BLOCKLIST = (() => {
  const bl = new net.BlockList();

  // IPv4 私有、回环、链路本地、CGNAT、文档示例、基准测试、组播与保留网段
  bl.addSubnet("0.0.0.0", 8, "ipv4");
  bl.addSubnet("10.0.0.0", 8, "ipv4");
  bl.addSubnet("100.64.0.0", 10, "ipv4");
  bl.addSubnet("127.0.0.0", 8, "ipv4");
  bl.addSubnet("169.254.0.0", 16, "ipv4");
  bl.addSubnet("172.16.0.0", 12, "ipv4");
  bl.addSubnet("192.0.0.0", 24, "ipv4");
  bl.addSubnet("192.0.2.0", 24, "ipv4");
  bl.addSubnet("192.88.99.0", 24, "ipv4");
  bl.addSubnet("192.168.0.0", 16, "ipv4");
  bl.addSubnet("198.18.0.0", 15, "ipv4");
  bl.addSubnet("198.51.100.0", 24, "ipv4");
  bl.addSubnet("203.0.113.0", 24, "ipv4");
  bl.addSubnet("224.0.0.0", 4, "ipv4");
  bl.addSubnet("240.0.0.0", 4, "ipv4");

  // IPv6 未指定/回环/IPv4兼容(::/96)、NAT64、丢弃、Teredo、6to4、文档、ULA(fc00::/7)、链路本地(fe80::/10)与组播
  bl.addSubnet("::", 96, "ipv6");
  bl.addSubnet("::ffff:0:0:0", 96, "ipv6");
  bl.addSubnet("64:ff9b::", 96, "ipv6");
  bl.addSubnet("64:ff9b:1::", 48, "ipv6");
  bl.addSubnet("100::", 64, "ipv6");
  bl.addSubnet("2001::", 32, "ipv6");
  bl.addSubnet("2001:2::", 48, "ipv6");
  bl.addSubnet("2001:db8::", 32, "ipv6");
  bl.addSubnet("2001:10::", 28, "ipv6");
  bl.addSubnet("2001:20::", 28, "ipv6");
  bl.addSubnet("2002::", 16, "ipv6");
  bl.addSubnet("fc00::", 7, "ipv6");
  bl.addSubnet("fe80::", 10, "ipv6");
  bl.addSubnet("fec0::", 10, "ipv6");
  bl.addSubnet("ff00::", 8, "ipv6");

  return bl;
})();

export function stripIpv6Brackets(rawHost: string): string {
  const trimmed = rawHost.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * 判断给定 IPv4 / IPv6 字面量是否为可路由的公网单播地址
 */
export function isPublicIpAddress(rawIp: string): boolean {
  const clean = stripIpv6Brackets(rawIp).toLowerCase();
  if (!clean || clean.includes("%")) {
    return false;
  }
  const family = net.isIP(clean);
  if (family === 4) {
    return !NON_PUBLIC_IP_BLOCKLIST.check(clean, "ipv4");
  }
  if (family === 6) {
    return !NON_PUBLIC_IP_BLOCKLIST.check(clean, "ipv6");
  }
  return false;
}

/**
 * 判断 IPv4 字面量是否属于内网/回环/链路本地/保留地址段
 */
export function isPrivateOrReservedIpv4(host: string): boolean {
  const clean = stripIpv6Brackets(host).toLowerCase();
  if (net.isIP(clean) !== 4) return false;
  return !isPublicIpAddress(clean);
}

/**
 * 判断主机名是否属于本地回环、内部域名后缀或非公网字面量 IP
 */
export function isBlockedOutboundHostname(rawHost: string): boolean {
  const clean = stripIpv6Brackets(rawHost).toLowerCase().replace(/\.+$/, "");
  if (!clean || clean.includes("%")) {
    return true;
  }
  if (
    BLOCKED_HOSTNAMES.has(clean) ||
    clean.endsWith(".localhost") ||
    clean.endsWith(".local") ||
    clean.endsWith(".internal") ||
    clean.endsWith(".home.arpa")
  ) {
    return true;
  }
  if (net.isIP(clean) !== 0) {
    return !isPublicIpAddress(clean);
  }
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
  if (isBlockedOutboundHostname(parsed.hostname)) {
    throw new Error("安全策略已拦截对本地或内网保留地址的访问");
  }
  return parsed;
}

/**
 * 规范化携带 API Key 的 AI 服务端点 Base URL：
 * 1. 强制要求 https:// 协议（严禁通过明文 http:// 发送密钥）
 * 2. 拒绝嵌入认证凭据、查询参数与锚点片段
 * 3. 拦截本地主机名及非公网 IPv4 / IPv6 字面量
 */
export function normalizeEndpointBaseUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("URL 格式不合法");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("安全策略已拦截：携带 API Key 的服务端点必须使用 HTTPS 协议");
  }
  if (parsed.username || parsed.password) {
    throw new Error("安全策略已拦截：不允许在服务端点 URL 中嵌入认证凭据");
  }
  if (parsed.search || parsed.hash) {
    throw new Error("API Base URL 不允许包含查询参数或锚点片段");
  }
  if (isBlockedOutboundHostname(parsed.hostname)) {
    throw new Error("安全策略已拦截对本地或内网保留地址的访问");
  }
  const cleanPath = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin}${cleanPath}`;
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
