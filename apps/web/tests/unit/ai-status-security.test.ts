import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/ai/status/route";

function makeJsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/ai/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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

  it("拦截未提供个人密钥却指定自定义 Base URL 的请求，绝不将服务器预置 OPENAI_API_KEY 发往外部地址", async () => {
    process.env.OPENAI_API_KEY = "sk-server-secret-do-not-leak";
    process.env.OPENAI_BASE_URL = "https://api.openai.com/v1";

    const fetchSpy = vi.spyOn(globalThis, "fetch");

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
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("拦截路径穿越伪造与管理员自定义可信网关不匹配的端点，确保预置密钥仅发往管理员配置地址", async () => {
    process.env.OPENAI_API_KEY = "sk-corp-gateway-secret";
    process.env.OPENAI_BASE_URL = "https://llm-gateway.corp.example.com/v1";

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ object: "list", data: [{ id: "gpt-4o-mini" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
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
    expect(fetchSpy).not.toHaveBeenCalled();

    // 2. 尝试通过 ../ 路径归一化绕过可信前缀必须拦截
    const traversalRes = await POST(
      makeJsonRequest({
        provider: "openai",
        baseUrl: "https://llm-gateway.corp.example.com/v1/../../hijack",
        model: "gpt-4o-mini",
      })
    );
    expect(traversalRes.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();

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
    expect(validJson.data.checkedEndpoint).toBe(
      "https://llm-gateway.corp.example.com/v1"
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "https://llm-gateway.corp.example.com/v1/models"
    );
  });

  it("openai_compatible 与带自定义端点的 gemini 请求严禁使用服务器预置密钥", async () => {
    process.env.OPENAI_API_KEY = "sk-server-openai-secret";
    process.env.GEMINI_API_KEY = "AIza-server-gemini-secret";

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // 即使兼容端点填写的是 api.openai.com，未传个人密钥也绝不可回退使用服务端密钥
    const compatRes = await POST(
      makeJsonRequest({
        provider: "openai_compatible",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      })
    );
    expect(compatRes.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();

    // Gemini 传入非官方自定义 baseUrl 必须立即拦截
    const geminiCustomRes = await POST(
      makeJsonRequest({
        provider: "gemini",
        baseUrl: "https://evil-gemini-proxy.example.com/v1beta",
        model: "gemini-2.5-flash",
      })
    );
    expect(geminiCustomRes.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("用户自定义端点配合个人 API Key 时仅发送用户密钥，绝不混入服务端预置密钥", async () => {
    process.env.OPENAI_API_KEY = "sk-server-must-stay-isolated";

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ object: "list", data: [{ id: "deepseek-chat" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
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

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0]!;
    expect(calledUrl).toBe("https://api.deepseek.example.com/v1/models");
    const headers = calledInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-user-personal-key-999");
    expect(JSON.stringify(calledInit)).not.toContain(
      "sk-server-must-stay-isolated"
    );
  });

  it("明确区分「服务端点可达 (endpointReachable)」与「具体模型可用 (modelAvailable)」", async () => {
    process.env.OPENAI_API_KEY = "sk-server-test-key";
    process.env.OPENAI_BASE_URL = "https://api.openai.com/v1";
    process.env.GEMINI_API_KEY = "AIza-server-test-key";

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (inputUrl) => {
        const url = String(inputUrl);
        if (url === "https://api.openai.com/v1/models") {
          return new Response(
            JSON.stringify({
              object: "list",
              data: [{ id: "gpt-4o-mini" }, { id: "gpt-4.1" }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (url.startsWith("https://api.openai.com/v1/models/")) {
          return new Response(JSON.stringify({ error: "not_found" }), {
            status: 404,
          });
        }
        if (url.includes("generativelanguage.googleapis.com")) {
          return new Response(JSON.stringify({ error: "model not found" }), {
            status: 404,
          });
        }
        return new Response("unexpected", { status: 500 });
      });

    // 1. OpenAI 端点可达，且模型存在
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

    // 2. OpenAI 端点可达，但填写的模型名称不存在
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

    // 3. Gemini 端点可达但模型 404，且密钥通过 x-goog-api-key 头发送而非 URL 查询串
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

    const geminiCall = fetchSpy.mock.calls.find((c) =>
      String(c[0]).includes("generativelanguage.googleapis.com")
    )!;
    expect(String(geminiCall[0])).not.toContain("AIza-server-test-key");
    expect(
      (geminiCall[1]?.headers as Record<string, string>)["x-goog-api-key"]
    ).toBe("AIza-server-test-key");
  });
});
