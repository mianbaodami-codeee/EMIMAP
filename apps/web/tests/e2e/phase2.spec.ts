import { expect, test } from "@playwright/test";

test.describe("第二阶段：全球地图与 AI 空间分析 + AI 自主资源寻找代理全链路验收", () => {
  test("全球交互地图：地点检索、坐标直达、收藏持久化、多点对比、三源 AI 问答与 GeoJSON 导出", async ({
    page,
  }) => {
    await page.goto("/map");
    await expect(page.locator("h1")).toContainText("全球地图与 AI 空间分析");
    await expect(page.locator("#geo-map-canvas")).toBeVisible();

    // 验证桌面/移动端视口无横向滚动溢出
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1
    );
    expect(overflow).toBe(false);

    // 1. 点击快速节点「东京」并加入多点对比矩阵
    await page.locator('[data-quick-hub="东京"]').click();
    await expect(page.locator("#geo-selected-name")).toContainText("东京");
    await page.locator("#geo-add-compare-btn").click();
    await expect(page.locator("#geo-compare-matrix")).toContainText("km");

    // 2. 收藏当前地点并刷新页面验证 PostgreSQL / PGlite 持久化
    await page.locator("#geo-save-note-input").fill("亚太游戏与海缆基准点");
    await page.locator("#geo-save-place-btn").click();
    await expect(page.locator("#geo-saved-list")).toContainText("东京");

    await page.reload();
    await expect(page.locator("#geo-saved-list")).toContainText("东京");

    // 3. 发起三源隔离 AI 地理问答，验证三个不同可信度区块同时清晰呈现
    await page
      .locator("#geo-ai-question-input")
      .fill("分析该区域的海缆通信与主机游戏研发产业区位特征");
    const analysis = page.waitForResponse(r => r.url().endsWith("/api/geo/analyze") && r.request().method() === "POST");
    await page.locator("#geo-ai-ask-btn").click();
    expect((await analysis).ok()).toBe(true);

    await expect(page.locator("#geo-result-measured")).toBeVisible();
    await expect(page.locator("#geo-result-verified")).toBeVisible();
    await expect(page.locator("#geo-result-inferred")).toBeVisible();

    // 4. 验证查询历史自动更新与 GeoJSON 标准格式导出
    await page.locator("#geo-tab-history").click();
    await expect(page.locator("#geo-history-list")).toContainText(
      "分析该区域的海缆通信"
    );

    await page.locator("#geo-export-geojson-btn").click();
    await expect(page.locator("#geo-export-preview")).toContainText(
      '"FeatureCollection"'
    );
  });

  test("AI 资源寻找代理：四步执行轨迹、品牌渐变卡片、仅官方源筛选与正版合规拦截", async ({
    page,
  }) => {
    await page.goto("/discover");
    await expect(page.locator("h1")).toContainText("AI 自主资源寻找代理");

    // 验证无水平溢出
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1
    );
    expect(overflow).toBe(false);

    // 1. 初始四步轨迹与品牌渐变图标渲染
    await expect(page.locator("#discover-agent-steps")).toContainText(
      "需求拆解与检索规划"
    );
    await expect(page.locator("#discover-results-grid")).toContainText(
      "可信度核验依据："
    );

    // 2. 检索开源工具 scrcpy 并核验官方仓库链接
    const search = page.waitForResponse(r => r.url().endsWith("/api/discover/search") && r.request().method() === "POST");
    await page.locator("#discover-query-input").fill("Android 投屏开源工具 scrcpy");
    await page.locator("#discover-submit-btn").click();
    expect((await search).ok()).toBe(true);
    await expect(page.locator("#discover-results-grid")).toContainText(
      "Genymobile/scrcpy"
    );

    // 3. 验证正版与安全合规拦截门禁
    await page
      .locator("#discover-query-input")
      .fill("Cyberpunk 2077 盗版免付费破解版与注册机下载");
    await page.locator("#discover-submit-btn").click();
    await expect(page.locator("#discover-compliance-alert")).toBeVisible();
    await expect(page.locator("#discover-compliance-alert")).toContainText(
      "合规与安全拦截"
    );
  });
});
