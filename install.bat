@echo off
rem Installs the custom background. Extra arguments are passed to install.ps1 (-NoTask, -Uninstall).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
exit /b %errorlevel%
