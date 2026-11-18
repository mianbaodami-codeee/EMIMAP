import type { LookupAddress } from "node:dns";
import dns from "node:dns/promises";
import https from "node:https";
import net from "node:net";
import {
  isBlockedOutboundHostname,
  isPublicIpAddress,
  stripIpv6Brackets,
} from "./safe-url";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export interface ResolvedIpRecord {
  address: string;
  family: 4 | 6;
}

export type DnsLookupAllFn = (hostname: string) => Promise<ResolvedIpRecord[]>;

export interface SafeHttpsResponse {
  status: number;
  contentType: string;
  body: string;
}

export class UpstreamSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamSecurityError";
  }
}

export class UpstreamTimeoutError extends Error {
  constructor(message = "连接上游模型服务超时") {
    super(message);
    this.name = "UpstreamTimeoutError";
  }
}

export const defaultDnsLookupAll: DnsLookupAllFn = async (hostname: string) => {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => ({
    address: r.address,
    family: r.family === 6 ? 6 : 4,
  }));
};

/**
 * 解析目标主机名的全部 IPv4/IPv6 记录，并严格校验所有解析地址均为公网单播地址。
 * 若任一解析记录落入内网、回环、链路本地、CGNAT 或其他保留地址段，立即拒绝。
 */
export async function resolveValidatedPublicAddresses(
  rawHostname: string,
  dnsLookup: DnsLookupAllFn = defaultDnsLookupAll
): Promise<ResolvedIpRecord[]> {
  const cleanHost = stripIpv6Brackets(rawHostname)
    .toLowerCase()
    .replace(/\.+$/, "");

  if (isBlockedOutboundHostname(cleanHost)) {
    throw new UpstreamSecurityError("安全策略已拦截对本地或内网保留地址的访问");
  }

  const literalFamily = net.isIP(cleanHost);
  if (literalFamily === 4 || literalFamily === 6) {
    return [{ address: cleanHost, family: literalFamily }];
  }

  const records = await dnsLookup(cleanHost);
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error(`无法解析服务端点域名: ${cleanHost}`);
  }

  for (const rec of records) {
    if (
      (rec.family !== 4 && rec.family !== 6) ||
      !isPublicIpAddress(rec.address)
    ) {
      throw new UpstreamSecurityError(
        `安全策略已拦截：服务端点域名解析结果包含非公网地址 (${rec.address})`
      );
    }
  }

  return records;
}

/**
 * 构造绑定至已校验公网 IP 列表的自定义 lookup 函数，
 * 阻止建连阶段再次发起系统 DNS 查询（消除 DNS Rebinding / TOCTOU 窗口）。
 */
export function createPinnedLookup(
  pinnedRecords: ResolvedIpRecord[]
): net.LookupFunction {
  if (
    pinnedRecords.length === 0 ||
    pinnedRecords.some((r) => !isPublicIpAddress(r.address))
  ) {
    throw new UpstreamSecurityError(
      "安全策略已拦截：建连绑定地址列表为空或包含非公网地址"
    );
  }

  return (_hostname, options, callback) => {
    const wantsAll =
      typeof options === "object" && options !== null && Boolean(options.all);

    if (wantsAll) {
      (
        callback as (
          err: NodeJS.ErrnoException | null,
          addresses: LookupAddress[]
        ) => void
      )(
        null,
        pinnedRecords.map((r) => ({ address: r.address, family: r.family }))
      );
      return;
    }

    const requestedFamily =
      typeof options === "number" ? options : options?.family || 0;
    const selected =
      (requestedFamily
        ? pinnedRecords.find((r) => r.family === requestedFamily)
        : undefined) ?? pinnedRecords[0]!;

    (
      callback as (
        err: NodeJS.ErrnoException | null,
        address: string,
        family: number
      ) => void
    )(null, selected.address, selected.family);
  };
}

export interface SecureHttpsGetOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  pinnedAddresses?: ResolvedIpRecord[];
  dnsLookup?: DnsLookupAllFn;
  requestImpl?: typeof https.request;
}

export interface SecureHttpsRequestOptions extends SecureHttpsGetOptions {
  method?: "GET" | "POST";
  body?: string;
}

/**
 * 发起安全受控的上游 HTTPS 请求（支持 GET / POST）：
 * 1. 强制仅允许 https:// 协议
 * 2. 禁止自动跟随任何 3xx HTTP 重定向
 * 3. 校验域名全部解析 IP 并通过自定义 lookup 绑定建连目标，且在 socket 建连时二次校验远端 IP
 */
export async function secureHttpsRequest(
  rawUrl: string,
  options: SecureHttpsRequestOptions = {}
): Promise<SafeHttpsResponse> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new UpstreamSecurityError("无效的上游请求 URL");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new UpstreamSecurityError(
      "安全策略已拦截：携带 API Key 的上游请求必须使用 HTTPS 协议"
    );
  }
  if (parsedUrl.username || parsedUrl.password) {
    throw new UpstreamSecurityError(
      "安全策略已拦截：不允许在上游 URL 中嵌入认证凭据"
    );
  }

  const cleanHost = stripIpv6Brackets(parsedUrl.hostname)
    .toLowerCase()
    .replace(/\.+$/, "");

  const pinned = options.pinnedAddresses
    ? options.pinnedAddresses
    : await resolveValidatedPublicAddresses(cleanHost, options.dnsLookup);

  if (pinned.length === 0 || pinned.some((r) => !isPublicIpAddress(r.address))) {
    throw new UpstreamSecurityError(
      "安全策略已拦截：建连目标地址未通过公网地址校验"
    );
  }

  const timeoutMs = options.timeoutMs ?? 8000;
  const requestFn = options.requestImpl ?? https.request;
  const pinnedLookup = createPinnedLookup(pinned);
  const method = options.method ?? "GET";
  const bodyBuffer =
    typeof options.body === "string" ? Buffer.from(options.body, "utf8") : null;

  return new Promise<SafeHttpsResponse>((resolve, reject) => {
    let settled = false;
    const finishError = (err: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error(String(err)));
    };
    const finishOk = (resp: SafeHttpsResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(resp);
    };

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...options.headers,
    };
    if (bodyBuffer) {
      headers["Content-Length"] = String(bodyBuffer.byteLength);
      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json; charset=utf-8";
      }
    }

    const req = requestFn(
      parsedUrl,
      {
        method,
        headers,
        agent: false,
        servername: net.isIP(cleanHost) ? undefined : cleanHost,
        lookup: pinnedLookup,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentTypeHeader = res.headers["content-type"];
        const contentType = Array.isArray(contentTypeHeader)
          ? contentTypeHeader.join("; ")
          : contentTypeHeader || "";

        // 严禁自动跟随任何 3xx 重定向，防止密钥泄露至重定向地址或绕过公网地址校验
        if (status >= 300 && status < 400) {
          res.resume();
          finishError(
            new UpstreamSecurityError(
              `安全策略已拦截：禁止自动跟随上游 HTTP 重定向（HTTP ${status}）`
            )
          );
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;

        res.on("data", (chunk: Buffer | string) => {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += buf.length;
          if (totalBytes > MAX_RESPONSE_BYTES) {
            req.destroy(new Error("上游响应体超出安全大小上限"));
            return;
          }
          chunks.push(buf);
        });

        res.on("end", () => {
          finishOk({
            status,
            contentType,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });

        res.on("error", finishError);
      }
    );

    const timer = setTimeout(() => {
      req.destroy(
        new UpstreamTimeoutError(
          `连接上游模型服务超时（> ${Math.round(timeoutMs / 1000)}s）`
        )
      );
    }, timeoutMs);

    req.on("socket", (socket) => {
      socket.once("connect", () => {
        if (socket.remoteAddress && !isPublicIpAddress(socket.remoteAddress)) {
          req.destroy(
            new UpstreamSecurityError(
              `安全策略已拦截：实际建立连接的目标地址 (${socket.remoteAddress}) 非公网地址`
            )
          );
        }
      });
    });

    req.on("error", finishError);
    if (bodyBuffer) {
      req.write(bodyBuffer);
    }
    req.end();
  });
}

export async function secureHttpsGet(
  rawUrl: string,
  options: SecureHttpsGetOptions = {}
): Promise<SafeHttpsResponse> {
  return secureHttpsRequest(rawUrl, { ...options, method: "GET" });
}

export async function secureHttpsPost(
  rawUrl: string,
  body: string,
  options: SecureHttpsGetOptions = {}
): Promise<SafeHttpsResponse> {
  return secureHttpsRequest(rawUrl, { ...options, method: "POST", body });
}

export const upstreamTransport = {
  dnsLookupAll: defaultDnsLookupAll,
  httpsGet: secureHttpsGet,
  httpsPost: secureHttpsPost,
  httpsRequest: secureHttpsRequest,
};


