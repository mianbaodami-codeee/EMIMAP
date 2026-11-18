import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/session";
import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAdmin()) redirect("/admin");
  const { error } = await searchParams;
  return <section className="account-panel">
    <h1>账号登录</h1>
    <form action={login}>
      <label>账号<input name="username" autoComplete="username" required /></label>
      <label>密码<input name="password" type="password" autoComplete="current-password" required /></label>
      {error && <p role="alert">登录未成功，请检查凭据或稍后重试。</p>}
      <button type="submit">登录</button>
    </form>
  </section>;
}
