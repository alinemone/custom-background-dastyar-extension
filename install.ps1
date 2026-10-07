<#
.SYNOPSIS
    Installs the custom background into every installed Dastyar version and keeps it
    installed after Dastyar updates (via a per-user scheduled task).

.PARAMETER Silent
    No console output or prompts. Used by the scheduled task; output goes to a log file.

.PARAMETER NoTask
    Patch the current Dastyar versions only; do not register the auto-repatch task.

.PARAMETER Uninstall
    Remove the custom background from all Dastyar versions and remove the task.
#>
param(
    [switch]$Silent,
    [switch]$NoTask,
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

$ExtensionId = 'ebilacdhmebcihmbjgibcbeaihbecapj'
$FolderName  = 'custom-background'
$Files       = @('custom-bg.css', 'custom-bg.js')
$MarkerStart = '<!-- custom-background:start -->'
$MarkerEnd   = '<!-- custom-background:end -->'
$TaskName    = 'DastyarCustomBackground'
$BingOrigin  = 'https://www.bing.com/*'
$InstallHome = Join-Path $env:LOCALAPPDATA 'DastyarCustomBackground'
$LogFile     = Join-Path $InstallHome 'last-run.log'
$Utf8NoBom   = New-Object System.Text.UTF8Encoding $false

function Write-Log([string]$Message, [string]$Color = 'Gray') {
    if ($Silent) {
        if (Test-Path $InstallHome) {
            Add-Content -Path $LogFile -Value ("{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $Message)
        }
    } else {
        Write-Host $Message -ForegroundColor $Color
    }
}

function Get-DastyarVersionDirs {
    $browserRoots = @(
        "$env:LOCALAPPDATA\Google\Chrome\User Data",
        "$env:LOCALAPPDATA\Google\Chrome Beta\User Data",
        "$env:LOCALAPPDATA\Microsoft\Edge\User Data",
        "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data"
    ) | Where-Object { Test-Path $_ }

    foreach ($root in $browserRoots) {
        # every profile: Default, Profile 1, ...
        foreach ($profileDir in Get-ChildItem $root -Directory -ErrorAction SilentlyContinue) {
            $extensionDir = Join-Path $profileDir.FullName "Extensions\$ExtensionId"
            if (-not (Test-Path $extensionDir)) { continue }
            Get-ChildItem $extensionDir -Directory |
                Where-Object { Test-Path (Join-Path $_.FullName 'manifest.json') }
        }
    }
}

function Read-Text([string]$Path) {
    # ReadAllText strips a UTF-8 BOM if present
    [IO.File]::ReadAllText($Path)
}

function Write-Text([string]$Path, [string]$Text) {
    [IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function Get-NewTabHtml([string]$VersionDir) {
    $manifest = Read-Text (Join-Path $VersionDir 'manifest.json') | ConvertFrom-Json
    $relative = $manifest.chrome_url_overrides.newtab
    if (-not $relative) { return $null }
    $path = Join-Path $VersionDir (($relative -replace '^\./', '') -replace '/', '\')
    if (Test-Path $path) { return $path }
    return $null
}

function Remove-Injection([string]$Html) {
    $Html = [regex]::Replace($Html, '\s*' + [regex]::Escape($MarkerStart) + '.*?' + [regex]::Escape($MarkerEnd), '', 'Singleline')
    # lines added by the first version of this installer
    $Html = [regex]::Replace($Html, '[ \t]*<!-- Custom Background -->\r?\n', '')
    $Html = [regex]::Replace($Html, '[ \t]*<(link|script)[^>]*/custom-background/[^>]*>(</script>)?\r?\n?', '')
    return $Html
}

function Add-Injection([string]$Html) {
    $block = "$MarkerStart`n" +
             "    <link rel=`"stylesheet`" href=`"/$FolderName/custom-bg.css`">`n" +
             "    <script src=`"/$FolderName/custom-bg.js`"></script>`n" +
             "    $MarkerEnd`n  "
    $headClose = [regex]'(?i)</head>'
    if (-not $headClose.IsMatch($Html)) { throw 'no </head> tag in new tab page' }
    return $headClose.Replace($Html, $block.Replace('$', '$$') + '</head>', 1)
}

# The first version of this installer added "custom-background/*" to web_accessible_resources.
# The new tab page is the extension's own page, so that was never needed; undo it.
function Restore-LegacyManifest([string]$VersionDir) {
    $manifestPath = Join-Path $VersionDir 'manifest.json'
    $backupPath = "$manifestPath.backup"
    if ((Test-Path $backupPath) -and ((Read-Text $manifestPath) -match 'custom-background')) {
        Copy-Item $backupPath $manifestPath -Force
        Remove-Item $backupPath -Force
        Write-Log "      manifest.json restored to original" 'DarkGray'
    }
}

# Bing's HPImageArchive has no CORS headers. An *optional* host permission lets the page
# ask for bing.com access once; unlike a required permission it does not make Chrome
# disable the extension. Chrome reads the change on the next browser/extension restart.
function Set-BingPermission([string]$VersionDir, [bool]$Enabled) {
    $manifestPath = Join-Path $VersionDir 'manifest.json'
    $text = Read-Text $manifestPath
    $manifest = $text | ConvertFrom-Json
    $current = @($manifest.optional_host_permissions)
    $quoted = '"' + $BingOrigin + '"'

    if ($Enabled) {
        if ($current -contains $BingOrigin) { return $false }
        if ($manifest.PSObject.Properties.Name -contains 'optional_host_permissions') {
            $separator = if ($current.Count -gt 0) { ', ' } else { ' ' }
            $new = ([regex]'"optional_host_permissions"\s*:\s*\[\s*').Replace($text, '"optional_host_permissions": [ ' + $quoted + $separator, 1)
        } else {
            $new = ([regex]'^\s*\{').Replace($text, "{`n   `"optional_host_permissions`": [ $quoted ],", 1)
        }
    } else {
        if ($current -notcontains $BingOrigin) { return $false }
        $new = $text.Replace("`n   `"optional_host_permissions`": [ $quoted ],", '')
        $new = $new.Replace($quoted + ', ', '')
    }

    $null = $new | ConvertFrom-Json   # never write a broken manifest
    Write-Text $manifestPath $new
    return $true
}

function Test-SameFile([string]$A, [string]$B) {
    # plain .NET byte compare: Get-FileHash is missing on some PowerShell setups
    if (-not (Test-Path $B)) { return $false }
    $bytesA = [IO.File]::ReadAllBytes($A)
    $bytesB = [IO.File]::ReadAllBytes($B)
    return [Convert]::ToBase64String($bytesA) -eq [Convert]::ToBase64String($bytesB)
}

function Install-Into([string]$VersionDir) {
    $html = Get-NewTabHtml $VersionDir
    if (-not $html) { throw 'new tab page not found in manifest' }

    $changed = $false

    $target = Join-Path $VersionDir $FolderName
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    foreach ($file in $Files) {
        $source = Join-Path $PSScriptRoot $file
        $destination = Join-Path $target $file
        if (-not (Test-SameFile $source $destination)) {
            Copy-Item $source $destination -Force
            $changed = $true
        }
    }

    $original = Read-Text $html
    $clean = Remove-Injection $original
    $patched = Add-Injection $clean
    if ($patched -ne $original) {
        if (-not (Test-Path "$html.backup")) { Write-Text "$html.backup" $clean }
        Write-Text $html $patched
        $changed = $true
    }

    Restore-LegacyManifest $VersionDir
    if (Set-BingPermission $VersionDir $true) {
        $script:manifestChanged = $true
        $changed = $true
    }
    return $changed
}

function Uninstall-From([string]$VersionDir) {
    $html = Get-NewTabHtml $VersionDir
    if ($html) {
        $original = Read-Text $html
        $clean = Remove-Injection $original
        if ($clean -ne $original) { Write-Text $html $clean }
        if (Test-Path "$html.backup") { Remove-Item "$html.backup" -Force }
    }
    $target = Join-Path $VersionDir $FolderName
    if (Test-Path $target) { Remove-Item $target -Recurse -Force }
    Restore-LegacyManifest $VersionDir
    [void](Set-BingPermission $VersionDir $false)
}

# The task runs a private copy, so deleting/moving this folder does not break it.
# Keep that copy in sync, otherwise the task would put the old files back.
function Update-PrivateCopy {
    if ($PSScriptRoot -eq $InstallHome) { return }
    New-Item -ItemType Directory -Path $InstallHome -Force | Out-Null
    foreach ($file in $Files + 'install.ps1') {
        Copy-Item (Join-Path $PSScriptRoot $file) $InstallHome -Force
    }
}

function Register-RepatchTask {
    Update-PrivateCopy

    $script = Join-Path $InstallHome 'install.ps1'
    $psArgs = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`" -Silent"
    if ([Environment]::OSVersion.Version.Build -ge 22000) {
        # conhost --headless keeps the console window from flashing every run (Windows 11)
        $action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless powershell.exe $psArgs"
    } else {
        $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $psArgs
    }

    $every30Min = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 30)
    $atLogon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
    $description = 'Re-applies the custom background after the Dastyar extension updates.'

    try {
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($atLogon, $every30Min) `
            -Settings $settings -Description $description -Force | Out-Null
    } catch {
        # a logon trigger can need admin rights; the 30-minute trigger alone is enough
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $every30Min `
            -Settings $settings -Description $description -Force | Out-Null
    }
}

function Unregister-RepatchTask {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }
    if (Test-Path $InstallHome) { Remove-Item $InstallHome -Recurse -Force }
}

# ------------------------------------------------------------------ main

if ($Silent -and (Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 100KB) {
    Remove-Item $LogFile -Force
}

$versionDirs = @(Get-DastyarVersionDirs)
$failed = 0
$manifestChanged = $false

if ($Uninstall) {
    Write-Log 'Removing custom background...' 'Cyan'
    foreach ($dir in $versionDirs) {
        try {
            Uninstall-From $dir.FullName
            Write-Log "[OK]   $($dir.FullName)" 'Green'
        } catch {
            $failed++
            Write-Log "[FAIL] $($dir.FullName): $($_.Exception.Message)" 'Red'
        }
    }
    Unregister-RepatchTask
    Write-Log 'Done. Open a new tab to see the original Dastyar background.' 'Green'
} else {
    if ($versionDirs.Count -eq 0) {
        Write-Log '[ERROR] Dastyar extension not found in Chrome / Edge / Brave.' 'Red'
    }
    foreach ($dir in $versionDirs) {
        try {
            if (Install-Into $dir.FullName) {
                Write-Log "[OK]   patched     $($dir.FullName)" 'Green'
            } else {
                Write-Log "[OK]   up to date  $($dir.FullName)" 'DarkGray'
            }
        } catch {
            $failed++
            Write-Log "[FAIL] $($dir.FullName): $($_.Exception.Message)" 'Red'
        }
    }

    if (-not $Silent -and $NoTask -and (Test-Path $InstallHome)) {
        Update-PrivateCopy
    }
    if (-not $Silent -and -not $NoTask) {
        try {
            Register-RepatchTask
            Write-Log "`n[OK] Auto-repatch task '$TaskName' registered (runs at logon and every 30 minutes)." 'Green'
        } catch {
            Write-Log "`n[WARN] Could not register the scheduled task: $($_.Exception.Message)" 'Yellow'
            Write-Log '       Re-run this script after each Dastyar update.' 'Yellow'
        }
    }

    if ($versionDirs.Count -gt 0 -and $failed -eq 0) {
        Write-Log "`nDone. Open a new tab; hover the bottom-left corner (or press Alt+B) to change the background." 'Green'
        if ($manifestChanged) {
            Write-Log 'manifest.json changed: restart the browser (or Reload Dastyar in chrome://extensions) once,' 'Yellow'
            Write-Log 'then press "allow" in the Bing tab of the panel to get the exact image for each day.' 'Yellow'
        }
    }
}

if (-not $Silent) {
    Write-Host "`nPress Enter to exit..." -ForegroundColor DarkGray
    [void](Read-Host)
}

if ($failed -gt 0) { exit 1 }
