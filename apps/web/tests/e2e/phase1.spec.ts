import path from "node:path";
import fs from "node:fs";
import { expect, test } from "@playwright/test";

const SCREENSHOT_DIR =
  process.env.PHASE1_SCREENSHOT_DIR ||
  path.resolve(process.cwd(), "test-results/screenshots");

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test.describe("第一阶段：平台基座、悬停回缩导航与常用网址导引全链路验收", () => {
  test("健康检查接口返回真实 PostgreSQL 与缓存就绪指标", async ({
    request,
  }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("healthy");
    expect(json.data.database.ok).toBe(true);
    expect(json.data.database.builtinSiteCount).toBeGreaterThanOrEqual(24);
  });

  test("桌面端与移动端布局、悬停弹出/回缩导航栏、深浅色主题与网址导引交互", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes("mobile");

    await page.goto("/");
    await expect(page.locator("h1")).toContainText(
      "AI 驱动的跨平台工程与硬件工具中枢"
    );

    // 验证页面无水平溢出滚动条
    const hasHorizontalOverflow = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1
      );
    });
    expect(hasHorizontalOverflow).toBe(false);

    if (!isMobile) {
      const sidebar = page.locator("#global-sidebar");
      await expect(sidebar).toBeVisible();

      // 1. 默认处于回缩状态 (60px 宽，data-expanded="false")
      await expect(sidebar).toHaveAttribute("data-expanded", "false");
      const collapsedBox = await sidebar.boundingBox();
      expect(collapsedBox?.width).toBe(60);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-desktop-overview-dark-collapsed.png"),
        fullPage: false,
      });

      // 2. 鼠标移入左侧回缩栏，导航栏应自动丝滑弹出 (260px 宽，data-expanded="true")
      await sidebar.hover();
      await expect(sidebar).toHaveAttribute("data-expanded", "true");
      await page.waitForTimeout(240);
      const expandedBox = await sidebar.boundingBox();
      expect(expandedBox?.width).toBe(260);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "02-desktop-sidebar-hover-expanded.png"),
        fullPage: false,
      });

      // 3. 鼠标移回主画布区域，导航栏应自动回缩回 60px
      await page.mouse.move(720, 320);
      await expect(sidebar).toHaveAttribute("data-expanded", "false");
      await page.waitForTimeout(240);
      const retractedBox = await sidebar.boundingBox();
      expect(retractedBox?.width).toBe(60);

      // 4. 切换浅色主题并截图验证高对比度可读性
      await page.locator("#header-theme-toggle").click();
      await expect(page.locator("html")).toHaveClass(/light/);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "03-desktop-overview-light.png"),
        fullPage: false,
      });
      // 切回深色继续测试
      await page.locator("#header-theme-toggle").click();

      // 5. 测试全局命令面板与 AI 设置抽屉
      await page.locator("#header-search-trigger").click();
      await expect(page.locator("#command-palette-modal")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator("#command-palette-modal")).toBeHidden();

      await page.locator("#header-ai-trigger").click();
      await expect(page.locator("#ai-settings-drawer")).toBeVisible();
      await page.locator("#ai-drawer-close").click();

      // 6. 通过悬停弹出的导航栏点击进入「常用网址导引」
      await sidebar.hover();
      await page.locator("#nav-link-hub").click();
      await expect(page).toHaveURL(/\/hub$/);

      // 验证必选网站存在、搜索、收藏与新增自定义网址
      await expect(
        page.locator('[data-site-slug="steam"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-site-slug="google-gemini"]')
      ).toBeVisible();

      await page.locator("#hub-add-site-btn").click();
      await page.locator("#site-name-input").fill("Playwright Docs");
      await page.locator("#site-url-input").fill("https://playwright.dev");
      await page.locator("#site-category-select").selectOption("dev");
      await page
        .locator("#site-desc-input")
        .fill("跨浏览器端到端自动化测试框架官方文档站");
      await page.locator("#site-tags-input").fill("E2E, 自动化测试");
      await page.locator("#site-submit-btn").click();

      await expect(page.locator("#hub-sites-grid")).toContainText(
        "Playwright Docs"
      );

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "04-desktop-hub-dark.png"),
        fullPage: false,
      });

      // 7. 检查阶段蓝图页诚实标注
      await page.goto("/map");
      await expect(page.locator("h1")).toContainText("全球地图与 AI 分析");
      await expect(page.locator("body")).toContainText("计划交付阶段：第 2 阶段");
    } else {
      // 移动端 (390x844) 抽屉导航与响应式布局检查
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "05-mobile-overview.png"),
        fullPage: false,
      });

      await page.locator("#mobile-menu-trigger").click();
      await expect(page.locator("#mobile-nav-drawer")).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "06-mobile-drawer-open.png"),
        fullPage: false,
      });

      await page.locator("#mobile-nav-link-hub").click();
      await expect(page).toHaveURL(/\/hub$/);
      await expect(page.locator("h1")).toContainText("常用网址导引");

      const mobileOverflow = await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1
        );
      });
      expect(mobileOverflow).toBe(false);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "07-mobile-hub.png"),
        fullPage: false,
      });
    }
  });

  test("AI 设置抽屉键盘无障碍回归测试：自动聚焦、Tab 循环陷阱、Esc 关闭、原入口焦点回退及端点安全拦截", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes("mobile");
    await page.goto("/");

    // 1. 聚焦顶栏 AI 配置入口并按 Enter 打开抽屉
    const headerTrigger = page.locator("#header-ai-trigger");
    await headerTrigger.focus();
    await expect(headerTrigger).toBeFocused();
    await page.keyboard.press("Enter");

    const drawer = page.locator("#ai-settings-drawer");
    await expect(drawer).toBeVisible();

    // 2. 验证打开后焦点自动移入抽屉关闭按钮（而非停留在背景页面）
    const closeBtn = page.locator("#ai-drawer-close");
    await expect(closeBtn).toBeFocused();

    // 3. 验证 Shift+Tab 从首个元素反向循环至抽屉最后一个可聚焦控件，再按 Tab 回到首个控件
    await page.keyboard.press("Shift+Tab");
    const lastBtn = page.locator("#btn-probe-bridge");
    await expect(lastBtn).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(closeBtn).toBeFocused();

    // 4. 连续按 Tab 遍历整圈，确保每一步焦点都严格限制在抽屉内部
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press("Tab");
      const insideDrawer = await page.evaluate(() => {
        const panel = document.getElementById("ai-settings-drawer-panel");
        return Boolean(
          panel && document.activeElement && panel.contains(document.activeElement)
        );
      });
      expect(insideDrawer).toBe(true);
    }

    // 5. 验证文案已更新为「服务端点连通性检查」，且未填个人密钥时自定义端点会被安全边界拦截
    const testConnBtn = page.locator("#btn-test-ai-connection");
    await expect(testConnBtn).toContainText("服务端点连通性检查");
    await page
      .locator("#input-openai-base")
      .fill("https://custom-untrusted.example.com/v1");
    await testConnBtn.click();
    await expect(page.locator("#ai-connection-test-result")).toContainText(
      "安全边界限制"
    );

    // 6. 按 Escape 关闭抽屉，并验证焦点准确返回至原入口 #header-ai-trigger
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(headerTrigger).toBeFocused();

    // 7. 桌面端额外验证从左侧导航栏入口打开并关闭后焦点回到 #sidebar-settings-btn
    if (!isMobile) {
      const sidebarTrigger = page.locator("#sidebar-settings-btn");
      await sidebarTrigger.focus();
      await page.keyboard.press("Enter");
      await expect(drawer).toBeVisible();
      await expect(closeBtn).toBeFocused();

      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
      await expect(sidebarTrigger).toBeFocused();
    }
  });

  test("AI 连接检查网络边界拦截（HTTP / 内网 IP）与模型三态（已确认 / 未找到 / 无法确认）界面提示回归测试", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#header-ai-trigger").click();
    const drawer = page.locator("#ai-settings-drawer");
    await expect(drawer).toBeVisible();

    const keyInput = page.locator("#input-openai-key");
    const baseInput = page.locator("#input-openai-base");
    const testBtn = page.locator("#btn-test-ai-connection");
    const resultBox = page.locator("#ai-connection-test-result");

    // 1. 真实后端拦截明文 http:// 端点
    await keyInput.fill("sk-e2e-personal-key");
    await baseInput.fill("http://example.com/v1");
    await testBtn.click();
    await expect(resultBox).toContainText("HTTPS");

    // 2. 真实后端拦截非公网回环地址 https://127.0.0.1/v1
    await baseInput.fill("https://127.0.0.1/v1");
    await testBtn.click();
    await expect(resultBox).toContainText("安全策略已拦截");

    // 3. 验证前端界面准确呈现「无法确认」「未找到（404）」「已确认」三种模型检查状态
    let mockStage: "unverifiable" | "not_found" | "confirmed" = "unverifiable";
    await page.route("**/api/ai/status", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const payloads = {
        unverifiable: {
          ok: true,
          data: {
            provider: "openai",
            reachable: false,
            endpointReachable: false,
            modelAvailable: false,
            modelStatus: "unverifiable",
            model: "gpt-4o-mini",
            keySource: "user",
            checkedEndpoint: "https://example.com/v1",
            latencyMs: 35,
            message:
              "无法确认：目标地址返回了普通 HTML 页面而非有效 API 响应，未通过端点与鉴权校验",
          },
        },
        not_found: {
          ok: true,
          data: {
            provider: "openai",
            reachable: true,
            endpointReachable: true,
            modelAvailable: false,
            modelStatus: "not_found",
            model: "gpt-nonexistent",
            keySource: "user",
            checkedEndpoint: "https://api.openai.com/v1",
            latencyMs: 48,
            message:
              '未找到：服务端点有效，但模型查询明确返回 404（未找到模型 "gpt-nonexistent"）',
          },
        },
        confirmed: {
          ok: true,
          data: {
            provider: "openai",
            reachable: true,
            endpointReachable: true,
            modelAvailable: true,
            modelStatus: "confirmed",
            model: "gpt-4o-mini",
            keySource: "user",
            checkedEndpoint: "https://api.openai.com/v1",
            latencyMs: 52,
            message:
              '已确认：服务端点返回有效 API 响应，且模型 "gpt-4o-mini" 元数据匹配',
          },
        },
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payloads[mockStage]),
      });
    });

    await baseInput.fill("https://example.com/v1");
    await testBtn.click();
    await expect(resultBox).toContainText("未通过有效 API 校验");
    await expect(resultBox).toContainText("模型状态：无法确认");

    mockStage = "not_found";
    await testBtn.click();
    await expect(resultBox).toContainText("有效 API 响应");
    await expect(resultBox).toContainText("模型状态：未找到（404）");

    mockStage = "confirmed";
    await testBtn.click();
    await expect(resultBox).toContainText("有效 API 响应");
    await expect(resultBox).toContainText("模型状态：已确认");
  });
});

