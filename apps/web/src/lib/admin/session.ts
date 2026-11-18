import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getCacheStore } from "@/lib/cache/store";

const COOKIE = "omnikit_admin_session";
const LIFETIME = 8 * 60 * 60;

function configuredPassword() {
  const password = process.env.ADMIN_PASSWORD;
  return password && password.length >= 16 ? password : null;
}

// 会话记录只存随机令牌的摘要；撤销、过期或更换管理员密码都使会话失效。
function sessionKey(token: string, password: string) {
  return "admin:session:" + createHmac("sha256", password).update(token).digest("hex");
}

export async function isAdmin() {
  const token = (await cookies()).get(COOKIE)?.value;
  const password = configuredPassword();
  if (!password || !token || !/^[a-f0-9]{64}$/.test(token)) return false;
  return (await getCacheStore().get<string>(sessionKey(token, password))) === "Admin";
}

export async function signInAdmin(username: string, suppliedPassword: string) {
  const password = configuredPassword();
  if (!password || username !== "Admin" || suppliedPassword.length > 1024) return false;
  const cache = getCacheStore();
  if (!(await cache.checkRateLimit("admin:login:attempts", 12, 300)).allowed) return false;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  if (!timingSafeEqual(digest(password), digest(suppliedPassword))) return false;
  const token = randomBytes(32).toString("hex");
  await cache.set(sessionKey(token, password), "Admin", LIFETIME);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/", maxAge: LIFETIME,
  });
  return true;
}

export async function signOutAdmin() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  const password = configuredPassword();
  if (token && password) await getCacheStore().del(sessionKey(token, password));
  jar.delete(COOKIE);
}
