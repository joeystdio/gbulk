# PowerShell script to build Windows installer using Inno Setup
# Requires: Inno Setup 6 (https://jrsoftware.org/isinfo.php)

Write-Host "Building gbulk Windows Installer (Inno Setup)..." -ForegroundColor Green

# Check if Inno Setup is installed
$isccPaths = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
)

$iscc = $null
foreach ($path in $isccPaths) {
    if (Test-Path $path) {
        $iscc = $path
        break
    }
}

if (-not $iscc) {
    Write-Host "ERROR: Inno Setup not found!" -ForegroundColor Red
    Write-Host "Please install Inno Setup 6 from: https://jrsoftware.org/isinfo.php" -ForegroundColor Yellow
    Write-Host "Or install via chocolatey: choco install innosetup" -ForegroundColor Yellow
    exit 1
}

# Check if LICENSE file exists, create a simple one if not
if (-not (Test-Path "LICENSE")) {
    Write-Host "Creating LICENSE file..." -ForegroundColor Yellow
    @"
MIT License

Copyright (c) 2024 gbulk

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"@ | Out-File -FilePath "LICENSE" -Encoding UTF8
}

# Build release binary
Write-Host "`nBuilding release binary..." -ForegroundColor Cyan
cargo build --release --target x86_64-pc-windows-msvc
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cargo build failed!" -ForegroundColor Red
    exit 1
}

# Copy binary to expected location for Inno Setup
Write-Host "`nCopying binary to target\release..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path target\release | Out-Null
Copy-Item target\x86_64-pc-windows-msvc\release\gbulk.exe target\release\gbulk.exe

# Compile installer
Write-Host "`nCompiling Inno Setup installer..." -ForegroundColor Cyan
& $iscc gbulk.iss
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Inno Setup compilation failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n✓ Windows installer created successfully!" -ForegroundColor Green
Write-Host "`nInstaller: gbulk-0.1.0-x64-setup.exe" -ForegroundColor Yellow
Write-Host "`nTo install:" -ForegroundColor Cyan
Write-Host "  Simply double-click gbulk-0.1.0-x64-setup.exe" -ForegroundColor White
Write-Host "  The installer will add gbulk to your PATH automatically" -ForegroundColor White
Write-Host "`nTo uninstall:" -ForegroundColor Cyan
Write-Host "  Use Windows 'Add or Remove Programs'" -ForegroundColor White
Write-Host ""
