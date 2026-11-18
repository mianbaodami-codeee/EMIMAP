import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage } from "node:http";
import type https from "node:https";
import type net from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/ai/status/route";
import {
  secureHttpsGet,
  UpstreamSecurityError,
  UpstreamTimeoutError,
  upstreamTransport,
  type SafeHttpsResponse,
} from "@/lib/http/safe-upstream";

function makeJsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/ai/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function jsonResp(
  payload: unknown,
  status = 200,
  contentType = "application/json; charset=utf-8"
): SafeHttpsResponse {
  return {
    status,
    contentType,
    body: JSON.stringify(payload),
  };
}

/**
 * 构造可控的 https.request 模拟桩，用于精确测试自定义 lookup 绑定、Socket 远端 IP 校验及 3xx 重定向拦截
 */
function createMockHttpsRequestImpl(behavior: {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  remoteAddress?: string;
  hang?: boolean;
  onOptions?: (url: URL, options: https.RequestOptions) => void;
}): typeof https.request {
  return ((
    urlInput: string | URL,
    options: https.RequestOptions,
    callback?: (res: IncomingMessage) => void
  ) => {
    const parsed = typeof urlInput === "string" ? new URL(urlInput) : urlInput;
    behavior.onOptions?.(parsed, options);

    const reqEmitter = new EventEmitter() as ClientRequest;
    let destroyed = false;

    reqEmitter.destroy = ((err?: Error) => {
      if (!destroyed) {
        destroyed = true;
        if (err) {
          queueMicrotask(() => reqEmitter.emit("error", err));
        }
      }
      return reqEmitter;
    }) as ClientRequest["destroy"];

    reqEmitter.end = (() => {
      queueMicrotask(() => {
        // 触发真实流程中的 lookup 校验调用
        if (typeof options.lookup === "function") {
          options.lookup(parsed.hostname, { all: true }, () => {});
        }

        const fakeSocket = new EventEmitter() as net.Socket;
        Object.defineProperty(fakeSocket, "remoteAddress", {
          value: behavior.remoteAddress ?? "93.184.216.34",
          configurable: true,
        });
        reqEmitter.emit("socket", fakeSocket);
        fakeSocket.emit("connect");

        if (destroyed || behavior.hang) {
          return;
        }

        const resEmitter = new EventEmitter() as IncomingMessage;
        resEmitter.statusCode = behavior.status ?? 200;
        resEmitter.headers = behavior.headers ?? {
          "content-type": "application/json",
        };
        resEmitter.resume = () => resEmitter;

        callback?.(resEmitter);
        if (!destroyed) {
          if (behavior.body) {
            resEmitter.emit("data", Buffer.from(behavior.body, "utf8"));
          }
          resEmitter.emit("end");
        }
      });
      return reqEmitter;
    }) as ClientRequest["end"];

    return reqEmitter;
  }) as unknown as typeof https.request;
}

describe("AI 密钥与服务端点安全边界及模型可用性核验 (/api/ai/status)", () => {
  const originalOpenAIKey = process.env.OPENAI_API_KEY;
  const originalOpenAIBase = process.env.OPENAI_BASE_URL;
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAIKey;

    if (originalOpenAIBase === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = originalOpenAIBase;

    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiKey;
  });

  // =========================================================================
  // 第一轮已通过的核心密钥归属与端点隔离回归测试（保持 5 项完整覆盖）
  // =========================================================================

  it("拦截未提供个人密钥却指定自定义 Base URL 的请求，绝不将服务器预置 OPENAI_API_KEY 发往外部地址", async () => {
    process.env.OPENAI_API_KEY = "sk-server-secret-do-not-leak";
    process.env.OPENAI_BASE_URL = "https://api.openai.com/v1";

    const dnsSpy = vi.spyOn(upstreamTransport, "dnsLookupAll");
    const httpsSpy = vi.spyOn(upstreamTransport, "httpsGet");

    const res = await POST(
      makeJsonRequest({
        provider: "openai",
        baseUrl: "https://attacker-collector.example.com/v1",
        model: "gpt-4o-mini",
      })
    );

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("FORBIDDEN_OPERATION");
    expect(dnsSpy).not.toHaveBeenCalled();
    expect(httpsSpy).not.toHaveBeenCalled();
  });

  it("拦截路径穿越伪造与管理员自定义可信网关不匹配的端点，确保预置密钥仅发往管理员配置地址", async () => {
    process.env.OPENAI_API_KEY = "sk-corp-gateway-secret";
    process.env.OPENAI_BASE_URL = "https://llm-gateway.corp.example.com/v1";

    vi.spyOn(upstreamTransport, "dnsLookupAll").mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ]);
    const httpsSpy = vi
      .spyOn(upstreamTransport, "httpsGet")
      .mockResolvedValue(
        jsonResp({ object: "list", data: [{ id: "gpt-4o-mini" }] })
      );

    // 1. 尝试发往默认 api.openai.com（与管理员配置的 corp 网关不一致）必须拦截
    const mismatchRes = await POST(
      makeJsonRequest({
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      })
    );
    expect(mismatchRes.status).toBe(403);
    expect(httpsSpy).not.toHaveBeenCalled();

    // 2. 尝试通过 ../ 路径归一化绕过可信前缀必须拦截
    const traversalRes = await POST(
      makeJsonRequest({
        provider: "openai",
        baseUrl: "https://llm-gateway.corp.example.com/v1/../../hijack",
        model: "gpt-4o-mini",
      })
    );
    expect(traversalRes.status).toBe(403);
    expect(httpsSpy).not.toHaveBeenCalled();

    // 3. 留空 baseUrl 时应安全发往管理员配置的 https://llm-gateway.corp.example.com/v1/models
    const validRes = await POST(
      makeJsonRequest({
        provider: "openai",
        model: "gpt-4o-mini",
      })
    );
    expect(validRes.status).toBe(200);
    const validJson = await validRes.json();
    expect(validJson.ok).toBe(true);
    expect(validJson.data.keySource).toBe("server");
    expect(validJson.data.modelStatus).toBe("confirmed");
    expect(validJson.data.checkedEndpoint).toBe(
      "https://llm-gateway.corp.example.com/v1"
    );
    expect(httpsSpy).toHaveBeenCalledTimes(1);
    expect(httpsSpy.mock.calls[0]?.[0]).toBe(
      "https://llm-gateway.corp.example.com/v1/models"
    );
  });

  it("openai_compatible 与带自定义端点的 gemini 请求严禁使用服务器预置密钥", async () => {
    process.env.OPENAI_API_KEY = "sk-server-openai-secret";
    process.env.GEMINI_API_KEY = "AIza-server-gemini-secret";

    const httpsSpy = vi.spyOn(upstreamTransport, "httpsGet");

    const compatRes = await POST(
      makeJsonRequest({
        provider: "openai_compatible",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      })
    );
    expect(compatRes.status).toBe(403);
    expect(httpsSpy).not.toHaveBeenCalled();

    const geminiCustomRes = await POST(
      makeJsonRequest({
        provider: "gemini",
        baseUrl: "https://evil-gemini-proxy.example.com/v1beta",
        model: "gemini-2.5-flash",
      })
    );
    expect(geminiCustomRes.status).toBe(403);
    expect(httpsSpy).not.toHaveBeenCalled();
  });

  it("用户自定义端点配合个人 API Key 时仅发送用户密钥，绝不混入服务端预置密钥", async () => {
    process.env.OPENAI_API_KEY = "sk-server-must-stay-isolated";

    vi.spyOn(upstreamTransport, "dnsLookupAll").mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ]);
    const httpsSpy = vi
      .spyOn(upstreamTransport, "httpsGet")
      .mockResolvedValue(
        jsonResp({ object: "list", data: [{ id: "deepseek-chat" }] })
      );

    const res = await POST(
      makeJsonRequest({
        provider: "openai_compatible",
        apiKey: "sk-user-personal-key-999",
        baseUrl: "https://api.deepseek.example.com/v1/",
        model: "deepseek-chat",
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.keySource).toBe("user");
    expect(json.data.endpointReachable).toBe(true);
    expect(json.data.modelAvailable).toBe(true);
    expect(json.data.modelStatus).toBe("confirmed");

    expect(httpsSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOpts] = httpsSpy.mock.calls[0]!;
    expect(calledUrl).toBe("https://api.deepseek.example.com/v1/models");
    expect(calledOpts?.headers?.Authorization).toBe(
      "Bearer sk-user-personal-key-999"
    );
    expect(JSON.stringify(calledOpts)).not.toContain(
      "sk-server-must-stay-isolated"
    );
  });

  it("明确区分「服务端点可达 (endpointReachable)」与「具体模型可用 (modelAvailable / modelStatus)」", async () => {
    process.env.OPENAI_API_KEY = "sk-server-test-key";
    process.env.OPENAI_BASE_URL = "https://api.openai.com/v1";
    process.env.GEMINI_API_KEY = "AIza-server-test-key";

    vi.spyOn(upstreamTransport, "dnsLookupAll").mockResolvedValue([
      { address: "104.18.32.47", family: 4 },
    ]);
    const httpsSpy = vi
      .spyOn(upstreamTransport, "httpsGet")
      .mockImplementation(async (inputUrl) => {
        if (inputUrl === "https://api.openai.com/v1/models") {
          return jsonResp({
            object: "list",
            data: [{ id: "gpt-4o-mini" }, { id: "gpt-4.1" }],
          });
        }
        if (inputUrl.startsWith("https://api.openai.com/v1/models/")) {
          return jsonResp({ error: "not_found" }, 404);
        }
        if (inputUrl.includes("generativelanguage.googleapis.com")) {
          return jsonResp({ error: "model not found" }, 404);
        }
        return jsonResp({ error: "unexpected" }, 500);
      });

    // 1. OpenAI 端点有效且模型元数据匹配 -> confirmed
    const okModelRes = await POST(
      makeJsonRequest({
        provider: "openai",
        model: "gpt-4o-mini",
      })
    );
    const okModelJson = await okModelRes.json();
    expect(okModelJson.ok).toBe(true);
    expect(okModelJson.data.endpointReachable).toBe(true);
    expect(okModelJson.data.modelAvailable).toBe(true);
    expect(okModelJson.data.modelStatus).toBe("confirmed");

    // 2. OpenAI 端点有效，但模型查询明确返回 404 -> not_found
    const missingModelRes = await POST(
      makeJsonRequest({
        provider: "openai",
        model: "gpt-nonexistent-2099",
      })
    );
    const missingModelJson = await missingModelRes.json();
    expect(missingModelJson.ok).toBe(true);
    expect(missingModelJson.data.endpointReachable).toBe(true);
    expect(missingModelJson.data.modelAvailable).toBe(false);
    expect(missingModelJson.data.modelStatus).toBe("not_found");

    // 3. Gemini 模型查询明确返回 404 -> not_found，且密钥通过请求头发送
    const geminiMissingRes = await POST(
      makeJsonRequest({
        provider: "gemini",
        model: "gemini-nonexistent-model",
      })
    );
    const geminiMissingJson = await geminiMissingRes.json();
    expect(geminiMissingJson.ok).toBe(true);
    expect(geminiMissingJson.data.endpointReachable).toBe(true);
    expect(geminiMissingJson.data.modelAvailable).toBe(false);
    expect(geminiMissingJson.data.modelStatus).toBe("not_found");

    const geminiCall = httpsSpy.mock.calls.find((c) =>
      c[0].includes("generativelanguage.googleapis.com")
    )!;
    expect(geminiCall[0]).not.toContain("AIza-server-test-key");
    expect(geminiCall[1]?.headers?.["x-goog-api-key"]).toBe(
      "AIza-server-test-key"
    );
  });

  // =========================================================================
  // 第二轮新增回归测试（问题 1）：HTTPS 强制、非公网 IP/DNS 拦截、建连 IP 绑定与重定向拦截
  // =========================================================================

  it("强制 HTTPS：拒绝所有明文 http:// 服务端点（含个人密钥自定义端点与服务端配置），禁止明文外发密钥", async () => {
    const dnsSpy = vi.spyOn(upstreamTransport, "dnsLookupAll");
    const httpsSpy = vi.spyOn(upstreamTransport, "httpsGet");

    // 1. 用户自定义端点使用 http:// 必须拒绝
    const userHttpRes = await POST(
      makeJsonRequest({
        provider: "openai_compatible",
        apiKey: "sk-user-secret",
        baseUrl: "http://plain-http-llm.example.com/v1",
        model: "gpt-4o-mini",
      })
    );
    expect(userHttpRes.status).toBe(403);
    const userHttpJson = await userHttpRes.json();
    expect(userHttpJson.ok).toBe(false);
    expect(userHttpJson.error.code).toBe("FORBIDDEN_OPERATION");
    expect(userHttpJson.error.message).toContain("HTTPS");

    // 2. 管理员若误将 OPENAI_BASE_URL 配为 http:// 同样拒绝外发服务端密钥
    process.env.OPENAI_API_KEY = "sk-server-secret";
    process.env.OPENAI_BASE_URL = "http://insecure-internal-proxy.example.com/v1";
    const envHttpRes = await POST(
      makeJsonRequest({
        provider: "openai",
        model: "gpt-4o-mini",
      })
    );
    expect(envHttpRes.status).toBe(403);
    expect(dnsSpy).not.toHaveBeenCalled();
    expect(httpsSpy).not.toHaveBeenCalled();

    // 3. 底层传输函数直接调用 http:// 同样抛安全异常
    await expect(
      secureHttpsGet("http://example.com/v1/models")
    ).rejects.toBeInstanceOf(UpstreamSecurityError);
  });

  it("拦截非公网字面量 IP（IPv4/IPv6/IPv4-mapped）及域名解析结果中混入任一非公网地址的端点", async () => {
    const httpsSpy = vi.spyOn(upstreamTransport, "httpsGet");

    // 1. 各类非公网字面量地址（回环、私网、链路本地元数据、CGNAT、IPv6 ULA/链路本地/IPv4映射）
    const nonPublicUrls = [
      "https://localhost/v1",
      "https://127.0.0.1/v1",
      "https://10.0.0.8/v1",
      "https://172.16.10.2/v1",
      "https://192.168.1.100/v1",
      "https://169.254.169.254/latest",
      "https://100.64.1.1/v1",
      "https://[::1]/v1",
      "https://[::ffff:127.0.0.1]/v1",
      "https://[fc00::1]/v1",
      "https://[fe80::1]/v1",
      "https://gateway.internal/v1",
    ];

    for (const badUrl of nonPublicUrls) {
      const res = await POST(
        makeJsonRequest({
          provider: "openai_compatible",
          apiKey: "sk-user-key",
          baseUrl: badUrl,
          model: "gpt-4o-mini",
        })
      );
      expect(res.status, `预期拦截非公网地址: ${badUrl}`).toBe(403);
    }
    expect(httpsSpy).not.toHaveBeenCalled();

    // 2. 自定义域名 DNS 解析返回单一内网 IP -> 拒绝
    const dnsSpy = vi
      .spyOn(upstreamTransport, "dnsLookupAll")
      .mockResolvedValueOnce([{ address: "10.12.34.56", family: 4 }]);

    const singlePrivateDnsRes = await POST(
      makeJsonRequest({
        provider: "openai_compatible",
        apiKey: "sk-user-key",
        baseUrl: "https://internal-alias.example.com/v1",
        model: "gpt-4o-mini",
      })
    );
    expect(singlePrivateDnsRes.status).toBe(403);
    expect(httpsSpy).not.toHaveBeenCalled();

    // 3. 自定义域名 DNS 轮询返回「1 个公网 IP + 1 个内网/回环 IP」混合记录 -> 必须校验全部 IP 并拒绝
    dnsSpy.mockResolvedValueOnce([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);

    const mixedDnsRes = await POST(
      makeJsonRequest({
        provider: "openai_compatible",
        apiKey: "sk-user-key",
        baseUrl: "https://round-robin-rebind.example.com/v1",
        model: "gpt-4o-mini",
      })
    );
    expect(mixedDnsRes.status).toBe(403);
    expect(httpsSpy).not.toHaveBeenCalled();

    // 4. IPv6 混合记录（公网 IPv6 + ::1 回环）同样拒绝
    dnsSpy.mockResolvedValueOnce([
      { address: "2606:4700:4700::1111", family: 6 },
      { address: "::1", family: 6 },
    ]);

    const mixedV6Res = await POST(
      makeJsonRequest({
        provider: "openai_compatible",
        apiKey: "sk-user-key",
        baseUrl: "https://dualstack-rebind.example.com/v1",
        model: "gpt-4o-mini",
      })
    );
    expect(mixedV6Res.status).toBe(403);
    expect(httpsSpy).not.toHaveBeenCalled();
  });

  it("建连目标地址绑定（防 DNS Rebinding / TOCTOU）：仅解析一次并将自定义 lookup 与 Socket 锁定在已验证公网 IP", async () => {
    // 模拟恶意权威 DNS：第一次查询返回公网 IP，若发生第二次查询则翻转为 127.0.0.1
    let dnsQueryCount = 0;
    const rebindingDns = vi.fn(async () => {
      dnsQueryCount += 1;
      if (dnsQueryCount === 1) {
        return [{ address: "93.184.216.34", family: 4 as const }];
      }
      return [{ address: "127.0.0.1", family: 4 as const }];
    });

    let capturedOptions: https.RequestOptions | undefined;
    const mockReqImpl = createMockHttpsRequestImpl({
      status: 200,
      remoteAddress: "93.184.216.34",
      body: JSON.stringify({ object: "list", data: [{ id: "gpt-4o-mini" }] }),
      onOptions: (_url, opts) => {
        capturedOptions = opts;
      },
    });

    const resp = await secureHttpsGet("https://rebind-test.example.com/v1/models", {
      headers: { Authorization: "Bearer sk-user-test" },
      dnsLookup: rebindingDns,
      requestImpl: mockReqImpl,
    });

    expect(resp.status).toBe(200);
    expect(dnsQueryCount).toBe(1);
    expect(capturedOptions?.agent).toBe(false);
    expect(capturedOptions?.servername).toBe("rebind-test.example.com");

    // 验证传给 https.request 的 lookup 严格返回已锁定的 93.184.216.34，绝不触发第二次 DNS 查询
    const pinnedAll = await new Promise<unknown>((resolve, reject) => {
      capturedOptions!.lookup!("rebind-test.example.com", { all: true }, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
    expect(pinnedAll).toEqual([{ address: "93.184.216.34", family: 4 }]);
    expect(dnsQueryCount).toBe(1);

    // 若底层 Socket 实际建连远端地址被篡改为非公网地址（如 127.0.0.1），必须立即销毁连接
    const tamperedSocketReqImpl = createMockHttpsRequestImpl({
      status: 200,
      remoteAddress: "127.0.0.1",
      body: JSON.stringify({ object: "list", data: [{ id: "gpt-4o-mini" }] }),
    });
    await expect(
      secureHttpsGet("https://rebind-test.example.com/v1/models", {
        dnsLookup: async () => [{ address: "93.184.216.34", family: 4 }],
        requestImpl: tamperedSocketReqImpl,
      })
    ).rejects.toBeInstanceOf(UpstreamSecurityError);
  });

  it("禁止自动跟随 HTTP 重定向（301 / 302 / 307 / 308），绝不向重定向 Location 发送第二次请求或泄露密钥", async () => {
    vi.spyOn(upstreamTransport, "dnsLookupAll").mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ]);

    for (const redirectStatus of [301, 302, 307, 308]) {
      let requestCount = 0;
      const redirectReqImpl = createMockHttpsRequestImpl({
        status: redirectStatus,
        headers: {
          location: "http://169.254.169.254/latest/meta-data/iam",
        },
        onOptions: () => {
          requestCount += 1;
        },
      });

      vi.spyOn(upstreamTransport, "httpsGet").mockImplementation((url, opts) =>
        secureHttpsGet(url, { ...opts, requestImpl: redirectReqImpl })
      );

      const res = await POST(
        makeJsonRequest({
          provider: "openai_compatible",
          apiKey: "sk-user-do-not-redirect",
          baseUrl: "https://redirect-trap.example.com/v1",
          model: "gpt-4o-mini",
        })
      );

      expect(res.status, `HTTP ${redirectStatus} 重定向必须拦截`).toBe(403);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe("FORBIDDEN_OPERATION");
      expect(json.error.message).toContain(String(redirectStatus));
      expect(requestCount).toBe(1);
    }
  });

  // =========================================================================
  // 第二轮新增回归测试（问题 2）：三态模型检查结果（confirmed / not_found / unverifiable）
  // =========================================================================

  it("普通 HTML 网页返回 HTTP 200、无效 JSON 或非预期 JSON 结构时，不得视为鉴权成功，必须归类为 unverifiable", async () => {
    vi.spyOn(upstreamTransport, "dnsLookupAll").mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ]);

    // 1. 普通网站返回 HTTP 200 + HTML 页面
    const httpsSpy = vi.spyOn(upstreamTransport, "httpsGet").mockResolvedValueOnce({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<!DOCTYPE html><html><head><title>Welcome</title></head><body>Hello</body></html>",
    });

    const htmlRes = await POST(
      makeJsonRequest({
        provider: "openai_compatible",
        apiKey: "sk-user-key",
        baseUrl: "https://ordinary-website.example.com/v1",
        model: "gpt-4o-mini",
      })
    );
    expect(htmlRes.status).toBe(200);
    const htmlJson = await htmlRes.json();
    expect(htmlJson.ok).toBe(true);
    expect(htmlJson.data.endpointReachable).toBe(false);
    expect(htmlJson.data.reachable).toBe(false);
    expect(htmlJson.data.modelAvailable).toBe(false);
    expect(htmlJson.data.modelStatus).toBe("unverifiable");
    // 首个 /models 既已识别为非 API HTML，不应继续无意义请求 /models/{id}
    expect(httpsSpy).toHaveBeenCalledTimes(1);

    // 2. 返回无效 JSON 文本
    httpsSpy.mockResolvedValueOnce({
      status: 200,
      contentType: "application/json",
      body: "{broken-json-payload",
    });
    const badJsonRes = await POST(
      makeJsonRequest({
        provider: "openai_compatible",
        apiKey: "sk-user-key",
        baseUrl: "https://broken-json.example.com/v1",
        model: "gpt-4o-mini",
      })
    );
    const badJson = await badJsonRes.json();
    expect(badJson.data.endpointReachable).toBe(false);
    expect(badJson.data.modelStatus).toBe("unverifiable");

    // 3. 返回普通 JSON 对象但不符合模型列表结构（如 {"ok":true}）
    httpsSpy.mockResolvedValueOnce(jsonResp({ ok: true, greeting: "hi" }, 200));
    const wrongSchemaRes = await POST(
      makeJsonRequest({
        provider: "openai_compatible",
        apiKey: "sk-user-key",
        baseUrl: "https://generic-api.example.com/v1",
        model: "gpt-4o-mini",
      })
    );
    const wrongSchemaJson = await wrongSchemaRes.json();
    expect(wrongSchemaJson.data.endpointReachable).toBe(false);
    expect(wrongSchemaJson.data.modelStatus).toBe("unverifiable");

    // 4. Gemini 返回 HTTP 200 HTML 页面或不匹配模型元数据同样不得判为 confirmed
    process.env.GEMINI_API_KEY = "AIza-gemini-test";
    httpsSpy.mockResolvedValueOnce({
      status: 200,
      contentType: "text/html",
      body: "<html><body>Gateway Portal</body></html>",
    });
    const geminiHtmlRes = await POST(
      makeJsonRequest({
        provider: "gemini",
        model: "gemini-2.5-flash",
      })
    );
    const geminiHtmlJson = await geminiHtmlRes.json();
    expect(geminiHtmlJson.data.endpointReachable).toBe(false);
    expect(geminiHtmlJson.data.modelAvailable).toBe(false);
    expect(geminiHtmlJson.data.modelStatus).toBe("unverifiable");
  });

  it("超时、HTTP 503 等服务端异常必须归类为 unverifiable（无法确认），不得误判为模型名称错误（not_found）", async () => {
    vi.spyOn(upstreamTransport, "dnsLookupAll").mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ]);
    const httpsSpy = vi.spyOn(upstreamTransport, "httpsGet");

    // 1. /models 直接返回 503 Service Unavailable
    httpsSpy.mockResolvedValueOnce(
      jsonResp({ error: { message: "overloaded" } }, 503)
    );
    const res503 = await POST(
      makeJsonRequest({
        provider: "openai_compatible",
        apiKey: "sk-user-key",
        baseUrl: "https://overloaded.example.com/v1",
        model: "gpt-4o-mini",
      })
    );
    const json503 = await res503.json();
    expect(json503.ok).toBe(true);
    expect(json503.data.endpointReachable).toBe(false);
    expect(json503.data.modelAvailable).toBe(false);
    expect(json503.data.modelStatus).toBe("unverifiable");

    // 2. 上游连接超时
    httpsSpy.mockRejectedValueOnce(new UpstreamTimeoutError("连接超时"));
    const timeoutRes = await POST(
      makeJsonRequest({
        provider: "openai_compatible",
        apiKey: "sk-user-key",
        baseUrl: "https://slow-gateway.example.com/v1",
        model: "gpt-4o-mini",
      })
    );
    const timeoutJson = await timeoutRes.json();
    expect(timeoutJson.ok).toBe(true);
    expect(timeoutJson.data.endpointReachable).toBe(false);
    expect(timeoutJson.data.modelStatus).toBe("unverifiable");

    // 3. 关键边界：/models 列表正常返回 200（未含微调模型），但二次查询 /models/{model} 返回 503 或超时
    // 此时端点虽可达，但模型状态必须是 unverifiable，绝不能把 503 误判成 not_found！
    httpsSpy
      .mockResolvedValueOnce(
        jsonResp({ object: "list", data: [{ id: "gpt-4o-mini" }] }, 200)
      )
      .mockResolvedValueOnce(
        jsonResp({ error: { message: "backend unavailable" } }, 503)
      );

    const secondary503Res = await POST(
      makeJsonRequest({
        provider: "openai_compatible",
        apiKey: "sk-user-key",
        baseUrl: "https://partial-outage.example.com/v1",
        model: "ft:gpt-4o-mini:custom-job",
      })
    );
    const secondary503Json = await secondary503Res.json();
    expect(secondary503Json.ok).toBe(true);
    expect(secondary503Json.data.endpointReachable).toBe(true);
    expect(secondary503Json.data.modelAvailable).toBe(false);
    expect(secondary503Json.data.modelStatus).toBe("unverifiable");

    // 4. HTML 404（例如反向代理路径配错返回 Nginx HTML 404）也必须归为 unverifiable 而非模型 not_found
    process.env.GEMINI_API_KEY = "AIza-gemini-test";
    httpsSpy.mockResolvedValueOnce({
      status: 404,
      contentType: "text/html",
      body: "<html><head><title>404 Not Found</title></head><body>nginx</body></html>",
    });
    const html404Res = await POST(
      makeJsonRequest({
        provider: "gemini",
        model: "gemini-2.5-flash",
      })
    );
    const html404Json = await html404Res.json();
    expect(html404Json.data.endpointReachable).toBe(false);
    expect(html404Json.data.modelStatus).toBe("unverifiable");
  });

  it("当上游返回有效模型元数据且名称精确匹配时，OpenAI 单模型接口与 Gemini 模型接口均准确返回 confirmed", async () => {
    process.env.GEMINI_API_KEY = "AIza-gemini-valid";
    vi.spyOn(upstreamTransport, "dnsLookupAll").mockResolvedValue([
      { address: "142.250.190.42", family: 4 },
    ]);
    const httpsSpy = vi.spyOn(upstreamTransport, "httpsGet");

    // 1. Gemini 返回匹配 name: "models/gemini-2.5-flash" 的有效 JSON
    httpsSpy.mockResolvedValueOnce(
      jsonResp({
        name: "models/gemini-2.5-flash",
        displayName: "Gemini 2.5 Flash",
      })
    );
    const geminiOkRes = await POST(
      makeJsonRequest({
        provider: "gemini",
        model: "gemini-2.5-flash",
      })
    );
    const geminiOkJson = await geminiOkRes.json();
    expect(geminiOkJson.ok).toBe(true);
    expect(geminiOkJson.data.endpointReachable).toBe(true);
    expect(geminiOkJson.data.modelAvailable).toBe(true);
    expect(geminiOkJson.data.modelStatus).toBe("confirmed");

    // 2. OpenAI /models 分页未列出，但 /models/{id} 返回精确匹配 id 的模型元数据 -> confirmed
    httpsSpy
      .mockResolvedValueOnce(
        jsonResp({ object: "list", data: [{ id: "gpt-4o-mini" }] })
      )
      .mockResolvedValueOnce(
        jsonResp({ id: "ft:gpt-4o-mini:org:v1", object: "model", owned_by: "org" })
      );

    const fineTuneOkRes = await POST(
      makeJsonRequest({
        provider: "openai_compatible",
        apiKey: "sk-user-key",
        baseUrl: "https://api.custom-llm.example.com/v1",
        model: "ft:gpt-4o-mini:org:v1",
      })
    );
    const fineTuneOkJson = await fineTuneOkRes.json();
    expect(fineTuneOkJson.ok).toBe(true);
    expect(fineTuneOkJson.data.endpointReachable).toBe(true);
    expect(fineTuneOkJson.data.modelAvailable).toBe(true);
    expect(fineTuneOkJson.data.modelStatus).toBe("confirmed");
  });
});
