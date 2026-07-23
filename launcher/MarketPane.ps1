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
$healthUrl = 'http://localhost:8787/health'
$iconPath = Join-Path $PSScriptRoot 'assets\app-icon.ico'
$configDir = Join-Path $env:APPDATA 'MarketPane'
$configPath = Join-Path $configDir 'config.json'

$appIcon = if (Test-Path $iconPath) { New-Object System.Drawing.Icon($iconPath) } else { [System.Drawing.SystemIcons]::Application }

function Show-ErrorBox([string]$message) {
    [System.Windows.Forms.MessageBox]::Show($message, 'MarketPane', 'OK', 'Error') | Out-Null
}

function Get-InstalledBrowsers {
    $candidates = @(
        @{ Name = 'Google Chrome'; Path = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" },
        @{ Name = 'Google Chrome'; Path = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe" },
        @{ Name = 'Google Chrome'; Path = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe" },
        @{ Name = 'Microsoft Edge'; Path = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" },
        @{ Name = 'Microsoft Edge'; Path = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" },
        @{ Name = 'Mozilla Firefox'; Path = "$env:ProgramFiles\Mozilla Firefox\firefox.exe" },
        @{ Name = 'Mozilla Firefox'; Path = "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe" },
        @{ Name = 'Brave'; Path = "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe" }
    )
    $found = @()
    $seenNames = @{}
    foreach ($candidate in $candidates) {
        if ((Test-Path $candidate.Path) -and -not $seenNames.ContainsKey($candidate.Name)) {
            $found += [PSCustomObject]@{ Name = $candidate.Name; Path = $candidate.Path }
            $seenNames[$candidate.Name] = $true
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

    $browseButton.Add_Click({
        $dialog = New-Object System.Windows.Forms.OpenFileDialog
        $dialog.Filter = 'Applications (*.exe)|*.exe'
        if ($dialog.ShowDialog() -eq 'OK') { $customPathBox.Text = $dialog.FileName }
    })

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
function Start-ServerIfNeeded {
    if (Test-ServerHealthy) { return $true }

    if (-not (Test-Path $tsx)) {
        Show-ErrorBox "The server's dependencies aren't installed yet.`n`nOpen a terminal and run:`n  cd server`n  npm install`n`nThen reopen MarketPane."
        return $false
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

function Open-Browser([string]$browserPath) {
    try {
        Start-Process -FilePath $browserPath
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
    Open-Browser $current.browserPath
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
    $healthy = Start-ServerIfNeeded
    if ($healthy) {
        $statusLabel.Text = 'Server: running on localhost:8787'
        $openButton.Enabled = $true
        $currentConfig = Load-Config
        Open-Browser $currentConfig.browserPath
    } else {
        $statusLabel.Text = 'Server: not running (see error)'
    }
})

[void]$mainForm.ShowDialog()
