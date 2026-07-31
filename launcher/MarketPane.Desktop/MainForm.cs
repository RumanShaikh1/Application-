using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace MarketPane.Desktop;

/// <summary>
/// A genuinely zero-prerequisite MarketPane: everything it needs to run -
/// a portable Node.js runtime, the bundled server, the built web app, and
/// its data fixtures - is embedded directly in this .exe (see
/// scripts/pack-embedded-runtime.mjs and the EmbeddedResource entry in
/// MarketPane.Desktop.csproj). No system-installed Node.js, no `npm
/// install`, no separate repo checkout on the machine this runs on - the
/// first launch extracts that embedded runtime once, then every launch
/// after just starts the already-extracted server and shows it in a real
/// embedded Chromium engine (WebView2 - the same engine as modern Edge).
/// </summary>
public class MainForm : Form
{
    private static readonly string AppDataDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MarketPane");
    private static readonly string RuntimeDir = Path.Combine(AppDataDir, "runtime");
    private static readonly string RuntimeVersionMarkerPath = Path.Combine(RuntimeDir, ".runtime-version");
    private static readonly string NodeExePath = Path.Combine(RuntimeDir, "node.exe");
    private static readonly string ServerScriptPath = Path.Combine(RuntimeDir, "server.mjs");
    private static readonly string WebDistPath = Path.Combine(RuntimeDir, "web-dist");
    private static readonly string ServerDataDir = Path.Combine(RuntimeDir, "data");
    private static readonly string ServerEnvPath = Path.Combine(RuntimeDir, ".env");
    private static readonly string ServerEnvExamplePath = Path.Combine(RuntimeDir, ".env.example");

    private const string RuntimeResourceName = "MarketPane.Desktop.runtime.zip";
    private const int ServerPort = 8787;
    private const string ServerHealthUrl = "http://localhost:8787/health";
    private const string SimulatorUrl = "http://localhost:8787/simulator";

    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(2) };

    private readonly Panel _statusPanel;
    private readonly Label _statusLabel;
    private readonly Button _retryButton;
    private readonly WebView2 _webView;
    private Process? _serverProcess;

    public MainForm()
    {
        Text = "MarketPane";
        Width = 1280;
        Height = 900;
        StartPosition = FormStartPosition.CenterScreen;

        try
        {
            // Pulled straight from this exe's own Win32 resources (set via
            // <ApplicationIcon> in the csproj) instead of a sibling file on
            // disk - there's no repo checkout to find one in anymore.
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        }
        catch
        {
            // Cosmetic only - falls back to the default WinForms icon.
        }

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

        // The embedded server has no reason to keep running once this
        // window closes - without this, every launch would leave an
        // orphaned node.exe behind, silently accumulating across runs.
        FormClosed += (_, _) => StopServerProcess();

        Load += async (_, _) => await StartAsync();
    }

    private async Task StartAsync()
    {
        _retryButton.Visible = false;
        _statusPanel.Visible = true;
        _webView.Visible = false;

        if (!await EnsureEmbeddedRuntimeAsync()) return;

        EnsureServerEnvFile();

        SetStatus("Starting MarketPane...");
        if (!await EnsureServerRunningAsync()) return;

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
    /// Extracts the embedded node.exe + bundled server + built web app +
    /// data fixtures to %LOCALAPPDATA%\MarketPane\runtime the first time
    /// MarketPane runs - the one-time cost of not needing Node.js, npm, or
    /// this app's own source checkout present on the machine at all. A
    /// version marker (this assembly's own file version) means a future
    /// release that ships a newer embedded runtime re-extracts instead of
    /// silently running a stale bundled server against a newer web build,
    /// or vice versa. Re-extraction never touches a real .env the user has
    /// already added a Gemini key to - only .env.example ships in the zip,
    /// .env itself is never part of it (see EnsureServerEnvFile).
    /// </summary>
    private async Task<bool> EnsureEmbeddedRuntimeAsync()
    {
        var currentVersion = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "0";
        if (File.Exists(NodeExePath) && File.Exists(ServerScriptPath) && File.Exists(RuntimeVersionMarkerPath)
            && File.ReadAllText(RuntimeVersionMarkerPath) == currentVersion)
        {
            return true;
        }

        SetStatus("Setting up MarketPane (one-time, ~100MB)...");
        try
        {
            await Task.Run(() =>
            {
                Directory.CreateDirectory(RuntimeDir);
                using var resourceStream = Assembly.GetExecutingAssembly().GetManifestResourceStream(RuntimeResourceName)
                    ?? throw new InvalidOperationException($"Embedded resource \"{RuntimeResourceName}\" was not found in this build.");
                using var archive = new ZipArchive(resourceStream, ZipArchiveMode.Read);
                archive.ExtractToDirectory(RuntimeDir, overwriteFiles: true);
                File.WriteAllText(RuntimeVersionMarkerPath, currentVersion);
            });
        }
        catch (Exception ex)
        {
            ShowError($"Could not set up MarketPane's runtime files:\n\n{ex.Message}");
            return false;
        }
        return true;
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

    /// <summary>
    /// Starts the already-extracted, bundled server (node.exe server.mjs -
    /// no npm, no node_modules, nothing to install) and waits for it to
    /// report healthy. PORT/WEB_DIST_PATH/SERVER_DATA_DIR point it at the
    /// extracted runtime folder explicitly rather than relying on any
    /// relative-path fallback in the bundle (see server/src/dataDir.ts and
    /// the web-dist block in server/src/index.ts).
    /// </summary>
    private async Task<bool> EnsureServerRunningAsync()
    {
        if (await IsHealthyAsync(ServerHealthUrl)) return true;

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = NodeExePath,
                WorkingDirectory = RuntimeDir,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            psi.ArgumentList.Add(ServerScriptPath);
            psi.Environment["PORT"] = ServerPort.ToString();
            psi.Environment["WEB_DIST_PATH"] = WebDistPath;
            psi.Environment["SERVER_DATA_DIR"] = ServerDataDir;
            // The packaged app serves the web app and the API from the same
            // origin (this port) by design - the web app's own fetch() calls
            // to its own API still carry an Origin header (see the
            // /api-scoped CORS comment in server/src/index.ts), so that
            // origin needs to be in the allowlist. Set explicitly rather
            // than relying on .env's WEB_ORIGIN=localhost:5173 default,
            // which is for the separate-dev-server case only. dotenv never
            // overrides an already-set process env var, so this always wins
            // over whatever's in the extracted .env.
            psi.Environment["WEB_ORIGIN"] = $"http://localhost:{ServerPort}";
            _serverProcess = Process.Start(psi);
        }
        catch (Exception ex)
        {
            ShowError($"Could not start the local server:\n\n{ex.Message}");
            return false;
        }

        for (var attempt = 0; attempt < 20; attempt++)
        {
            if (await IsHealthyAsync(ServerHealthUrl)) return true;
            await Task.Delay(500);
        }

        ShowError("The local server didn't come up after 10 seconds.");
        return false;
    }

    private void StopServerProcess()
    {
        try
        {
            if (_serverProcess is { HasExited: false }) _serverProcess.Kill(entireProcessTree: true);
        }
        catch
        {
            // Best effort - the OS reclaims the process either way once this app exits.
        }
    }

    /// <summary>
    /// Copies .env.example -> .env the first time only - never overwrites a
    /// real, already-configured .env. The server starts fine on the
    /// placeholder key (see server/src/gemini.ts): only the Gemini-powered
    /// features need a real one, added later at the user's own pace.
    /// </summary>
    private static void EnsureServerEnvFile()
    {
        if (File.Exists(ServerEnvExamplePath) && !File.Exists(ServerEnvPath))
        {
            File.Copy(ServerEnvExamplePath, ServerEnvPath);
        }
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
