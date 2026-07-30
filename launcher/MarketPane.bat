@echo off
rem Double-click this file to run MarketPane - no PowerShell command, no
rem shortcut setup, no typing required. %~dp0 resolves to wherever THIS
rem .bat file itself lives (with a trailing backslash), regardless of
rem where the project folder was extracted to, so it always finds its
rem sibling MarketPane.ps1 correctly - the same self-locating trick
rem MarketPane.ps1 already uses via $PSScriptRoot for server/web/extension.
rem `start ""` launches PowerShell as its own detached process so this
rem window closes immediately instead of sitting open (blank) for as long
rem as MarketPane itself stays running - the empty "" is a window title
rem placeholder `start` needs whenever the command that follows is quoted.
start "" powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0MarketPane.ps1"
