param(
    [string]$TitleContains = 'MarketPane',
    [string]$OutPath = "$env:TEMP\marketpane-window-capture.png",
    [string]$OwnerProcessName = 'powershell'
)

# Must match MarketPane.ps1's DPI awareness, or GetWindowRect returns
# coordinates in a different virtualization context than the target
# window's real pixels (undersized/mispositioned captures).
Add-Type @"
using System.Runtime.InteropServices;
public class DpiAwareness2 {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetProcessDpiAwarenessContext(int value);
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();
}
"@
if (-not [DpiAwareness2]::SetProcessDpiAwarenessContext(-4)) { [DpiAwareness2]::SetProcessDPIAware() | Out-Null }

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public class Win32b {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    // Title-only matching is ambiguous - e.g. a Windows Terminal tab can
    // coincidentally share the exact same title text as this app's window.
    // Cross-checking the owning process name (found via Win32, not
    // title-substring guessing) disambiguates reliably.
    public static List<KeyValuePair<IntPtr,string>> FindVisibleWindows(string contains) {
        var results = new List<KeyValuePair<IntPtr,string>>();
        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            var sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            var title = sb.ToString();
            if (!string.IsNullOrEmpty(title) && title.IndexOf(contains, StringComparison.OrdinalIgnoreCase) >= 0) {
                results.Add(new KeyValuePair<IntPtr,string>(hWnd, title));
            }
            return true;
        }, IntPtr.Zero);
        return results;
    }
}
"@

function Get-OwnerProcessName([IntPtr]$hWnd) {
    [uint32]$procId = 0
    [Win32b]::GetWindowThreadProcessId($hWnd, [ref]$procId) | Out-Null
    (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
}

$found = $null
for ($i = 0; $i -lt 20; $i++) {
    $titleMatches = [Win32b]::FindVisibleWindows($TitleContains)
    $owned = $titleMatches | Where-Object { (Get-OwnerProcessName $_.Key) -eq $OwnerProcessName }
    if ($owned) { $found = $owned | Select-Object -First 1; break }
    Start-Sleep -Milliseconds 500
}

if ($null -eq $found) {
    Write-Output "No visible '$OwnerProcessName'-owned window found with title containing '$TitleContains'"
    Write-Output "All visible windows matching the title (any owner):"
    [Win32b]::FindVisibleWindows($TitleContains) | ForEach-Object { Write-Output "  [$($_.Key)] $($_.Value) owner=$(Get-OwnerProcessName $_.Key)" }
    exit 1
}

Write-Output "Found window: $($found.Value)"
$rect = New-Object Win32b+RECT
[Win32b]::GetWindowRect($found.Key, [ref]$rect) | Out-Null
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top

$bmp = New-Object System.Drawing.Bitmap $width, $height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
[Win32b]::PrintWindow($found.Key, $hdc, 2) | Out-Null # PW_RENDERFULLCONTENT
$g.ReleaseHdc($hdc)
$bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()

Write-Output "Captured to $OutPath"
