import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

test("浏览器跑分、历史对比、延迟及一次性挑战", async ({ page }) => {
  await page.goto("/windows-bench");
  await expect(page.getByRole("heading", { name: "Windows 测试" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth + 2)
  );
  const scores = page.locator('[data-bench-result="cpu"]');
  await expect(scores).toContainText("等待测试");
  await page.getByRole("button", { name: "测试CPU 单线程" }).click();
  await expect(scores).toContainText("M 次/秒");
  await page.reload();
  await expect(scores).toContainText("M 次/秒");
  await page.getByRole("button", { name: "测量节点延迟" }).click();
  await expect(page.locator('section[aria-labelledby="network-title"]')).toContainText(/\d\s*ms/);

  await page.getByRole("button", { name: "运行榜单测试" }).click();
  await expect(page.getByRole("button", { name: "发布本次成绩" })).toBeVisible();
  const posting = page.waitForRequest(request =>
    request.url().endsWith("/api/bench/leaderboard") && request.method() === "POST"
  );
  await page.getByRole("button", { name: "发布本次成绩" }).click();
  const run = await posting;
  expect((await run.response())?.status()).toBe(201);
  await expect(page.getByRole("list", { name: "CPU 成绩排名" })).toContainText("M 次/秒");
  const replay = await page.request.post("/api/bench/leaderboard", { data: run.postDataJSON() });
  expect(replay.status()).toBe(409);

  await page.locator('section[aria-labelledby="history-title"] input').nth(0).check();
  await page.locator('section[aria-labelledby="history-title"] input').nth(1).check();
  await expect(page.locator('section[aria-labelledby="history-title"] [role="status"]')).toContainText("%");
});

test("基米大师下载内容与页面的 SHA-256 一致", async ({ page }) => {
  await page.goto("/jimi-master");
  await expect(page.getByRole("heading", { name: "基米大师", exact: true })).toBeVisible();
  const link = page.getByRole("link", { name: "下载 ZIP" });
  const response = await page.request.get((await link.getAttribute("href"))!);
  expect(response.status()).toBe(200);
  const packageBytes = await response.body();
  expect(packageBytes.subarray(0, 4).toString("hex")).toBe("504b0304");
  await expect(page.locator("code")).toContainText(createHash("sha256").update(packageBytes).digest("hex"));
});
