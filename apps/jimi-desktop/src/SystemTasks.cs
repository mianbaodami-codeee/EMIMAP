using System.ComponentModel;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Security.Principal;
using System.Text;
using System.Text.Json;

namespace JimiMaster;

internal sealed record Adapter(int Index, string Name, Guid Id);
internal sealed record DnsBackup(Adapter Adapter, string[] Addresses);

internal static class SystemTasks
{
    internal static readonly string DataDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "JimiMaster");
    private static readonly string PowerShell = Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe");
    private static readonly string Cmd = Path.Combine(Environment.SystemDirectory, "cmd.exe");
    private static readonly string Netsh = Path.Combine(Environment.SystemDirectory, "netsh.exe").Replace("'", "''");
    private static readonly string WindowsModules = Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "Modules").Replace("'", "''");

    internal const string HardwareScript = """
        'CPU'
        Get-CimInstance Win32_Processor | Format-List Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed | Out-String -Width 180
        'GPU'
        Get-CimInstance Win32_VideoController | Format-List Name,DriverVersion,VideoProcessor,CurrentHorizontalResolution,CurrentVerticalResolution | Out-String -Width 180
        '系统与内存'
        Get-CimInstance Win32_OperatingSystem | Format-List Caption,Version,BuildNumber,OSArchitecture | Out-String -Width 180
        Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer,Model,@{n='MemoryGiB';e={[Math]::Round($_.TotalPhysicalMemory/1GB,2)}} | Format-List | Out-String -Width 180
        '物理磁盘'
        Get-CimInstance Win32_DiskDrive | Select-Object Model,InterfaceType,@{n='SizeGiB';e={[Math]::Round($_.Size/1GB,2)}} | Format-Table -AutoSize | Out-String -Width 180
        """;
    internal const string NetworkScript = """
        Get-NetIPConfiguration | Format-List InterfaceAlias,InterfaceIndex,IPv4Address,IPv6Address,IPv4DefaultGateway,DNSServer | Out-String -Width 180
        Get-NetAdapter | Format-Table Name,ifIndex,Status,LinkSpeed -AutoSize | Out-String -Width 180
        """;
    internal const string DevelopmentScript = """
        foreach ($tool in @('git.exe','node.exe','python.exe','dotnet.exe','cargo.exe','winget.exe')) {
            $source = Get-Command $tool -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($source) { "$tool    $($source.Source)" } else { "$tool    未在 PATH 找到" }
        }
        """;

    private static ProcessStartInfo PowerShellStart(string script)
    {
        // 只处理内置命令模板。编码保留参数边界，用户输入不会被当作脚本执行。
        string preamble = $"$ErrorActionPreference='Stop'; $env:PSModulePath='{WindowsModules}'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; ";
        var start = new ProcessStartInfo(PowerShell);
        foreach (string arg in new[] { "-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand",
            Convert.ToBase64String(Encoding.Unicode.GetBytes(preamble + script)) })
            start.ArgumentList.Add(arg);
        return start;
    }

    internal static Task<string> ReadPowerShell(string script) => RunReadAsync(PowerShellStart(script), 45);
    internal static Task<string> IpConfig() => RunReadAsync(
        new ProcessStartInfo(Cmd) { Arguments = "/d /c %SystemRoot%\\System32\\ipconfig.exe /all" }, 30, Encoding.Default);

    private static async Task<string> RunReadAsync(ProcessStartInfo start, int timeoutSeconds, Encoding? encoding = null)
    {
        start.UseShellExecute = false;
        start.CreateNoWindow = true;
        start.RedirectStandardOutput = true;
        start.RedirectStandardError = true;
        start.StandardOutputEncoding = start.StandardErrorEncoding = encoding ?? Encoding.UTF8;
        using var process = Process.Start(start) ?? throw new InvalidOperationException("无法启动命令");
        Task<string> stdout = process.StandardOutput.ReadToEndAsync();
        Task<string> stderr = process.StandardError.ReadToEndAsync();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds));
        try { await process.WaitForExitAsync(timeout.Token); }
        catch (OperationCanceledException)
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
            throw new TimeoutException("已停止超时的读取命令");
        }
        string text = (await stdout).Trim();
        string error = (await stderr).Trim();
        if (process.ExitCode != 0) throw new InvalidOperationException(string.IsNullOrWhiteSpace(error) ? $"命令退出码 {process.ExitCode}\n{text}" : error);
        return text;
    }

    internal static async Task<Adapter[]> Adapters()
    {
        string json = await ReadPowerShell("""
            $items = @(Get-NetAdapter | ForEach-Object { @{ Index=[int]$_.ifIndex; Name=[string]$_.Name; Id=[guid]$_.InterfaceGuid } })
            ConvertTo-Json -InputObject $items -Compress
            """);
        return JsonSerializer.Deserialize<Adapter[]>(json) ?? [];
    }

    internal static bool IsIpv4(string value) => IPAddress.TryParse(value, out var parsed) &&
        parsed.AddressFamily == AddressFamily.InterNetwork && value == parsed.ToString();

    internal static async Task<DnsBackup> ReadDns(Adapter adapter)
    {
        string data = await ReadPowerShell(AdapterCheck(adapter) + """
            $path = 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces\{' + $id + '}'
            $registry = Get-ItemProperty -LiteralPath $path
            $servers = @(([string]$registry.NameServer -split '[ ,;]+') | Where-Object { $_ })
            ConvertTo-Json -InputObject $servers -Compress
            """);
        string[] addresses = JsonSerializer.Deserialize<string[]>(data) ?? [];
        if (addresses.Any(value => !IsIpv4(value))) throw new InvalidOperationException("现有 DNS 配置无法安全备份");
        return new DnsBackup(adapter, addresses);
    }

    private static string AdapterCheck(Adapter adapter) => $$"""
        $index = {{adapter.Index}}; $id = '{{adapter.Id:D}}';
        $adapter = Get-NetAdapter -IncludeHidden | Where-Object ifIndex -eq $index;
        if ([guid]$adapter.InterfaceGuid -ne [guid]$id) { throw '网卡已变化，请重新读取' }
        """ + "\n";

    internal static async Task ApplyDns(DnsBackup target)
    {
        if (target.Addresses.Length > 12 || target.Addresses.Any(value => !IsIpv4(value)))
            throw new InvalidOperationException("当前操作仅支持标准 IPv4 地址");
        var addresses = target.Addresses;
        string dns = addresses.Length == 0 ? "source=dhcp" : $"source=static address={addresses[0]} validate=no";
        string script = AdapterCheck(target.Adapter) +
            $"& '{Netsh}' interface ipv4 set dnsservers name=$index {dns}; if ($LASTEXITCODE -ne 0) {{ exit $LASTEXITCODE }}\n";
        for (int i = 1; i < addresses.Length; i += 1)
            script += $"& '{Netsh}' interface ipv4 add dnsservers name=$index address={addresses[i]} index={i + 1} validate=no; if ($LASTEXITCODE -ne 0) {{ exit $LASTEXITCODE }}\n";
        await RunElevated(script);
    }

    internal static Task SetAdapter(Adapter adapter, bool enabled) => RunElevated(
        AdapterCheck(adapter) + $"$adapter | {(enabled ? "Enable" : "Disable")}-NetAdapter -Confirm:$false");

    private static async Task RunElevated(string script)
    {
        using var identity = WindowsIdentity.GetCurrent();
        var start = PowerShellStart(script + "\nexit 0");
        start.UseShellExecute = true;
        if (!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator)) start.Verb = "runas";
        start.WindowStyle = ProcessWindowStyle.Hidden;
        using var process = Process.Start(start) ?? throw new InvalidOperationException("系统没有启动授权进程");
        await process.WaitForExitAsync();
        if (process.ExitCode != 0) throw new InvalidOperationException($"系统返回错误 {process.ExitCode}。请检查配置或使用已保存的回滚方案。");
    }

    internal static async Task<string> InstallTool(string package)
    {
        if (package is not ("Git.Git" or "OpenJS.NodeJS.LTS" or "Python.Python.3.12"))
            throw new InvalidOperationException("该软件未在受控安装清单中");
        string winget = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Microsoft", "WindowsApps", "winget.exe");
        if (!File.Exists(winget)) throw new FileNotFoundException("未找到 Windows App Installer（winget）");
        var start = new ProcessStartInfo(winget) { UseShellExecute = true };
        foreach (string arg in new[] { "install", "--source", "winget", "--id", package, "--exact" })
            start.ArgumentList.Add(arg);
        using var process = Process.Start(start) ?? throw new InvalidOperationException("无法启动 winget");
        await process.WaitForExitAsync();
        if (process.ExitCode != 0) throw new InvalidOperationException($"winget 退出码 {process.ExitCode}，请查看安装程序窗口");
        return $"{package} 安装命令成功。重新检查开发环境可查看路径。";
    }

    internal static Task<string> GraphicsAssessment()
    {
        string program = Path.Combine(Environment.SystemDirectory, "WinSAT.exe");
        if (!File.Exists(program)) throw new InvalidOperationException("此 Windows 版本未提供 WinSAT");
        var start = new ProcessStartInfo(program) { Arguments = "d3d" };
        return RunReadAsync(start, 90, Encoding.Default);
    }

    internal static void Log(string action, string status)
    {
        Directory.CreateDirectory(DataDirectory);
        string entry = JsonSerializer.Serialize(new { at = DateTimeOffset.Now, action, status });
        File.AppendAllText(Path.Combine(DataDirectory, "history.jsonl"), entry + Environment.NewLine);
    }
}
