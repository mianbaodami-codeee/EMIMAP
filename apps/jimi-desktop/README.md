# 基米大师 Windows 客户端

当前构建为 `0.3.0`，使用 .NET 8 WinForms 和 Windows 内置 PowerShell/CIM。第三阶段最初评估了 Tauri + Rust。设备读取和受控系统修改均调用 Windows 接口，当前版本使用 WinForms 直接提供桌面界面，共用 .NET SDK 即可交叉构建 Windows x64 下载包。

## 安装与运行

从网站「基米大师」页面下载 ZIP。安装微软 .NET 8 Desktop Runtime（x64），解压后运行 `JimiMaster.exe`。该测试包未签名，启动前可在 PowerShell 中运行 `Get-FileHash -Algorithm SHA256 <ZIP 文件路径>`，与网站上的 SHA-256 对照。主进程使用普通 Windows 用户权限。

- 「设备与性能」通过 CIM 读取 CPU、GPU、内存、系统及物理磁盘。原生套件测量 CPU 单线程和并行、内存复制、临时卷写入刷新及读取。读取可能受文件缓存影响。WinSAT 图形测试依赖 Windows 是否提供该工具及驱动支持，错误会如实呈现。
- 「网络与 DNS」读取网卡、地址与 DNS。更改前显示目标配置和影响，经确认后按需请求管理员权限。IPv4 DNS 修改前将快照写入 `%LOCALAPPDATA%\JimiMaster`，选择同一网卡与快照即可恢复。网卡禁用可能中断当前远程连接。
- 「开发与助手」调用本地规则给出操作步骤。PowerShell 和 CMD 使用内置的诊断命令。具备 winget 的系统可在确认后安装清单中的 Git、Node.js LTS 或 Python。
- 「操作历史」保存本机执行状态，可导出硬件与测试文本报告。

## 从源码构建

需要 .NET 8 SDK 与 Python 3。在仓库根目录执行以下命令。

```text
dotnet publish apps/jimi-desktop/src/JimiMaster.csproj -c Release -r win-x64 --self-contained false -o out/jimi
python apps/jimi-desktop/package.py out/jimi
```

打包脚本更新 `apps/web/public/downloads` 内的 ZIP 和校验清单。Windows 实机验收需要覆盖启动、硬件信息、WinSAT、UAC 取消、DNS 静态与自动配置回滚、网卡启用禁用及 winget。联网模型助手按当前阶段口径留到后续实调。
