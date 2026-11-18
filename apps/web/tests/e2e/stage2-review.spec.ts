import { expect, test } from "@playwright/test";

test("Admin 会话隔离与注销", async ({ page, request }) => {
  const password = process.env.ADMIN_PASSWORD;
  test.skip(!password, "请对隔离测试服务设置临时 ADMIN_PASSWORD");
  for (const url of ["/api/admin/status", "/api/ai/status"]) {
    const res = await request.get(url);
    expect(res.status()).toBe(403);
    expect(await res.json()).toEqual({ ok: false });
  }
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  const name = page.getByLabel("账号", { exact: true });
  await name.fill("Visitor");
  await page.getByLabel("密码").fill(password!);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/login\?error=1$/);
  await page.reload();
  await expect(page.locator("form [role=alert]")).toBeVisible();
  await name.fill("Admin");
  await page.getByLabel("密码").fill(password!);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "管理员面板" })).toBeVisible();
  const authorized = await page.request.get("/api/admin/status");
  expect((await authorized.json()).data.database.ok).toBe(true);
  const cookie = (await page.context().cookies()).find(c => c.name === "omnikit_admin_session")!;
  expect(cookie.httpOnly).toBe(true);
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/$/);
  const revoked = await request.get("/api/admin/status", { headers: { Cookie: cookie.name + "=" + cookie.value } });
  expect(revoked.status()).toBe(403);
});

test("低图形能力设备也能看图、缩放和选点", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).includes("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto("/map");
  const map = page.locator("#geo-svg-atlas");
  await expect(map).toBeVisible();
  expect((await page.request.get("/atlas/world.svg")).status()).toBe(200);
  const before = await map.getAttribute("viewBox");
  await page.getByRole("button", { name: "放大地图" }).click();
  await expect(map).not.toHaveAttribute("viewBox", before!);
  await page.route("**/api/geo/reverse?**", route => route.fulfill({ status:503, json:{ok:false} }));
  await page.locator('[data-quick-hub="东京"]').click();
  await expect(page.locator("#geo-selected-name")).toContainText("东京");
});
