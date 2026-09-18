[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
$requirements = Join-Path $PSScriptRoot "requirements.txt"
$envFile = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path $venvPython)) {
    if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
        Write-Host "Python is not installed on this PC." -ForegroundColor Red
        Write-Host "Install Python from python.org, enable Add Python to PATH, then run this file again."
        exit 1
    }
    Write-Host "Preparing Sugar Orbits for this PC..." -ForegroundColor Cyan
    & py -m venv .venv
}

Write-Host "Checking Sugar Orbits requirements..." -ForegroundColor DarkGray
& $venvPython -m pip install --disable-pip-version-check -r $requirements

if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $PSScriptRoot ".env.example") $envFile
    Write-Host "A new .env file was created." -ForegroundColor Yellow
    Write-Host "Add your Dexcom Share username and password, save it, then run this file again."
    Start-Process notepad.exe $envFile
    exit 1
}

$envText = Get-Content $envFile -Raw
if ($envText -notmatch '(?m)^DEXCOM_SHARE_USERNAME=.+$' -or $envText -notmatch '(?m)^DEXCOM_SHARE_PASSWORD=.+$') {
    Write-Host "Your Dexcom Share username or password is still blank." -ForegroundColor Yellow
    Write-Host "Add both values, keep region set to ous for Germany, save, then run this file again."
    Start-Process notepad.exe $envFile
    exit 1
}

$lanAddress = Get-NetIPConfiguration |
    Where-Object { $_.NetAdapter.Status -eq "Up" -and $_.IPv4DefaultGateway -and $_.IPv4Address } |
    ForEach-Object { $_.IPv4Address.IPAddress } |
    Where-Object { $_ -and $_ -notlike "169.254.*" } |
    Select-Object -First 1

if (-not $lanAddress) {
    $lanAddress = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
        Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork } |
        Select-Object -First 1 |
        ForEach-Object { $_.IPAddressToString }
}

if (-not $lanAddress) {
    Write-Host "I could not find this PC's Wi-Fi address." -ForegroundColor Red
    Write-Host "Make sure the PC is connected to Wi-Fi and try again."
    exit 1
}

$previousHost = $env:HOST
$previousLanPreview = $env:ALLOW_LAN_PREVIEW

try {
    $env:HOST = "0.0.0.0"
    $env:ALLOW_LAN_PREVIEW = "true"

    Write-Host ""
    Write-Host "Sugar Orbits is ready for iPhone" -ForegroundColor Green
    Write-Host "Open this address in Safari:" -ForegroundColor Gray
    Write-Host "http://${lanAddress}:8787" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "The PC and iPhone must be on the same trusted Wi-Fi." -ForegroundColor Gray
    Write-Host "If Windows Firewall asks, allow Python on Private networks only." -ForegroundColor Gray
    Write-Host "Keep this window open. Press Ctrl+C to stop." -ForegroundColor Gray
    Write-Host ""

    & $venvPython app.py
}
finally {
    if ($null -eq $previousHost) {
        Remove-Item Env:HOST -ErrorAction SilentlyContinue
    } else {
        $env:HOST = $previousHost
    }
    if ($null -eq $previousLanPreview) {
        Remove-Item Env:ALLOW_LAN_PREVIEW -ErrorAction SilentlyContinue
    } else {
        $env:ALLOW_LAN_PREVIEW = $previousLanPreview
    }
}
