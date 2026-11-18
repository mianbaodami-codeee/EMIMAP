import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";

export const CLIENT_ID_COOKIE = "omnikit_cid";
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

/**
 * 解析当前访客或原生桌面客户端的匿名工作区标识
 * 无需强制注册账号即可持久化个人收藏与自定义网址，同时严格校验格式防止注入。
 */
export async function resolveClientWorkspaceId(): Promise<{
  clientId: string;
  isNewCookie: boolean;
}> {
  const headerBag = await headers();
  const fromHeader = headerBag.get("x-omnikit-client-id")?.trim();
  if (fromHeader && SAFE_ID_PATTERN.test(fromHeader)) {
    return { clientId: fromHeader, isNewCookie: false };
  }

  const cookieBag = await cookies();
  const fromCookie = cookieBag.get(CLIENT_ID_COOKIE)?.value?.trim();
  if (fromCookie && SAFE_ID_PATTERN.test(fromCookie)) {
    return { clientId: fromCookie, isNewCookie: false };
  }

  return {
    clientId: `wk_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    isNewCookie: true,
  };
}

export function buildClientCookieHeader(clientId: string): string {
  const maxAge = 60 * 60 * 24 * 365; // 1 年有效期
  return `${CLIENT_ID_COOKIE}=${clientId}; Path=/; Max-Age=${maxAge}; SameSite=Lax; HttpOnly`;
}
