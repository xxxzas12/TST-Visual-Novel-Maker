# Real installer test (Windows): drives the actual NSIS installer window through Win32, screenshots each
# page, and checks files, shortcuts (launched through Explorer like a user), registry, uninstall and upgrade.
#   powershell -ExecutionPolicy Bypass -File scripts\test-installer.ps1 [-OldInstaller path\to\older-setup.exe]
# WARNING: uninstalls the TSTVN installed for the current user, and leaves the tested version installed.
param([string]$Installer = '', [string]$OldInstaller = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (-not $Installer) { $Installer = (Get-ChildItem "$root\release\TSTVN-Setup-*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName }
$shots = Join-Path $root '.e2e-tmp\installer'; New-Item -ItemType Directory -Force $shots | Out-Null
$failures = @()
function Check([bool]$ok, [string]$what) { if ($ok) { "  ok   $what" } else { "  FAIL $what"; $script:failures += $what } }
# Win32 helpers to drive and screenshot a real installer window.
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class W32 {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr p, EnumProc cb, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint f);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public static string Text(IntPtr h) { var s = new StringBuilder(512); GetWindowText(h, s, 512); return s.ToString(); }
  public static string Cls(IntPtr h) { var s = new StringBuilder(256); GetClassName(h, s, 256); return s.ToString(); }
  public static List<IntPtr> TopWindows(uint pid) {
    var r = new List<IntPtr>();
    EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); if (p == pid && IsWindowVisible(h)) r.Add(h); return true; }, IntPtr.Zero);
    return r;
  }
  public static List<IntPtr> Children(IntPtr parent) {
    var r = new List<IntPtr>();
    EnumChildWindows(parent, (h, l) => { r.Add(h); return true; }, IntPtr.Zero);
    return r;
  }
}
"@

$BM_CLICK = 0x00F5; $BM_GETCHECK = 0x00F0

function Get-MainWindow([int]$procId) {
  for ($i = 0; $i -lt 100; $i++) {
    $w = [W32]::TopWindows([uint32]$procId) | Where-Object { [W32]::Text($_) -ne '' } | Select-Object -First 1
    if ($w) { return $w }
    Start-Sleep -Milliseconds 200
  }
  throw "installer window not found"
}

function Get-Controls([IntPtr]$win) {
  [W32]::Children($win) | Where-Object { [W32]::IsWindowVisible($_) } | ForEach-Object {
    [pscustomobject]@{ H = $_; Class = [W32]::Cls($_); Text = [W32]::Text($_); Enabled = [W32]::IsWindowEnabled($_) }
  }
}

function Find-Control([IntPtr]$win, [string]$text, [int]$timeoutMs = 20000) {
  $deadline = (Get-Date).AddMilliseconds($timeoutMs)
  while ((Get-Date) -lt $deadline) {
    $c = Get-Controls $win | Where-Object { $_.Text -eq $text } | Select-Object -First 1
    if ($c) { return $c }
    Start-Sleep -Milliseconds 200
  }
  throw "control '$text' not found; visible: $((Get-Controls $win | ForEach-Object { "[$($_.Class)] $($_.Text)" }) -join ' | ')"
}

function Click-Control($c) { [void][W32]::SendMessage($c.H, $BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero) }
function Is-Checked($c) { return ([W32]::SendMessage($c.H, $BM_GETCHECK, [IntPtr]::Zero, [IntPtr]::Zero).ToInt32() -eq 1) }

function Save-WindowShot([IntPtr]$win, [string]$path) {
  $r = New-Object W32+RECT
  [void][W32]::GetWindowRect($win, [ref]$r)
  $bmp = New-Object System.Drawing.Bitmap ($r.Right - $r.Left), ($r.Bottom - $r.Top)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $hdc = $g.GetHdc()
  [void][W32]::PrintWindow($win, $hdc, 2)
  $g.ReleaseHdc($hdc); $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}

# Helpers: installation state and uninstall.
function Get-TstvnState {
  $desk = [Environment]::GetFolderPath('Desktop'); $sm = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
  $k = Get-ChildItem "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall" | Where-Object { (Get-ItemProperty $_.PSPath).DisplayName -like '*TSTVN*' } | Select-Object -First 1
  $ver = if ($k) { (Get-ItemProperty $k.PSPath).DisplayVersion } else { '-' }
  $exe = "$env:LOCALAPPDATA\Programs\TSTVN\TSTVN.exe"
  "exe=$(Test-Path $exe) dir=$(Test-Path "$env:LOCALAPPDATA\Programs\TSTVN") desktop=$(Test-Path "$desk\TSTVN.lnk") startmenu=$(Test-Path "$sm\TSTVN.lnk") registry=$([bool]$k) version=$ver"
}
function Uninstall-Tstvn {
  $k = Get-ChildItem "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall" | Where-Object { (Get-ItemProperty $_.PSPath).DisplayName -like '*TSTVN*' } | Select-Object -First 1
  if (-not $k) { return 'not installed' }
  $q = (Get-ItemProperty $k.PSPath).QuietUninstallString
  $exe = ($q -split '"')[1]
  $p = Start-Process -FilePath $exe -ArgumentList '/currentuser', '/S' -Wait -PassThru
  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline -and (Test-Path "$env:LOCALAPPDATA\Programs\TSTVN\TSTVN.exe")) { Start-Sleep 1 }
  "uninstaller exit $($p.ExitCode)"
}

function Install-Interactive([bool]$desktop, [bool]$startMenu, [string]$shot) {
  $p = Start-Process -FilePath $Installer -PassThru
  $win = Get-MainWindow $p.Id
  $d = Find-Control $win 'Create Desktop shortcut'; $s = Find-Control $win 'Create Start Menu icon'
  Check ((Is-Checked $d) -and (Is-Checked $s)) 'both options ticked by default'
  Check (-not (Get-Controls $win | Where-Object Text -eq '< &Back')) 'no Back button on the first page'
  if (-not $desktop) { Click-Control $d }
  if (-not $startMenu) { Click-Control $s }
  Start-Sleep -Milliseconds 300; Save-WindowShot $win "$shots\$shot-1-options.png"
  Click-Control (Find-Control $win 'Install')
  $close = Find-Control $win 'Close' 180000
  Check ([bool](Get-Controls $win | Where-Object Text -eq 'Launch TSTVN')) 'success page with Launch TSTVN'
  Save-WindowShot $win "$shots\$shot-2-done.png"
  Click-Control $close; $p.WaitForExit(20000) | Out-Null; Start-Sleep 3
  Check ($p.HasExited) 'installer closes with Close'
  Check (-not (Get-Process TSTVN -ErrorAction SilentlyContinue)) 'Close does not start TSTVN'
}

function Test-ShortcutLaunch([string]$lnk) {
  Start-Process explorer.exe -ArgumentList "`"$lnk`""; $ok = $false
  for ($i = 0; $i -lt 40 -and -not $ok; $i++) { Start-Sleep -Milliseconds 500; $ok = [bool](Get-Process TSTVN -ErrorAction SilentlyContinue | Where-Object MainWindowTitle -eq 'TSTVN') }
  Get-Process TSTVN -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 2
  return $ok
}

$desk = [Environment]::GetFolderPath('Desktop'); $sm = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
"Installer: $Installer"
"1. Clean uninstall"; Uninstall-Tstvn | Out-Null
Check ((Get-TstvnState) -eq 'exe=False dir=False desktop=False startmenu=False registry=False version=-') 'nothing left after uninstall'
"2. Install without Desktop shortcut"; Install-Interactive $false $true 'a'
Check ((Get-TstvnState) -match 'exe=True dir=True desktop=False startmenu=True registry=True') 'only the Start Menu icon was created'
Check (Test-ShortcutLaunch "$sm\TSTVN.lnk") 'Start Menu icon launches TSTVN'
"3. Reinstall with both shortcuts"; Uninstall-Tstvn | Out-Null; Install-Interactive $true $true 'b'
Check ((Get-TstvnState) -match 'desktop=True startmenu=True registry=True') 'both shortcuts created'
Check (Test-ShortcutLaunch "$desk\TSTVN.lnk") 'Desktop shortcut launches TSTVN'
Check ((New-Object -ComObject WScript.Shell).CreateShortcut("$desk\TSTVN.lnk").TargetPath -eq "$env:LOCALAPPDATA\Programs\TSTVN\TSTVN.exe") 'installed to %LOCALAPPDATA%\Programs\TSTVN'
if ($OldInstaller) {
  "4. Upgrade from $OldInstaller"; Uninstall-Tstvn | Out-Null
  Start-Process $OldInstaller -ArgumentList '/S' -Wait | Out-Null; Start-Sleep 3
  Start-Process $Installer -ArgumentList '/S' -Wait | Out-Null; Start-Sleep 5
  $v = (Get-Item "$env:LOCALAPPDATA\Programs\TSTVN\TSTVN.exe").VersionInfo.ProductVersion
  Check ((Get-TstvnState) -match 'desktop=True startmenu=True registry=True') "silent upgrade keeps shortcuts (now $v)"
}
"Result: $(if ($failures.Count) { "$($failures.Count) failure(s)" } else { 'all checks passed' }); screenshots in $shots"
if ($failures.Count) { exit 1 }
