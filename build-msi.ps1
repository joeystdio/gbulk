# PowerShell script to build Windows MSI installer
# Requires: WiX Toolset (https://wixtoolset.org/)

Write-Host "Building gbulk Windows Installer..." -ForegroundColor Green

# Check if WiX is installed
$wixPath = "${env:WIX}bin"
if (-not (Test-Path $wixPath)) {
    Write-Host "ERROR: WiX Toolset not found!" -ForegroundColor Red
    Write-Host "Please install WiX Toolset from: https://wixtoolset.org/releases/" -ForegroundColor Yellow
    Write-Host "Or install via chocolatey: choco install wixtoolset" -ForegroundColor Yellow
    exit 1
}

# Build release binary
Write-Host "`nBuilding release binary..." -ForegroundColor Cyan
cargo build --release --target x86_64-pc-windows-msvc
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cargo build failed!" -ForegroundColor Red
    exit 1
}

# Compile WiX source
Write-Host "`nCompiling WiX source..." -ForegroundColor Cyan
& "$wixPath\candle.exe" -arch x64 -o target\wix\ gbulk.wxs
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: WiX candle compilation failed!" -ForegroundColor Red
    exit 1
}

# Link to create MSI
Write-Host "`nLinking MSI..." -ForegroundColor Cyan
& "$wixPath\light.exe" -ext WixUIExtension -o gbulk-0.1.0-x64.msi target\wix\gbulk.wixobj
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: WiX light linking failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n✓ Windows installer created successfully!" -ForegroundColor Green
Write-Host "`nInstaller: gbulk-0.1.0-x64.msi" -ForegroundColor Yellow
Write-Host "`nTo install:" -ForegroundColor Cyan
Write-Host "  msiexec /i gbulk-0.1.0-x64.msi" -ForegroundColor White
Write-Host "`nOr simply double-click the .msi file" -ForegroundColor White
Write-Host "`nTo uninstall:" -ForegroundColor Cyan
Write-Host "  msiexec /x gbulk-0.1.0-x64.msi" -ForegroundColor White
Write-Host "  Or use Windows 'Add or Remove Programs'" -ForegroundColor White
Write-Host ""
