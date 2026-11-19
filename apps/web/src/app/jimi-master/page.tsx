import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ClipboardCheck, Cpu, Download, Network, TerminalSquare, Wrench } from "lucide-react";
import release from "../../../public/downloads/jimi-release.json";

export const metadata: Metadata = {
  title: "基米大师",
  description: "适用于 Windows 的设备检测、本地基准测试与系统管理工具。",
};

const features = [
  { icon: Cpu, title: "设备与性能", description: "读取 CPU、GPU、内存、系统版本和物理磁盘。运行原生 CPU、内存复制、磁盘测试以及受支持系统上的 WinSAT 图形测试。" },
  { icon: Network, title: "网络与 DNS", description: "查看网卡、地址、网关和 DNS。可在确认后启用或禁用网卡，修改 IPv4 DNS 前保存回滚快照。" },
  { icon: TerminalSquare, title: "开发环境", description: "检查开发工具路径。确认软件 ID 和影响后，可通过 winget 安装 Git、Node.js LTS 或 Python 3.12。" },
  { icon: ClipboardCheck, title: "本地方案与记录", description: "根据常见网络和开发环境问题给出本地规则方案。查看执行结果、保存报告或读取本机操作历史。" },
];

export default function JimiMasterPage() {
  return (
    <div className="workspace-frame workspace-compact space-y-5">
      <header className="workspace-heading grid items-center gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-primary)]"><Wrench className="size-4" />Windows 原生客户端</p>
          <h1 className="workspace-title">基米大师</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--fg-secondary)]">查看设备和性能，诊断网络，管理常用系统配置。操作发起前可查看影响和回滚方式。</p>
          <Link href="/windows-bench" className="mt-4 inline-flex items-center gap-2 rounded-lg border bg-[var(--bg-surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--bg-hover)]">打开浏览器测试 <ArrowUpRight className="size-4" /></Link>
        </div>
        <section className="min-w-0 rounded-2xl border bg-[var(--bg-surface)] p-4 sm:p-5" aria-labelledby="jimi-download">
          <h2 className="text-base font-semibold" id="jimi-download">Windows x64 测试包</h2>
          <p className="mt-2 text-sm text-[var(--fg-secondary)]">版本 {release.version} · {Math.ceil(release.size / 1024)} KiB · 未签名</p>
          <div className="my-4 flex flex-wrap items-center gap-3">
            <a href={`/downloads/${release.file}`} download className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold !text-[var(--accent-foreground)] hover:opacity-90">
              <Download size={16} />下载 ZIP
            </a>
            <a target="_blank" rel="noopener noreferrer" href="https://dotnet.microsoft.com/en-us/download/dotnet/8.0" className="text-sm text-[var(--accent-primary)] underline">.NET 8 桌面运行时</a>
          </div>
          <p className="text-xs text-[var(--fg-secondary)]">解压后运行 JimiMaster.exe。需要 Windows 10/11 x64 和 .NET 8 Desktop Runtime。</p>
          <p className="mt-3 break-all text-xs text-[var(--fg-secondary)]"><span className="font-semibold">SHA-256</span> <code>{release.sha256}</code></p>
        </section>
      </header>
      <section className="grid gap-3 sm:grid-cols-2" aria-label="客户端功能">
        {features.map(({ icon: Icon, title, description }) => (
          <article key={title} className="flex gap-3 rounded-2xl border bg-[var(--bg-surface)] p-4 sm:p-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]"><Icon className="size-4" /></span>
            <div><h2 className="font-semibold">{title}</h2><p className="mt-1.5 text-sm leading-relaxed text-[var(--fg-secondary)]">{description}</p></div>
          </article>
        ))}
      </section>
      <div className="rounded-2xl border bg-[var(--bg-surface)] p-4 text-sm leading-relaxed text-[var(--fg-secondary)]">此包已完成 Windows x64 交叉构建，安装启动与需要管理员权限的操作待在真实 Windows 上验证。</div>
    </div>
  );
}
