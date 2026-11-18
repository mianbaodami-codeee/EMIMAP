import { beforeAll, describe, expect, it } from "vitest";
import { CreateCustomSiteSchema } from "@omnikit/shared";
import {
  assertSafeOutboundUrl,
  extractDomain,
  normalizeExternalHttpUrl,
} from "@/lib/http/safe-url";
import { getCacheStore } from "@/lib/cache/store";
import {
  createCustomSite,
  deleteCustomSite,
  HubServiceError,
  importCustomSites,
  listHubSites,
  updateSiteForClient,
} from "@/lib/hub/service";

beforeAll(() => {
  process.env.DATABASE_URL = "memory://";
  process.env.REDIS_URL = "";
});

describe("URL 安全校验与防 SSRF 网关基础工具", () => {
  it("允许合法的 HTTPS/HTTP 外部链接并准确提取主域名", () => {
    const normalized = normalizeExternalHttpUrl("https://www.playstation.com/zh-hans-cn/");
    expect(normalized).toBe("https://www.playstation.com/zh-hans-cn/");
    expect(extractDomain(normalized)).toBe("playstation.com");
  });

  it("严格拦截 javascript:/data: 等危险伪协议以及内嵌凭据链接", () => {
    expect(() => normalizeExternalHttpUrl("javascript:alert(1)")).toThrow();
    expect(() =>
      normalizeExternalHttpUrl("data:text/html,<script>alert(1)</script>")
    ).toThrow();
    expect(() =>
      normalizeExternalHttpUrl("https://user:pass@example.com/")
    ).toThrow();

    const parsed = CreateCustomSiteSchema.safeParse({
      name: "危险测试",
      url: "javascript:void(0)",
      category: "custom",
      description: "不应通过校验",
    });
    expect(parsed.success).toBe(false);
  });

  it("服务端主动抓取校验器应拦截本地回环与内网保留地址段 (SSRF 防护)", () => {
    expect(() => assertSafeOutboundUrl("http://127.0.0.1:8080/admin")).toThrow();
    expect(() => assertSafeOutboundUrl("http://localhost:3000/api")).toThrow();
    expect(() => assertSafeOutboundUrl("http://169.254.169.254/latest")).toThrow();
    expect(() => assertSafeOutboundUrl("http://192.168.1.10/config")).toThrow();
    expect(() => assertSafeOutboundUrl("http://10.0.0.5/internal")).toThrow();
    expect(assertSafeOutboundUrl("https://api.openai.com/v1").hostname).toBe(
      "api.openai.com"
    );
  });
});

describe("统一缓存与速率限制适配器 (Memory LRU 模式)", () => {
  it("支持键值读写与滑动窗口计数限流", async () => {
    const cache = getCacheStore();
    expect(cache.driver).toBe("memory-lru");

    await cache.set("unit:key", { ok: true, count: 42 }, 30);
    const val = await cache.get<{ ok: boolean; count: number }>("unit:key");
    expect(val).toEqual({ ok: true, count: 42 });

    const r1 = await cache.checkRateLimit("unit:rl", 2, 60);
    const r2 = await cache.checkRateLimit("unit:rl", 2, 60);
    const r3 = await cache.checkRateLimit("unit:rl", 2, 60);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
  });
});

describe("常用网址导引 (PostgreSQL / PGlite) 领域服务闭环", () => {
  const clientA = "wk_unit_test_client_alpha";
  const clientB = "wk_unit_test_client_bravo";

  it("包含全部 10 个需求必选初始站点及扩展权威站点", async () => {
    const res = await listHubSites({ clientId: clientA });
    expect(res.stats.builtinCount).toBeGreaterThanOrEqual(24);

    const slugs = new Set(res.items.map((i) => i.slug));
    const requiredSlugs = [
      "steam",
      "playstation",
      "xbox",
      "epic-games",
      "github",
      "openai",
      "google-gemini",
      "google-developers",
      "microsoft",
      "android-developers",
    ];
    for (const reqSlug of requiredSlugs) {
      expect(slugs.has(reqSlug)).toBe(true);
    }
  });

  it("支持收藏内置站点、创建/编辑/删除自定义网址，且隔离不同访客工作区", async () => {
    const initial = await listHubSites({ clientId: clientA });
    const steam = initial.items.find((x) => x.slug === "steam")!;
    expect(steam.isFavorite).toBe(false);

    // 1. 收藏内置站点 Steam
    const favSteam = await updateSiteForClient(clientA, steam.id, {
      isFavorite: true,
    });
    expect(favSteam.isFavorite).toBe(true);

    // 2. 尝试篡改或删除系统内置官方站点应当被拒绝
    await expect(
      updateSiteForClient(clientA, steam.id, { name: "Fake Steam" })
    ).rejects.toBeInstanceOf(HubServiceError);
    await expect(deleteCustomSite(clientA, steam.id)).rejects.toBeInstanceOf(
      HubServiceError
    );

    // 3. 创建自定义网址
    const custom = await createCustomSite(clientA, {
      name: "Crates.io",
      url: "https://crates.io",
      category: "dev",
      description: "Rust 社区官方包注册中心",
      tags: ["Rust", "Crates"],
    });
    expect(custom.isBuiltin).toBe(false);
    expect(custom.domain).toBe("crates.io");

    // 4. 另一访客 clientB 不应看到 clientA 的自定义站点或收藏状态
    const clientBList = await listHubSites({ clientId: clientB });
    expect(clientBList.items.some((x) => x.id === custom.id)).toBe(false);
    expect(
      clientBList.items.find((x) => x.slug === "steam")?.isFavorite
    ).toBe(false);

    // 5. 编辑并最终删除自定义站点
    const edited = await updateSiteForClient(clientA, custom.id, {
      name: "Rust Crates Registry",
      isFavorite: true,
    });
    expect(edited.name).toBe("Rust Crates Registry");
    expect(edited.isFavorite).toBe(true);

    const deleted = await deleteCustomSite(clientA, custom.id);
    expect(deleted.deletedId).toBe(custom.id);
  });

  it("支持按相同 URL 自动去重批量导入自定义书签", async () => {
    const summary = await importCustomSites(clientA, [
      {
        name: "Protomaps",
        url: "https://protomaps.com",
        category: "hardware_net",
        description: "开源单文件矢量地图瓦片方案",
        tags: ["PMTiles"],
      },
      {
        name: "Protomaps Duplicate",
        url: "https://protomaps.com/",
        category: "hardware_net",
        description: "重复链接应被自动跳过",
        tags: [],
      },
    ]);
    expect(summary.importedCount).toBe(1);
    expect(summary.skippedCount).toBe(1);
  });
});
