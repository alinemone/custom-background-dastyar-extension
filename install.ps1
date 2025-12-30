# Install Custom Background for Dastyar Extension
# Script: Auto-install script

Write-Host "Searching for Dastyar extension..." -ForegroundColor Cyan

# Find Dastyar extension path
$chromeExtensionsPath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Extensions"
$dastyarId = "ebilacdhmebcihmbjgibcbeaihbecapj"

if (-not (Test-Path $chromeExtensionsPath)) {
    Write-Host "[ERROR] Chrome extensions path not found!" -ForegroundColor Red
    Write-Host "Please make sure Chrome is installed and Dastyar extension is installed." -ForegroundColor Yellow
    pause
    exit
}

# Find extension version
$versions = Get-ChildItem "$chromeExtensionsPath\$dastyarId" -Directory -ErrorAction SilentlyContinue
if ($versions.Count -eq 0) {
    Write-Host "[ERROR] Dastyar extension not found!" -ForegroundColor Red
    Write-Host "Please install Dastyar extension from Chrome Web Store." -ForegroundColor Yellow
    pause
    exit
}

$targetVersion = $versions | Sort-Object Name -Descending | Select-Object -First 1
$targetPath = $targetVersion.FullName

Write-Host "[OK] Version found: $($targetVersion.Name)" -ForegroundColor Green
Write-Host "[PATH] $targetPath" -ForegroundColor Gray

# Custom background folder path
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$customBgPath = Join-Path $targetPath "custom-background"

# === Step 1: Copy files ===
Write-Host "`n[1/4] Copying files..." -ForegroundColor Cyan

if (Test-Path $customBgPath) {
    Write-Host "[WARN] custom-background folder already exists. Replacing..." -ForegroundColor Yellow
    Remove-Item $customBgPath -Recurse -Force
}

New-Item -ItemType Directory -Path $customBgPath -Force | Out-Null
Copy-Item "$scriptPath\custom-bg.css" -Destination $customBgPath -Force
Copy-Item "$scriptPath\custom-bg.js" -Destination $customBgPath -Force

Write-Host "[OK] Files copied successfully" -ForegroundColor Green

# === Step 2: Edit manifest.json ===
Write-Host "`n[2/4] Editing manifest.json..." -ForegroundColor Cyan

$manifestPath = Join-Path $targetPath "manifest.json"

if (-not (Test-Path $manifestPath)) {
    Write-Host "[ERROR] manifest.json not found!" -ForegroundColor Red
    pause
    exit
}

$manifestContent = Get-Content $manifestPath -Raw -Encoding UTF8

# Check if already added
if ($manifestContent -match 'custom-background') {
    Write-Host "[WARN] manifest.json already edited." -ForegroundColor Yellow
} else {
    # Backup original file FIRST
    Copy-Item $manifestPath "$manifestPath.backup" -Force

    # Add custom-background to resources using better regex
    $pattern = '("resources":\s*\[\s*"assets/img/lib/\*")'
    $replacement = '"resources": [ "assets/img/lib/*",' + "`n    " + '"custom-background/*"'

    $manifestContent = $manifestContent -replace $pattern, $replacement

    # Validate JSON before saving
    try {
        $null = $manifestContent | ConvertFrom-Json
        $manifestContent | Set-Content $manifestPath -Encoding UTF8 -NoNewline
        Write-Host "[OK] manifest.json edited successfully" -ForegroundColor Green
        Write-Host "      (backup: manifest.json.backup)" -ForegroundColor Gray
    } catch {
        Write-Host "[ERROR] Failed to edit manifest.json! Restoring backup..." -ForegroundColor Red
        Copy-Item "$manifestPath.backup" $manifestPath -Force
        Write-Host "Please check manifest.json manually" -ForegroundColor Yellow
        pause
        exit
    }
}

# === Step 3: Edit index.html ===
Write-Host "`n[3/4] Editing index.html..." -ForegroundColor Cyan

$indexPath = Join-Path $targetPath "dist\override\index.html"

if (-not (Test-Path $indexPath)) {
    Write-Host "[ERROR] index.html not found in dist\override\" -ForegroundColor Red
    pause
    exit
}

$htmlContent = Get-Content $indexPath -Raw -Encoding UTF8

# Check if already added
if ($htmlContent -match 'custom-background') {
    Write-Host "[WARN] index.html already edited." -ForegroundColor Yellow
} else {
    # Find </head> tag and add before it
    $linesToAdd = @(
        '    <!-- Custom Background -->'
        '    <link rel="stylesheet" href="/custom-background/custom-bg.css">'
        '    <script src="/custom-background/custom-bg.js"></script>'
    ) -join "`n"

    $htmlContent = $htmlContent -replace '</head>', "$linesToAdd`n  </head>"

    # Backup
    Copy-Item $indexPath "$indexPath.backup" -Force
    $htmlContent | Set-Content $indexPath -Encoding UTF8 -NoNewline

    Write-Host "[OK] index.html edited successfully" -ForegroundColor Green
    Write-Host "      (backup: index.html.backup)" -ForegroundColor Gray
}

# === Step 4: Final instructions ===
Write-Host "`n[4/4] Final instructions" -ForegroundColor Cyan
Write-Host "`n" -NoNewline
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "Installation completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "`nNow follow these steps:`n" -ForegroundColor White

Write-Host "1. Open Chrome browser" -ForegroundColor Yellow
Write-Host "2. Type this in address bar:" -ForegroundColor Yellow
Write-Host "   chrome://extensions/" -ForegroundColor Cyan
Write-Host "3. Enable Developer mode (top right)" -ForegroundColor Yellow
Write-Host "4. Find Dastyar extension" -ForegroundColor Yellow
Write-Host "5. Click Reload button" -ForegroundColor Yellow
Write-Host "6. Open a new tab" -ForegroundColor Yellow
Write-Host "`nYou should see the button at bottom left!`n" -ForegroundColor Green

Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "`nPress any key to exit..." -ForegroundColor Gray
pause
