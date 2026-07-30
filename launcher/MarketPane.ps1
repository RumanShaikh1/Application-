# MarketPane launcher - a real standalone app window (not a silent
# background script). First run prompts you to link a browser; after that
# it starts the local server and opens your linked browser on demand.
# Errors are shown in message boxes - nothing fails silently.

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# powershell.exe declares no DPI-awareness manifest, so on a scaled display
# (this machine runs ~150%) Windows silently upscales a rendered-at-96dpi
# bitmap of the whole window instead of drawing it natively - it still
# *works*, it just looks blurry/fuzzy, which reads as "something's wrong"
# even though nothing is functionally broken. Opt in to real per-monitor
# DPI awareness before any Form exists, with a fallback for older Windows.
Add-Type @"
using System.Runtime.InteropServices;
public class DpiAwareness {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetProcessDpiAwarenessContext(int value);
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();
}
"@
$DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = -4
if (-not [DpiAwareness]::SetProcessDpiAwarenessContext($DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)) {
    [DpiAwareness]::SetProcessDPIAware() | Out-Null
}
[System.Windows.Forms.Application]::EnableVisualStyles()

$root = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $root 'server'
$tsx = Join-Path $serverDir 'node_modules\.bin\tsx.cmd'
$serverEnvPath = Join-Path $serverDir '.env'
$serverEnvExamplePath = Join-Path $serverDir '.env.example'
$healthUrl = 'http://localhost:8787/health'
# The API server (above) only serves JSON - the Simulator (and Decision
# Replay, Tax Understanding) are the web/ React app, served by its own Vite
# dev server. Previously this launcher started only the API and opened a
# blank browser window, leaving the actual app unreachable unless you knew
# to start web/ and navigate there yourself.
$webDir = Join-Path $root 'web'
$vite = Join-Path $webDir 'node_modules\.bin\vite.cmd'
$webUrl = 'http://localhost:5173'
$simulatorUrl = 'http://localhost:5173/simulator'
$extensionDir = Join-Path $root 'extension'
$extensionDistManifest = Join-Path $extensionDir 'dist\manifest.json'
$iconPath = Join-Path $PSScriptRoot 'assets\app-icon.ico'
$configDir = Join-Path $env:APPDATA 'MarketPane'
$configPath = Join-Path $configDir 'config.json'

$appIcon = if (Test-Path $iconPath) { New-Object System.Drawing.Icon($iconPath) } else { [System.Drawing.SystemIcons]::Application }

function Show-ErrorBox([string]$message) {
    [System.Windows.Forms.MessageBox]::Show($message, 'MarketPane', 'OK', 'Error') | Out-Null
}

function Show-InfoBox([string]$message) {
    [System.Windows.Forms.MessageBox]::Show($message, 'MarketPane', 'OK', 'Information') | Out-Null
}

# Copies server/.env.example -> server/.env the first time only - never
# overwrites a real, already-configured .env. The server starts fine on the
# placeholder key (see server/src/gemini.ts): only the Gemini-powered
# features (translate, context, AI trade-rationale grading) need a real one,
# added later at the user's own pace.
function Ensure-ServerEnvFile {
    if ((Test-Path $serverEnvExamplePath) -and -not (Test-Path $serverEnvPath)) {
        Copy-Item $serverEnvExamplePath $serverEnvPath
    }
}

# `npm install` for one workspace, run synchronously (blocking, with a
# visible status update) so the caller can rely on node_modules existing
# once this returns true. The one truly unavoidable manual step this can't
# remove is Node.js itself not being installed at all - there's no safe way
# to silently install a system-wide runtime on someone else's machine, so
# that case gets a clear, actionable error instead of a silent failure.
function Install-Dependencies([string]$workDir, [string]$label, [System.Windows.Forms.Label]$statusLabel) {
    $npmCmd = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
    if (-not $npmCmd) { $npmCmd = Get-Command 'npm' -ErrorAction SilentlyContinue }
    if (-not $npmCmd) {
        Show-ErrorBox "Node.js isn't installed, so MarketPane can't set up $label automatically.`n`nInstall Node.js (the LTS version) from https://nodejs.org, then reopen MarketPane."
        return $false
    }

    if ($statusLabel) {
        $statusLabel.Text = "Setting up $label for the first time (installing dependencies - this can take a minute)..."
        $statusLabel.Refresh()
    }

    $installLog = Join-Path $workDir 'npm-install.log'
    $installErrLog = Join-Path $workDir 'npm-install.err.log'
    try {
        $process = Start-Process -FilePath $npmCmd.Source -ArgumentList 'install' -WorkingDirectory $workDir -WindowStyle Hidden -Wait -PassThru `
            -RedirectStandardOutput $installLog -RedirectStandardError $installErrLog
    } catch {
        Show-ErrorBox "Could not run 'npm install' for $label`:`n`n$_"
        return $false
    }

    if ($process.ExitCode -ne 0) {
        Show-ErrorBox "Setting up $label failed (npm install exited with code $($process.ExitCode)).`n`nSee:`n$installErrLog`n`nor run 'npm install' inside $workDir yourself to see the live error."
        return $false
    }
    return $true
}

# Builds extension/dist the first time only (checked via its manifest.json,
# not just folder existence - a partial/failed prior build could leave the
# folder present but empty). Loading it into the browser afterward still
# needs one manual click at chrome://extensions - Chrome deliberately
# requires that gesture for unpacked extensions, and no script can bypass
# it, so this only removes the *build* step, not the load step.
function Ensure-ExtensionBuilt([System.Windows.Forms.Label]$statusLabel) {
    if (Test-Path $extensionDistManifest) { return $true }

    if (-not (Install-Dependencies -workDir $extensionDir -label 'the browser extension' -statusLabel $statusLabel)) {
        return $false
    }

    $npmCmd = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
    if (-not $npmCmd) { $npmCmd = Get-Command 'npm' -ErrorAction SilentlyContinue }
    if (-not $npmCmd) { return $false }

    if ($statusLabel) {
        $statusLabel.Text = 'Building the browser extension for the first time...'
        $statusLabel.Refresh()
    }

    $buildLog = Join-Path $extensionDir 'npm-build.log'
    $buildErrLog = Join-Path $extensionDir 'npm-build.err.log'
    try {
        $process = Start-Process -FilePath $npmCmd.Source -ArgumentList 'run', 'build' -WorkingDirectory $extensionDir -WindowStyle Hidden -Wait -PassThru `
            -RedirectStandardOutput $buildLog -RedirectStandardError $buildErrLog
    } catch {
        Show-ErrorBox "Could not build the browser extension:`n`n$_"
        return $false
    }

    if ($process.ExitCode -ne 0) {
        Show-ErrorBox "Building the browser extension failed (exit code $($process.ExitCode)).`n`nSee:`n$buildErrLog"
        return $false
    }
    return (Test-Path $extensionDistManifest)
}

# The App Paths registry convention every major browser installer
# registers (HKLM for a machine-wide install, WOW6432Node for a 32-bit
# entry seen from 64-bit PowerShell, HKCU for a per-user "just for me"
# install, e.g. Chrome/Edge via winget or an MSIX/Store package). This is
# the same mechanism Windows itself uses to resolve "chrome" -> its real
# install path without a full path, so it finds a browser regardless of
# *where* it happens to be installed - not just the handful of default
# Program Files locations a fixed path list can guess.
function Get-BrowserPathFromAppPaths([string]$exeName) {
    $roots = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths'
    )
    foreach ($root in $roots) {
        $key = Get-Item -Path (Join-Path $root $exeName) -ErrorAction SilentlyContinue
        if ($key) {
            $path = $key.GetValue('')
            if ($path -and (Test-Path $path)) { return $path }
        }
    }
    return $null
}

function Get-InstalledBrowsers {
    # Display-preference order. Falls back to a handful of fixed default
    # paths per browser for the rare case one somehow didn't register App
    # Paths - belt-and-suspenders, not the primary detection path anymore.
    $knownBrowsers = [ordered]@{
        'chrome.exe'  = @{ Name = 'Google Chrome'; Fallbacks = @(
            "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
            "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
            "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
        ) }
        'msedge.exe'  = @{ Name = 'Microsoft Edge'; Fallbacks = @(
            "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
            "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
        ) }
        'firefox.exe' = @{ Name = 'Mozilla Firefox'; Fallbacks = @(
            "$env:ProgramFiles\Mozilla Firefox\firefox.exe",
            "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe"
        ) }
        'brave.exe'   = @{ Name = 'Brave'; Fallbacks = @(
            "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe"
        ) }
        'opera.exe'   = @{ Name = 'Opera'; Fallbacks = @() }
        'vivaldi.exe' = @{ Name = 'Vivaldi'; Fallbacks = @() }
        'arc.exe'     = @{ Name = 'Arc'; Fallbacks = @() }
    }

    $found = @()
    foreach ($exeName in $knownBrowsers.Keys) {
        $info = $knownBrowsers[$exeName]
        $path = Get-BrowserPathFromAppPaths $exeName
        if (-not $path) {
            $path = $info.Fallbacks | Where-Object { Test-Path $_ } | Select-Object -First 1
        }
        if ($path) {
            $found += [PSCustomObject]@{ Name = $info.Name; Path = $path }
        }
    }
    return $found
}

function Load-Config {
    if (Test-Path $configPath) {
        try {
            return Get-Content $configPath -Raw | ConvertFrom-Json
        } catch {
            return $null
        }
    }
    return $null
}

function Save-Config([string]$browserName, [string]$browserPath) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    @{ browserName = $browserName; browserPath = $browserPath } | ConvertTo-Json | Set-Content $configPath
}

# Returns @{ Name = ...; Path = ... } or $null if the user cancelled.
function Show-BrowserPicker {
    $installed = Get-InstalledBrowsers

    # AutoScaleMode=Dpi is deliberately NOT set here: combined with the
    # process-level DPI awareness above and per-control AutoSize below, it
    # double-applies DPI scaling (the form scales control bounds AND each
    # AutoSize control re-measures itself against the now-correct system
    # DPI) which leaves ghosted/doubled text baked into the real rendered
    # window, not just a screenshot artifact - reproduced and confirmed via
    # a raw CopyFromScreen capture, not just PrintWindow. Process-level
    # awareness alone is suffient for crisp (non-blurry) rendering.
    $form = New-Object System.Windows.Forms.Form
    $form.Text = 'Link MarketPane to a browser'
    $form.Icon = $appIcon
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.StartPosition = 'CenterScreen'
    $form.ClientSize = New-Object System.Drawing.Size(440, 300)

    $title = New-Object System.Windows.Forms.Label
    $title.Text = 'Choose the browser MarketPane should open.'
    $title.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
    $title.AutoSize = $true
    $title.MaximumSize = New-Object System.Drawing.Size(408, 0)
    $title.SetBounds(16, 16, 0, 0)
    $form.Controls.Add($title)

    $subtitle = New-Object System.Windows.Forms.Label
    $subtitle.Text = 'The Jargon Buster extension must be loaded (once) in this browser via chrome://extensions or edge://extensions.'
    $subtitle.AutoSize = $true
    $subtitle.MaximumSize = New-Object System.Drawing.Size(408, 0)
    $subtitle.SetBounds(16, ($title.Bottom + 8), 0, 0)
    $form.Controls.Add($subtitle)

    # Labels are AutoSize, so their real height depends on how many lines
    # the subtitle wrapped to at this DPI/font - measure it instead of
    # assuming a fixed offset, or controls below can end up overlapping it.
    $radios = @()
    $y = $subtitle.Bottom + 16
    foreach ($browser in $installed) {
        $radio = New-Object System.Windows.Forms.RadioButton
        $radio.Text = $browser.Name
        $radio.Tag = $browser.Path
        $radio.SetBounds(24, $y, 380, 24)
        $form.Controls.Add($radio)
        $radios += $radio
        $y += 28
    }
    if ($radios.Count -gt 0) { $radios[0].Checked = $true }

    $customRadio = New-Object System.Windows.Forms.RadioButton
    $customRadio.Text = 'Other (browse for the .exe)...'
    $customRadio.SetBounds(24, $y, 380, 24)
    $form.Controls.Add($customRadio)
    $y += 32

    $customPathBox = New-Object System.Windows.Forms.TextBox
    $customPathBox.SetBounds(24, $y, 320, 22)
    $customPathBox.Enabled = $false
    $form.Controls.Add($customPathBox)

    $browseButton = New-Object System.Windows.Forms.Button
    $browseButton.Text = '...'
    $browseButton.SetBounds(350, $y - 1, 34, 24)
    $browseButton.Enabled = $false
    $form.Controls.Add($browseButton)
    $y += 40

    $onCustomToggle = {
        $customPathBox.Enabled = $customRadio.Checked
        $browseButton.Enabled = $customRadio.Checked
    }
    $customRadio.Add_CheckedChanged($onCustomToggle)
    foreach ($radio in $radios) { $radio.Add_CheckedChanged($onCustomToggle) }

    $browseDialogAction = {
        $dialog = New-Object System.Windows.Forms.OpenFileDialog
        $dialog.Filter = 'Applications (*.exe)|*.exe'
        if ($dialog.ShowDialog() -eq 'OK') { $customPathBox.Text = $dialog.FileName }
    }
    $browseButton.Add_Click($browseDialogAction)

    # Nothing was auto-detected - "Other" is the user's only option anyway,
    # so pre-select it and open the file picker immediately instead of
    # making them notice "Other", check it, then find and click "...".
    if ($installed.Count -eq 0) {
        $customRadio.Checked = $true
        $form.Add_Shown({ & $browseDialogAction }.GetNewClosure())
    }

    $y += 12
    $continueButton = New-Object System.Windows.Forms.Button
    $continueButton.Text = 'Link Browser'
    $continueButton.SetBounds(274, $y, 150, 30)
    $continueButton.DialogResult = 'OK'
    $form.Controls.Add($continueButton)
    $form.AcceptButton = $continueButton
    # Content height is dynamic (subtitle wrap + browser count), so size
    # the window to fit it snugly instead of a guessed fixed height.
    $form.ClientSize = New-Object System.Drawing.Size(440, ($y + 30 + 20))

    $result = $form.ShowDialog()
    if ($result -ne 'OK') { return $null }

    if ($customRadio.Checked) {
        if ([string]::IsNullOrWhiteSpace($customPathBox.Text) -or -not (Test-Path $customPathBox.Text)) {
            Show-ErrorBox 'Pick a valid browser executable, or choose one of the detected browsers.'
            return Show-BrowserPicker
        }
        return @{ Name = [System.IO.Path]::GetFileNameWithoutExtension($customPathBox.Text); Path = $customPathBox.Text }
    }

    $chosen = $radios | Where-Object { $_.Checked } | Select-Object -First 1
    if ($null -eq $chosen) {
        Show-ErrorBox 'No browsers were found on this machine automatically - use "Other" to browse for one.'
        return Show-BrowserPicker
    }
    return @{ Name = $chosen.Text; Path = $chosen.Tag }
}

function Test-ServerHealthy {
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
        return $response.ok -eq $true
    } catch {
        return $false
    }
}

# Returns $true if the server is confirmed healthy, $false otherwise -
# and always shows a real error, never fails silently.
function Start-ServerIfNeeded([System.Windows.Forms.Label]$statusLabel) {
    if (Test-ServerHealthy) { return $true }

    Ensure-ServerEnvFile

    if (-not (Test-Path $tsx)) {
        if (-not (Install-Dependencies -workDir $serverDir -label 'the server' -statusLabel $statusLabel)) {
            return $false
        }
    }

    try {
        Start-Process -FilePath $tsx -ArgumentList 'src/index.ts' -WorkingDirectory $serverDir -WindowStyle Hidden
    } catch {
        Show-ErrorBox "Could not start the local server:`n`n$_"
        return $false
    }

    $attempts = 0
    while (-not (Test-ServerHealthy) -and $attempts -lt 20) {
        Start-Sleep -Milliseconds 500
        $attempts++
    }

    if (-not (Test-ServerHealthy)) {
        Show-ErrorBox "The server didn't come up after 10 seconds. Check server/.env has a valid GEMINI_API_KEY, or run 'npm run dev' inside server/ directly to see the error."
        return $false
    }
    return $true
}

function Test-WebHealthy {
    try {
        $response = Invoke-WebRequest -Uri $webUrl -TimeoutSec 2 -UseBasicParsing
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

# Same shape as Start-ServerIfNeeded above - the Vite dev server is a
# second, independent local process, so it gets the same
# already-running/missing-deps/timeout handling rather than being assumed
# to "just work" because the API server did.
function Start-WebIfNeeded([System.Windows.Forms.Label]$statusLabel) {
    if (Test-WebHealthy) { return $true }

    if (-not (Test-Path $vite)) {
        if (-not (Install-Dependencies -workDir $webDir -label 'the web app' -statusLabel $statusLabel)) {
            return $false
        }
    }

    try {
        Start-Process -FilePath $vite -WorkingDirectory $webDir -WindowStyle Hidden
    } catch {
        Show-ErrorBox "Could not start the web app:`n`n$_"
        return $false
    }

    $attempts = 0
    while (-not (Test-WebHealthy) -and $attempts -lt 20) {
        Start-Sleep -Milliseconds 500
        $attempts++
    }

    if (-not (Test-WebHealthy)) {
        Show-ErrorBox "The web app didn't come up after 10 seconds. Run 'npm run dev' inside web/ directly to see the error."
        return $false
    }
    return $true
}

# Chromium's "--app=<url>" flag opens a borderless window with no address
# bar, tabs, or bookmarks bar - reads as a standalone app, not a browser tab,
# without needing a separately-compiled application at all. It's still the
# real, already-installed, already-trusted browser process under the hood
# (full internet access, no code-signing/reputation gate to clear - unlike a
# freshly-compiled .exe, which Windows 11's Smart App Control blocks outright
# on this machine regardless of how it's launched). Firefox is Gecko-based
# and has no equivalent flag, so it falls back to a normal window - as does
# any browser when -NoAppMode is passed, e.g. for chrome://extensions:
# internal browser pages are not guaranteed to render inside a borderless
# --app= window the way a normal web page does, and there is nothing to
# gain from app-mode on a settings page anyway.
function Open-Browser([string]$browserPath, [string]$browserName, [string]$url = $null, [switch]$NoAppMode) {
    try {
        if ($url -and -not $NoAppMode -and $browserName -notlike '*firefox*') {
            Start-Process -FilePath $browserPath -ArgumentList "--app=$url"
        } elseif ($url) {
            Start-Process -FilePath $browserPath -ArgumentList $url
        } else {
            Start-Process -FilePath $browserPath
        }
    } catch {
        Show-ErrorBox "Could not launch the linked browser at:`n$browserPath`n`n$_"
    }
}

# ---- main flow ----

$config = Load-Config
if ($null -eq $config -or [string]::IsNullOrWhiteSpace($config.browserPath) -or -not (Test-Path $config.browserPath)) {
    $picked = Show-BrowserPicker
    if ($null -eq $picked) { exit 0 }
    Save-Config -browserName $picked.Name -browserPath $picked.Path
    $config = Load-Config
}

$mainForm = New-Object System.Windows.Forms.Form
$mainForm.Text = 'MarketPane'
$mainForm.Icon = $appIcon
$mainForm.FormBorderStyle = 'FixedDialog'
$mainForm.MaximizeBox = $false
$mainForm.MinimizeBox = $true
$mainForm.StartPosition = 'CenterScreen'
$mainForm.ClientSize = New-Object System.Drawing.Size(360, 260)

# Every label below is positioned relative to the actual measured bottom
# of the one above it (not a guessed fixed offset) - a hardcoded gap here
# previously didn't account for how tall "MarketPane" actually renders at
# 14pt bold at this DPI, so the subtitle's top pixels genuinely overlapped
# the title's bottom pixels (confirmed via a true on-screen pixel capture,
# not just a screenshot-tool artifact - same class of bug already fixed in
# Show-BrowserPicker above).
$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = 'MarketPane'
$titleLabel.Font = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
$titleLabel.AutoSize = $true
$titleLabel.SetBounds(20, 16, 0, 0)
$mainForm.Controls.Add($titleLabel)

$subtitleLabel = New-Object System.Windows.Forms.Label
$subtitleLabel.Text = 'Learn the market as you browse it'
$subtitleLabel.ForeColor = [System.Drawing.Color]::DimGray
$subtitleLabel.AutoSize = $true
$subtitleLabel.SetBounds(20, ($titleLabel.Bottom + 4), 0, 0)
$mainForm.Controls.Add($subtitleLabel)

$browserLabel = New-Object System.Windows.Forms.Label
$browserLabel.Text = "Linked browser: $($config.browserName)"
$browserLabel.AutoSize = $true
$browserLabel.MaximumSize = New-Object System.Drawing.Size(320, 0)
$browserLabel.SetBounds(20, ($subtitleLabel.Bottom + 18), 0, 0)
$mainForm.Controls.Add($browserLabel)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = 'Server: starting...'
$statusLabel.AutoSize = $true
$statusLabel.SetBounds(20, ($browserLabel.Bottom + 4), 0, 0)
$mainForm.Controls.Add($statusLabel)

$openButton = New-Object System.Windows.Forms.Button
$openButton.Text = 'Open in Browser'
$openButton.SetBounds(20, ($statusLabel.Bottom + 20), 300, 32)
$openButton.Enabled = $false
$mainForm.Controls.Add($openButton)

$changeBrowserButton = New-Object System.Windows.Forms.Button
$changeBrowserButton.Text = 'Change Linked Browser...'
$changeBrowserButton.SetBounds(20, ($openButton.Bottom + 12), 300, 28)
$mainForm.Controls.Add($changeBrowserButton)

$mainForm.ClientSize = New-Object System.Drawing.Size(360, ($changeBrowserButton.Bottom + 20))

$openButton.Add_Click({
    $current = Load-Config
    Open-Browser $current.browserPath $current.browserName $simulatorUrl
})

$changeBrowserButton.Add_Click({
    $picked = Show-BrowserPicker
    if ($null -ne $picked) {
        Save-Config -browserName $picked.Name -browserPath $picked.Path
        $browserLabel.Text = "Linked browser: $($picked.Name)"
    }
})

$mainForm.Add_Shown({
    $mainForm.Activate()
    # Checked before any of the three setup steps run below, so this
    # reflects "was anything missing when MarketPane opened" - used after
    # everything succeeds to decide whether this is a genuine first run
    # worth a one-time welcome message, not just every-launch noise.
    $isFirstRun = -not (Test-Path $tsx) -or -not (Test-Path $vite) -or -not (Test-Path $extensionDistManifest)

    $statusLabel.Text = 'Server: starting...'
    $serverHealthy = Start-ServerIfNeeded -statusLabel $statusLabel
    if (-not $serverHealthy) {
        $statusLabel.Text = 'Server: not running (see error)'
        return
    }

    $statusLabel.Text = 'Server: running - starting app...'
    $webHealthy = Start-WebIfNeeded -statusLabel $statusLabel
    if (-not $webHealthy) {
        $statusLabel.Text = 'Server: running on localhost:8787 - app: not running (see error)'
        return
    }

    $statusLabel.Text = 'Running: localhost:8787 (server), localhost:5173 (app) - preparing extension...'
    $extensionReady = Ensure-ExtensionBuilt -statusLabel $statusLabel

    $statusLabel.Text = 'Running: localhost:8787 (server), localhost:5173 (app)'
    $openButton.Enabled = $true
    $currentConfig = Load-Config
    Open-Browser $currentConfig.browserPath $currentConfig.browserName $simulatorUrl

    if ($isFirstRun -and $extensionReady) {
        $extensionsUrl = if ($currentConfig.browserName -like '*Firefox*') { 'about:debugging#/runtime/this-firefox' } else { 'chrome://extensions' }
        Show-InfoBox "MarketPane installed its dependencies and built the browser extension for you - almost everything is ready.`n`nTwo things still need one manual step each (browser security requires it - no script can do this part):`n`n1. Load the extension: on the page that's about to open, turn on Developer mode, click 'Load unpacked', and select:`n$extensionDir\dist`n`n2. (Optional) For the AI-powered explain/translate features, add a real Gemini API key to server\.env - the placeholder key lets everything else run fine without it."
        Open-Browser $currentConfig.browserPath $currentConfig.browserName $extensionsUrl -NoAppMode
    }
})

[void]$mainForm.ShowDialog()
