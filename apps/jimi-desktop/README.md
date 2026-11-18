# 基米大师 & 玩机器 Windows 原生客户端 (Tauri v2 + Rust)

本目录为桌面原生客户端工作区预留骨架，将在**第三阶段（基米大师）**与**第四阶段（玩机器本地连接引擎）**正式填充完整 Tauri v2 + Rust 工程代码。

核心职责边界：
- 原生硬件深检（WMI / DXGI / 物理内存与磁盘）与原生多线程基准测试
- 系统网络诊断、网卡适配器管理、DNS 配置与配置快照回滚
- PowerShell / CMD 三级风险确认安全执行器
- Android ADB / `scrcpy` 投屏与 Apple Mobile Device / `libimobiledevice` 本地协同管理
