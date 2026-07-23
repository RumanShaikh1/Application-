# One-time setup: creates a MarketPane.lnk on the Desktop that runs
# MarketPane.ps1 - a real standalone app window (browser-link prompt on
# first run, then a small status window with an Open/Change-browser UI).
# Re-run any time (e.g. after moving the repo) to refresh the shortcut's
# target paths.

$launcherScript = Join-Path $PSScriptRoot 'MarketPane.ps1'
$iconPath = Join-Path $PSScriptRoot 'assets\app-icon.ico'
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'MarketPane.lnk'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$shortcut.Arguments = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$launcherScript`""
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.Description = 'MarketPane'
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Save()

Write-Output "Created shortcut: $shortcutPath"
