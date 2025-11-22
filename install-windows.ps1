# Simple Windows installer for gbulk
# This script copies the binary to a standard location and adds it to PATH
# No administrator rights required - installs to user directory

Write-Host "Installing gbulk..." -ForegroundColor Green

# Create installation directory
$installDir = "$env:LOCALAPPDATA\gbulk"
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

# Build release binary if not exists
if (-not (Test-Path "target\release\gbulk.exe")) {
    Write-Host "Building release binary..." -ForegroundColor Cyan
    cargo build --release
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Build failed!" -ForegroundColor Red
        exit 1
    }
}

# Copy binary
Write-Host "Copying gbulk.exe to $installDir..." -ForegroundColor Cyan
Copy-Item "target\release\gbulk.exe" -Destination $installDir -Force

# Add to user PATH if not already there
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installDir*") {
    Write-Host "Adding to PATH..." -ForegroundColor Cyan
    $newPath = "$userPath;$installDir"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "PATH updated. Please restart your terminal for changes to take effect." -ForegroundColor Yellow
} else {
    Write-Host "Already in PATH." -ForegroundColor Gray
}

Write-Host "`n✓ Installation complete!" -ForegroundColor Green
Write-Host "`nInstalled to: $installDir" -ForegroundColor Cyan
Write-Host "`nUsage:" -ForegroundColor Cyan
Write-Host "  gbulk list" -ForegroundColor White
Write-Host "  gbulk pull-all" -ForegroundColor White
Write-Host "  gbulk --help" -ForegroundColor White
Write-Host "`nNote: If 'gbulk' command not found, restart your terminal." -ForegroundColor Yellow
Write-Host ""
