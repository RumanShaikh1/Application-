using System.Diagnostics;
using Microsoft.Web.WebView2.WinForms;

namespace MarketPane.Desktop;

/// <summary>
/// Compiled replacement for the old MarketPane.ps1 launcher: instead of
/// starting the local server and opening a separate system browser, this
/// starts both the API server and the web app's dev server, then embeds a
/// real Chromium engine (WebView2 - the same engine as modern Edge) inside
/// this one window. Everything (Decision Replay, the Simulator, Tax
/// Understanding) runs inside the application itself, with full internet
/// access, not a separate browser process.
/// </summary>
public class MainForm : Form
{
    private static readonly string RepoRoot = FindRepoRoot();
    private static readonly string ServerDir = Path.Combine(RepoRoot, "server");
    private static readonly string WebDir = Path.Combine(RepoRoot, "web");
    private static readonly string TsxPath = Path.Combine(ServerDir, "node_modules", ".bin", "tsx.cmd");
    private static readonly string VitePath = Path.Combine(WebDir, "node_modules", ".bin", "vite.cmd");

    private const string ServerHealthUrl = "http://localhost:8787/health";
    private const string WebHealthUrl = "http://localhost:5173/";
    private const string SimulatorUrl = "http://localhost:5173/simulator";

    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(2) };

    private readonly Panel _statusPanel;
    private readonly Label _statusLabel;
    private readonly Button _retryButton;
    private readonly WebView2 _webView;

    public MainForm()
    {
        Text = "MarketPane";
        Width = 1280;
        Height = 900;
        StartPosition = FormStartPosition.CenterScreen;

        var iconPath = Path.Combine(RepoRoot, "launcher", "assets", "app-icon.ico");
        if (File.Exists(iconPath)) Icon = new Icon(iconPath);

        _statusLabel = new Label
        {
            Text = "Starting MarketPane...",
            AutoSize = false,
            Dock = DockStyle.Top,
            Height = 60,
            TextAlign = ContentAlignment.MiddleCenter,
            Font = new Font("Segoe UI", 12F)
        };

        _retryButton = new Button
        {
            Text = "Retry",
            AutoSize = true,
            Visible = false,
            Anchor = AnchorStyles.None
        };
        _retryButton.Click += async (_, _) => await StartAsync();

        var retryHost = new Panel { Dock = DockStyle.Top, Height = 40 };
        _retryButton.Location = new Point(0, 0);
        retryHost.Resize += (_, _) => _retryButton.Left = (retryHost.Width - _retryButton.Width) / 2;
        retryHost.Controls.Add(_retryButton);

        _statusPanel = new Panel { Dock = DockStyle.Fill };
        _statusPanel.Controls.Add(retryHost);
        _statusPanel.Controls.Add(_statusLabel);

        _webView = new WebView2 { Dock = DockStyle.Fill, Visible = false };

        Controls.Add(_webView);
        Controls.Add(_statusPanel);

        Load += async (_, _) => await StartAsync();
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var hasServer = File.Exists(Path.Combine(dir.FullName, "server", "package.json"));
            var hasWeb = File.Exists(Path.Combine(dir.FullName, "web", "package.json"));
            if (hasServer && hasWeb) return dir.FullName;
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException(
            $"Could not locate the MarketPane repo root (a directory containing both server/package.json and web/package.json) above {AppContext.BaseDirectory}.");
    }

    private async Task StartAsync()
    {
        _retryButton.Visible = false;
        _statusPanel.Visible = true;
        _webView.Visible = false;

        SetStatus("Starting the local server...");
        if (!await EnsureHealthyAsync(ServerHealthUrl, TsxPath, ServerDir, "src/index.ts", "server")) return;

        SetStatus("Starting the web app...");
        if (!await EnsureHealthyAsync(WebHealthUrl, VitePath, WebDir, null, "web")) return;

        SetStatus("Loading...");
        try
        {
            await _webView.EnsureCoreWebView2Async();
            _webView.CoreWebView2.Navigate(SimulatorUrl);
            _webView.Visible = true;
            _statusPanel.Visible = false;
        }
        catch (Exception ex)
        {
            ShowError($"Could not start the embedded browser - is the WebView2 Runtime installed? (It ships with Windows 10/11 in almost all cases.)\n\n{ex.Message}");
        }
    }

    private async Task<bool> EnsureHealthyAsync(string healthUrl, string exePath, string workingDir, string? scriptArg, string label)
    {
        if (await IsHealthyAsync(healthUrl)) return true;

        if (!File.Exists(exePath))
        {
            ShowError($"The {label} app's dependencies aren't installed yet.\n\nOpen a terminal and run:\n  cd {label}\n  npm install\n\nThen reopen MarketPane.");
            return false;
        }

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = exePath,
                WorkingDirectory = workingDir,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            if (scriptArg is not null) psi.ArgumentList.Add(scriptArg);
            Process.Start(psi);
        }
        catch (Exception ex)
        {
            ShowError($"Could not start the {label}:\n\n{ex.Message}");
            return false;
        }

        for (var attempt = 0; attempt < 20; attempt++)
        {
            if (await IsHealthyAsync(healthUrl)) return true;
            await Task.Delay(500);
        }

        ShowError($"The {label} didn't come up after 10 seconds. Run 'npm run dev' inside {label}/ directly to see the error.");
        return false;
    }

    private static async Task<bool> IsHealthyAsync(string url)
    {
        try
        {
            using var response = await Http.GetAsync(url);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private void SetStatus(string text)
    {
        _statusLabel.Text = text;
    }

    private void ShowError(string message)
    {
        _statusLabel.Text = message;
        _retryButton.Visible = true;
        MessageBox.Show(message, "MarketPane", MessageBoxButtons.OK, MessageBoxIcon.Error);
    }
}
