# Uninstall script for gbulk on Windows

Write-Host "Uninstalling gbulk..." -ForegroundColor Yellow

$installDir = "$env:LOCALAPPDATA\gbulk"

# Remove from PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -like "*$installDir*") {
    Write-Host "Removing from PATH..." -ForegroundColor Cyan
    $newPath = ($userPath -split ';' | Where-Object { $_ -ne $installDir }) -join ';'
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "Removed from PATH." -ForegroundColor Gray
}

# Remove installation directory
if (Test-Path $installDir) {
    Write-Host "Removing installation directory..." -ForegroundColor Cyan
    Remove-Item -Path $installDir -Recurse -Force
    Write-Host "Directory removed." -ForegroundColor Gray
}

Write-Host "`n✓ Uninstallation complete!" -ForegroundColor Green
Write-Host "Please restart your terminal for PATH changes to take effect." -ForegroundColor Yellow
Write-Host ""
