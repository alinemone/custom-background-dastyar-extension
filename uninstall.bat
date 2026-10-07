@echo off
rem Removes the custom background from every Dastyar version and deletes the auto-repatch task.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Uninstall
exit /b %errorlevel%
