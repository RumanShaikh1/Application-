param(
    [string]$WindowTitleContains,
    [string]$ButtonName,
    [string]$OwnerProcessName = 'powershell'
)

# Must match MarketPane.ps1's DPI awareness, or click coordinates land in
# the wrong place relative to the target window's real pixels.
Add-Type @"
using System.Runtime.InteropServices;
public class DpiAwareness3 {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetProcessDpiAwarenessContext(int value);
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();
}
"@
if (-not [DpiAwareness3]::SetProcessDpiAwarenessContext(-4)) { [DpiAwareness3]::SetProcessDPIAware() | Out-Null }

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseClick {
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    public static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
    public const uint SWP_NOSIZE = 0x0001;
    public const uint SWP_NOMOVE = 0x0002;
    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
    public const int SW_RESTORE = 9;
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
"@

function Get-OwnerProcessName([IntPtr]$hWnd) {
    [uint32]$procId = 0
    [MouseClick]::GetWindowThreadProcessId($hWnd, [ref]$procId) | Out-Null
    (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
}

# Title-only matching is ambiguous - e.g. a Windows Terminal tab can
# coincidentally share this app's window title - so also require the
# owning process name to match.
$root = [System.Windows.Automation.AutomationElement]::RootElement
$windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)

$target = $null
foreach ($w in $windows) {
    if ($w.Current.Name -like "*$WindowTitleContains*" -and $w.Current.NativeWindowHandle -ne 0) {
        $hwndCandidate = [IntPtr]$w.Current.NativeWindowHandle
        if ((Get-OwnerProcessName $hwndCandidate) -eq $OwnerProcessName) { $target = $w; break }
    }
}
if (-not $target) {
    Write-Output "No '$OwnerProcessName'-owned window found containing '$WindowTitleContains'"
    exit 1
}

$btnCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $ButtonName)
$button = $target.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $btnCondition)
if (-not $button) {
    Write-Output "Button '$ButtonName' not found in window '$($target.Current.Name)'"
    exit 1
}

$hwnd = [IntPtr]$target.Current.NativeWindowHandle
[MouseClick]::ShowWindow($hwnd, [MouseClick]::SW_RESTORE) | Out-Null
# SetForegroundWindow is subject to Windows' focus-stealing prevention and
# can silently no-op when called from an unrelated background process (a
# real, reproduced failure mode on this machine) - SetWindowPos with
# HWND_TOPMOST is not subject to the same restriction and reliably raises
# the window's Z-order so the click below actually lands on it instead of
# whatever else happens to be layered on top at those screen coordinates.
[MouseClick]::SetWindowPos($hwnd, [MouseClick]::HWND_TOPMOST, 0, 0, 0, 0, [MouseClick]::SWP_NOSIZE -bor [MouseClick]::SWP_NOMOVE) | Out-Null
[MouseClick]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 300

$rect = $button.Current.BoundingRectangle
$x = [int]($rect.Left + $rect.Width / 2)
$y = [int]($rect.Top + $rect.Height / 2)

[MouseClick]::SetCursorPos($x, $y) | Out-Null
Start-Sleep -Milliseconds 150
[MouseClick]::mouse_event([MouseClick]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 80
[MouseClick]::mouse_event([MouseClick]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)

Write-Output "Clicked '$ButtonName' at ($x, $y) in '$($target.Current.Name)'"
