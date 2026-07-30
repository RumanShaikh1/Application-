using System.Diagnostics;
using Microsoft.Web.WebView2.Core;
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
    private static readonly string ServerEnvPath = Path.Combine(ServerDir, ".env");
    private static readonly string ServerEnvExamplePath = Path.Combine(ServerDir, ".env.example");

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

        EnsureServerEnvFile();

        SetStatus("Starting the local server...");
        if (!await EnsureHealthyAsync(ServerHealthUrl, TsxPath, ServerDir, "src/index.ts", "server")) return;

        SetStatus("Starting the web app...");
        if (!await EnsureHealthyAsync(WebHealthUrl, VitePath, WebDir, null, "web")) return;

        if (!await EnsureWebView2RuntimeAsync()) return;

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
            ShowError($"Could not start the embedded browser, even though the WebView2 Runtime was detected.\n\n{ex.Message}");
        }
    }

    /// <summary>
    /// The WebView2 Runtime ships pre-installed on almost all Windows 10/11
    /// machines (bundled with Windows, kept current by Edge's own updater),
    /// but is not strictly guaranteed everywhere (locked-down enterprise
    /// images, some Windows N editions, older builds). Rather than just
    /// erroring if it's missing, this checks for it via the documented
    /// GetAvailableBrowserVersionString probe and, if absent, downloads and
    /// silently runs Microsoft's official "Evergreen Bootstrapper" (the
    /// small ~2MB installer Microsoft explicitly publishes for exactly this
    /// use case - see "Distribute your app and the WebView2 Runtime" in
    /// Microsoft's WebView2 docs) rather than leaving the user to find and
    /// install it by hand. The bootstrapper's own manifest requests
    /// elevation, so UseShellExecute=true here is required for Windows to
    /// show the real UAC prompt - that prompt appearing is expected, not a
    /// bug, on any machine that genuinely needs this step.
    ///
    /// NOT exercised end-to-end: the Runtime is already present on the
    /// machine this was written on, so only the "already installed" branch
    /// (the GetAvailableBrowserVersionString call succeeding) has actually
    /// been run. The download-and-install branch is reasoned from
    /// Microsoft's documented bootstrapper contract, not verified live.
    /// </summary>
    private async Task<bool> EnsureWebView2RuntimeAsync()
    {
        const string bootstrapperUrl = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";
        const string manualDownloadUrl = "https://developer.microsoft.com/microsoft-edge/webview2/";

        try
        {
            var version = CoreWebView2Environment.GetAvailableBrowserVersionString();
            if (!string.IsNullOrEmpty(version)) return true;
        }
        catch
        {
            // Treated as "not found" below regardless of the specific
            // exception - EnsureCoreWebView2Async will still surface a real
            // error afterward if installing doesn't actually fix it.
        }

        SetStatus("Installing the WebView2 Runtime (one-time - a Windows security prompt may appear)...");
        var bootstrapperPath = Path.Combine(Path.GetTempPath(), "MicrosoftEdgeWebview2Setup.exe");
        try
        {
            using var http = new HttpClient();
            var bytes = await http.GetByteArrayAsync(bootstrapperUrl);
            await File.WriteAllBytesAsync(bootstrapperPath, bytes);

            var psi = new ProcessStartInfo
            {
                FileName = bootstrapperPath,
                Arguments = "/silent /install",
                UseShellExecute = true
            };
            using var process = Process.Start(psi)!;
            await process.WaitForExitAsync();
        }
        catch (Exception ex)
        {
            ShowError($"Could not automatically install the WebView2 Runtime.\n\nInstall it manually from:\n{manualDownloadUrl}\n\nThen reopen MarketPane.\n\n{ex.Message}");
            return false;
        }

        try
        {
            var version = CoreWebView2Environment.GetAvailableBrowserVersionString();
            if (!string.IsNullOrEmpty(version)) return true;
        }
        catch
        {
            // Falls through to the same error below.
        }

        ShowError($"The WebView2 Runtime still isn't detected after attempting to install it.\n\nInstall it manually from:\n{manualDownloadUrl}\n\nThen reopen MarketPane.");
        return false;
    }

    private async Task<bool> EnsureHealthyAsync(string healthUrl, string exePath, string workingDir, string? scriptArg, string label)
    {
        if (await IsHealthyAsync(healthUrl)) return true;

        if (!File.Exists(exePath))
        {
            SetStatus($"Setting up {label} for the first time (installing dependencies - this can take a minute)...");
            if (!await InstallDependenciesAsync(workingDir, label)) return false;
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

    /// <summary>
    /// Copies server/.env.example -> server/.env the first time only - never
    /// overwrites a real, already-configured .env. The server starts fine on
    /// the placeholder key (see server/src/gemini.ts): only the Gemini-powered
    /// features need a real one, added later at the user's own pace. Mirrors
    /// Ensure-ServerEnvFile in launcher/MarketPane.ps1 and
    /// ensure_server_env_file in launcher/mac/.../MarketPane.
    /// </summary>
    private static void EnsureServerEnvFile()
    {
        if (File.Exists(ServerEnvExamplePath) && !File.Exists(ServerEnvPath))
        {
            File.Copy(ServerEnvExamplePath, ServerEnvPath);
        }
    }

    /// <summary>
    /// `npm install` for one workspace, run synchronously (awaited) so the
    /// caller can rely on node_modules existing once this returns true. The
    /// one truly unavoidable manual step this can't remove is Node.js itself
    /// not being installed at all - mirrors Install-Dependencies in
    /// launcher/MarketPane.ps1 and install_dependencies in launcher/mac/.
    /// </summary>
    private async Task<bool> InstallDependenciesAsync(string workingDir, string label)
    {
        var npmPath = FindNpmOnPath();
        if (npmPath is null)
        {
            ShowError($"Node.js isn't installed, so MarketPane can't set up {label} automatically.\n\nInstall Node.js (the LTS version) from https://nodejs.org, then reopen MarketPane.");
            return false;
        }

        var installLog = Path.Combine(workingDir, "npm-install.log");
        var installErrLog = Path.Combine(workingDir, "npm-install.err.log");
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = npmPath,
                Arguments = "install",
                WorkingDirectory = workingDir,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            using var process = Process.Start(psi)!;
            var stdOutTask = process.StandardOutput.ReadToEndAsync();
            var stdErrTask = process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();
            await File.WriteAllTextAsync(installLog, await stdOutTask);
            await File.WriteAllTextAsync(installErrLog, await stdErrTask);

            if (process.ExitCode != 0)
            {
                ShowError($"Setting up {label} failed (npm install exited with code {process.ExitCode}).\n\nSee:\n{installErrLog}\n\nor run 'npm install' inside {workingDir} yourself to see the live error.");
                return false;
            }
        }
        catch (Exception ex)
        {
            ShowError($"Could not run 'npm install' for {label}:\n\n{ex.Message}");
            return false;
        }
        return true;
    }

    /// <summary>
    /// Resolves npm.cmd from PATH manually (Process.Start with
    /// UseShellExecute=false does not consult PATHEXT the way a shell would),
    /// checking PATHEXT's own extension list rather than hardcoding ".cmd" -
    /// npm ships as npm.cmd on Windows in every install method observed
    /// (installer, nvm-windows, winget), but this stays correct if that ever
    /// changes.
    /// </summary>
    private static string? FindNpmOnPath()
    {
        var pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
        var pathExt = Environment.GetEnvironmentVariable("PATHEXT") ?? ".COM;.EXE;.BAT;.CMD";
        var extensions = pathExt.Split(';', StringSplitOptions.RemoveEmptyEntries);
        foreach (var dir in pathEnv.Split(';', StringSplitOptions.RemoveEmptyEntries))
        {
            foreach (var ext in extensions)
            {
                var candidate = Path.Combine(dir, "npm" + ext);
                if (File.Exists(candidate)) return candidate;
            }
        }
        return null;
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
