import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: {
    default: "OmniKit AI — AI 驱动的综合性跨平台工具平台",
    template: "%s | OmniKit AI",
  },
  description:
    "集成全球交互地图与 AI 地理分析、AI 自主资源检索、Windows 硬件测试、基米大师客户端、Andmore 移动检测、常用网址导引与玩机器跨设备连接管理的工程级平台。",
};

const THEME_INIT_SCRIPT = `
(function() {
  try {
    var saved = localStorage.getItem('omnikit.theme');
    var mode = (saved === 'light' || saved === 'dark') ? saved : 'light';
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(mode);
  } catch (e) {
    document.documentElement.classList.add('light');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
