using System.ComponentModel;
using System.Drawing;
using System.Text.Json;

namespace JimiMaster;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm());
    }
}

internal sealed class MainForm : Form
{
    private static readonly Color Dark = Color.FromArgb(13, 25, 46);
    private static readonly Color Accent = Color.FromArgb(28, 93, 203);
    private readonly TabControl tabs = new() { Dock = DockStyle.Fill };
    private readonly Label status = new() { Dock = DockStyle.Bottom, Height = 36, Padding = new Padding(18, 8, 0, 0), Text = "就绪" };
    private readonly ComboBox adapters = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 240, DisplayMember = "Name" };
    private readonly TextBox dns = new() { PlaceholderText = "IPv4 DNS，例如 1.1.1.1", Width = 208 };
    private readonly TextBox question = new() { PlaceholderText = "例如：检查开发环境", Width = 290 };
    private bool busy;

    internal MainForm()
    {
        Text = "基米大师";
        ClientSize = new Size(1010, 690);
        MinimumSize = new Size(660, 520);
        BackColor = Color.White;
        Font = new Font("Microsoft YaHei UI", 10);

        var header = new Panel { Dock = DockStyle.Top, Height = 89, BackColor = Dark };
        var title = new Label { Text = "基米大师", Font = new Font(Font.FontFamily, 19, FontStyle.Bold), ForeColor = Color.White, AutoSize = true, Location = new Point(22, 17) };
        var detail = new Label { Text = "Windows 设备检测和系统管理", ForeColor = Color.FromArgb(181, 207, 244), AutoSize = true, Location = new Point(22, 52) };
        header.Controls.AddRange([title, detail]);
        Controls.Add(tabs);
        Controls.Add(status);
        Controls.Add(header);

        var (inspectButtons, inspectText) = AddPage("设备与性能", "硬件信息和实测结果在本机显示。可保存为文本报告。");
        AddButton(inspectButtons, "读取硬件", () => Execute("读取硬件", inspectText, async () => await SystemTasks.ReadPowerShell(SystemTasks.HardwareScript)));
        AddButton(inspectButtons, "运行 CPU、内存和磁盘测试", () => Execute("原生基准测试", inspectText, async () => await NativeBenchmark.Run(new Progress<string>(msg => status.Text = msg))));
        AddButton(inspectButtons, "运行 WinSAT 图形测试", () => Execute("WinSAT 图形测试", inspectText, async () => await SystemTasks.GraphicsAssessment()));
        AddButton(inspectButtons, "保存报告", () => SaveReport(inspectText));

        var (networkButtons, networkText) = AddPage("网络与 DNS", "修改前可核对网卡与操作。修改 IPv4 DNS 前会保存回滚快照。");
        networkButtons.Controls.Add(adapters);
        AddButton(networkButtons, "读取网卡", () => Execute("读取网卡", networkText, async () =>
        {
            adapters.DataSource = await SystemTasks.Adapters();
            return await SystemTasks.ReadPowerShell(SystemTasks.NetworkScript);
        }));
        AddButton(networkButtons, "IP 配置", () => Execute("读取 IP 配置", networkText, async () => await SystemTasks.IpConfig()));
        networkButtons.Controls.Add(dns);
        AddButton(networkButtons, "应用 DNS", () => Execute("配置 DNS", networkText, ApplyDns));
        AddButton(networkButtons, "恢复 DNS 快照", () => Execute("恢复 DNS 快照", networkText, RestoreDns));
        AddButton(networkButtons, "启用网卡", () => Execute("启用网卡", networkText, () => ChangeAdapter(true)));
        AddButton(networkButtons, "禁用网卡", () => Execute("禁用网卡", networkText, () => ChangeAdapter(false)));

        var (developmentButtons, developmentText) = AddPage("开发与助手", "可用本地命令检查环境，也可以从受控清单调用 winget 安装工具。");
        AddButton(developmentButtons, "检查开发工具", () => Execute("检查开发工具", developmentText, async () => await SystemTasks.ReadPowerShell(SystemTasks.DevelopmentScript)));
        var packages = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList, Width = 185 };
        packages.Items.AddRange(["Git.Git", "OpenJS.NodeJS.LTS", "Python.Python.3.12"]);
        packages.SelectedIndex = 0;
        developmentButtons.Controls.Add(packages);
        AddButton(developmentButtons, "安装选中工具", () => Execute("安装开发工具", developmentText, async () =>
        {
            string package = (string)packages.SelectedItem!;
            if (!Confirm("安装开发工具", $"winget install --source winget --id {package} --exact\n\n将启动官方 winget 安装流程。安装程序可能单独请求权限。可在 Windows 的“已安装的应用”卸载。")) return null;
            return await SystemTasks.InstallTool(package);
        }));
        developmentButtons.Controls.Add(question);
        AddButton(developmentButtons, "生成本地方案", () => ExplainPlan(developmentText));
        AddButton(developmentButtons, "查看 CMD 命令", () => developmentText.Text = "只读诊断\n\nCMD：ipconfig /all\nPowerShell：Get-NetIPConfiguration\n\n请在「网络与 DNS」页点击对应按钮运行。");

        var (historyButtons, historyText) = AddPage("操作历史", "此日志记录本机操作和完成状态。");
        AddButton(historyButtons, "刷新历史", () =>
        {
            try
            {
                string path = Path.Combine(SystemTasks.DataDirectory, "history.jsonl");
                historyText.Text = File.Exists(path) ? string.Join(Environment.NewLine, File.ReadLines(path).TakeLast(150).Reverse()) : "当前没有操作记录。";
            }
            catch (IOException error) { historyText.Text = error.Message; }
        });
        AddButton(historyButtons, "打开快照目录", () =>
        {
            Directory.CreateDirectory(SystemTasks.DataDirectory);
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(SystemTasks.DataDirectory) { UseShellExecute = true });
        });
    }

    private (FlowLayoutPanel Buttons, RichTextBox Output) AddPage(string label, string detail)
    {
        var page = new TabPage(label) { Padding = new Padding(14), BackColor = Color.White };
        var grid = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 3 };
        grid.RowStyles.Add(new RowStyle(SizeType.Absolute, 39));
        grid.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        grid.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoSize = true, WrapContents = true, Padding = new Padding(2, 2, 2, 8) };
        var output = new RichTextBox
        {
            Dock = DockStyle.Fill, ReadOnly = true, WordWrap = false, BackColor = Color.FromArgb(244, 248, 253),
            ForeColor = Dark, Font = new Font("Consolas", 11), Text = "选择上方操作查看结果。", DetectUrls = false,
        };
        grid.Controls.Add(new Label { Text = detail, Dock = DockStyle.Fill, ForeColor = Dark, TextAlign = ContentAlignment.MiddleLeft }, 0, 0);
        grid.Controls.Add(buttons, 0, 1);
        grid.Controls.Add(output, 0, 2);
        page.Controls.Add(grid);
        tabs.TabPages.Add(page);
        return (buttons, output);
    }

    private void AddButton(FlowLayoutPanel panel, string label, Action action)
    {
        var button = new Button { Text = label, AutoSize = true, FlatStyle = FlatStyle.Flat, Padding = new Padding(5, 3, 5, 3), ForeColor = Accent, BackColor = Color.White };
        button.Click += (_, _) => { if (!busy) action(); };
        panel.Controls.Add(button);
    }

    private void AddButton(FlowLayoutPanel panel, string label, Func<Task> action) =>
        AddButton(panel, label, (Action)(async () => await action()));

    private async Task Execute(string action, RichTextBox output, Func<Task<string?>> work)
    {
        if (busy) return;
        busy = true;
        status.Text = $"{action}…";
        UseWaitCursor = true;
        try
        {
            string? result = await work();
            if (result is null)
            {
                status.Text = "已取消";
                return;
            }
            output.Text = result;
            status.Text = $"{action}已完成";
            TryLog(action, "完成");
        }
        catch (Win32Exception error) when (error.NativeErrorCode == 1223)
        {
            status.Text = "用户取消 Windows 授权";
            TryLog(action, "取消");
        }
        catch (Exception error)
        {
            output.Text = error.Message;
            status.Text = $"{action}失败";
            TryLog(action, "失败");
        }
        finally
        {
            busy = false;
            UseWaitCursor = false;
        }
    }

    private void TryLog(string action, string state)
    {
        try { SystemTasks.Log(action, state); }
        catch (IOException) { status.Text += " · 无法写入历史"; }
        catch (UnauthorizedAccessException) { status.Text += " · 无法写入历史"; }
    }

    private Adapter SelectedAdapter() =>
        adapters.SelectedItem as Adapter ?? throw new InvalidOperationException("请先读取并选择网卡。");

    private bool Confirm(string action, string message) =>
        MessageBox.Show(this, message, action, MessageBoxButtons.OKCancel, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2) == DialogResult.OK;

    private async Task<string?> ApplyDns()
    {
        Adapter adapter = SelectedAdapter();
        string value = dns.Text.Trim();
        if (!SystemTasks.IsIpv4(value)) throw new InvalidOperationException("请输入标准点分十进制 IPv4 地址。");
        DnsBackup saved = await SystemTasks.ReadDns(adapter);
        if (!Confirm("配置 IPv4 DNS", $"网卡：{adapter.Name}\n当前：{DescribeDns(saved)}\n目标：{value}\n\n修改可能影响域名解析。应用前会保存原配置，可在本页恢复。按需请求 Windows 管理员授权。")) return null;
        Directory.CreateDirectory(SystemTasks.DataDirectory);
        string file = Path.Combine(SystemTasks.DataDirectory, $"dns-{adapter.Id:N}-{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss-fff}.json");
        await File.WriteAllTextAsync(file, JsonSerializer.Serialize(saved));
        status.Text = $"DNS 快照已保存，正在应用…";
        try { await SystemTasks.ApplyDns(new DnsBackup(adapter, [value])); }
        catch (Exception error) when (error is not Win32Exception { NativeErrorCode: 1223 })
        {
            throw new InvalidOperationException($"DNS 应用失败。请使用此快照核对或恢复：\n{file}\n\n{error.Message}", error);
        }
        DnsBackup effective = await SystemTasks.ReadDns(adapter);
        if (!effective.Addresses.SequenceEqual(new[] { value }))
            throw new InvalidOperationException($"DNS 读取值为 {DescribeDns(effective)}。原始快照：{file}");
        return $"当前设置 {value}\n回滚快照\n{file}";
    }

    private static string DescribeDns(DnsBackup value) =>
        value.Addresses.Length == 0 ? "自动获取" : string.Join(", ", value.Addresses);

    private async Task<string?> RestoreDns()
    {
        using var dlg = new OpenFileDialog { Title = "选择 DNS 回滚快照", Filter = "DNS 快照|dns-*.json", InitialDirectory = SystemTasks.DataDirectory };
        if (dlg.ShowDialog(this) != DialogResult.OK) return null;
        if (new FileInfo(dlg.FileName).Length > 16 * 1024) throw new InvalidOperationException("快照文件超出限制。");
        var backup = JsonSerializer.Deserialize<DnsBackup>(await File.ReadAllTextAsync(dlg.FileName)) ?? throw new InvalidOperationException("快照无效。");
        Adapter adapter = SelectedAdapter();
        if (backup.Adapter?.Id != adapter.Id || backup.Addresses is null || backup.Addresses.Any(value => !SystemTasks.IsIpv4(value)))
            throw new InvalidOperationException("快照与选中的网卡不符，或内容无效。");
        if (!Confirm("恢复 IPv4 DNS", $"网卡：{adapter.Name}\n恢复至：{DescribeDns(backup)}\n\n会重置当前 DNS。按需请求 Windows 管理员授权。")) return null;
        await SystemTasks.ApplyDns(backup with { Adapter = adapter });
        DnsBackup effective = await SystemTasks.ReadDns(adapter);
        if (!effective.Addresses.SequenceEqual(backup.Addresses))
            throw new InvalidOperationException($"系统当前配置为 {DescribeDns(effective)}，与快照不一致。");
        return $"DNS 已恢复至 {DescribeDns(backup)}";
    }

    private async Task<string?> ChangeAdapter(bool enabled)
    {
        Adapter adapter = SelectedAdapter();
        string mode = enabled ? "启用" : "禁用";
        if (!Confirm($"{mode}网卡", $"网卡：{adapter.Name}\n\n禁用网卡可能中断网络和远程连接。本机可通过本页或 Windows 设置重新启用。按需请求 Windows 管理员授权。")) return null;
        await SystemTasks.SetAdapter(adapter, enabled);
        return $"{adapter.Name} 已{mode}";
    }

    private void ExplainPlan(RichTextBox output)
    {
        string input = question.Text.Trim();
        output.Text = input switch
        {
            var text when text.Contains("DNS", StringComparison.OrdinalIgnoreCase) => "本地规则方案\n\n1. 进入「网络与 DNS」读取并选择网卡。\n2. 检查当前配置和 DNS 快照。\n3. 手动输入新地址，核对影响后确认。\n4. 若解析异常，使用快照恢复。",
            var text when text.Contains("开发") || text.Contains("Node", StringComparison.OrdinalIgnoreCase) => "本地规则方案\n\n1. 点击「检查开发工具」读取实际路径。\n2. 从受控清单选择需要的软件。\n3. 核对 winget 软件 ID 和安装影响后选择安装。",
            var text when text.Contains("网") => "本地规则方案\n\n1. 在「网络与 DNS」读取网卡。\n2. 检查 IP 地址、默认网关和 DNS。\n3. 如果只是诊断，保留当前配置。",
            "" => "输入要检查的任务。支持网络、DNS 和开发环境。",
            _ => "当前本地规则未匹配这个任务。请尝试描述网络、DNS 或开发环境问题。",
        };
        status.Text = "本地方案已生成";
    }

    private void SaveReport(RichTextBox output)
    {
        using var dlg = new SaveFileDialog { Filter = "文本报告|*.txt", FileName = $"jimi-report-{DateTime.Now:yyyyMMdd-HHmm}.txt" };
        if (dlg.ShowDialog(this) == DialogResult.OK) File.WriteAllText(dlg.FileName, output.Text);
    }
}
