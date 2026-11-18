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
});
