import { redirect } from "next/navigation";
import { readAdminReport } from "@/lib/admin/report";
import { logout } from "../login/actions";

export default async function AdminPage() {
  const report = await readAdminReport();
  if (!report) redirect("/login");
  return <section className="account-panel">
    <h1>管理员面板</h1>
    <dl>
      <dt>数据库</dt><dd>{report.database.driver} · {report.database.latencyMs} ms</dd>
      <dt>缓存</dt><dd>{report.cache.driver}</dd>
      <dt>预置站点</dt><dd>{report.database.builtinSiteCount}</dd>
      <dt>OpenAI 服务端密钥</dt><dd>{report.aiGateway.openaiServerKeyConfigured ? "已配置" : "未配置"}</dd>
      <dt>Gemini 服务端密钥</dt><dd>{report.aiGateway.geminiServerKeyConfigured ? "已配置" : "未配置"}</dd>
    </dl>
    <form action={logout}><button type="submit">退出登录</button></form>
  </section>;
}
