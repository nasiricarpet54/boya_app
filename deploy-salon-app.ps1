# Deploys the salon_app Flutter web build to production.
#
# Flow: flutter build web -> zip build/web -> scp to the server -> unzip into
# the docker build context -> rebuild + restart the `salon-web` nginx
# container. Caddy serves the result at https://boya.bcshopir.ir/salon/ , which
# works because the build is produced with --base-href=/salon/ (see Caddyfile:
# handle_path /salon/* strips the prefix before proxying to salon-web:80).
#
# Usage:
#   .\deploy-salon-app.ps1
#   .\deploy-salon-app.ps1 -ApiUrl https://boya.bcshopir.ir/api/v1
#   .\deploy-salon-app.ps1 -Server 87.107.104.234 -Port 9011 -User root
#
# Requires: flutter, ssh and scp on PATH (the Windows OpenSSH client is fine).
# The upload uses OpenSSH scp so it shares ssh's keys/config/known_hosts with
# the remote step -- no separate PuTTY setup (.ppk key, registry host-key cache).
[CmdletBinding()]
param(
    [string]$Server = "87.107.104.234",
    [int]$Port = 9011,
    [string]$User = "root",
    [string]$ApiUrl = "https://boya.bcshopir.ir/api/v1",
    [string]$RemoteDir = "/opt/boya",
    [string]$AppUrl = "https://boya.bcshopir.ir/salon/"
)

$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot
$appDir = Join-Path $rootDir "mobile\salon_app"

if (-not (Test-Path (Join-Path $appDir "pubspec.yaml"))) {
    throw "salon_app not found under $appDir -- run this script from the repo root."
}
foreach ($cmd in @("flutter", "ssh", "scp")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "'$cmd' not found on PATH. Install it (or add it to PATH) and retry."
    }
}

function Write-Step([string]$Text) {
    Write-Host "`n=== $Text ===" -ForegroundColor Cyan
}

# Remote bash script. Kept in a single-quoted here-string so PowerShell does not
# try to expand anything in it; __*__ tokens are substituted below. Piped to
# `bash -s` over stdin because passing a multi-line script as an ssh argument is
# unreliable under Windows PowerShell 5.1 native-command quoting.
$remoteCmd = @'
set -euo pipefail
cd __REMOTE_DIR__
test -s /tmp/build-web-salon.zip || { echo "ERROR: /tmp/build-web-salon.zip missing on the server"; exit 1; }
command -v unzip >/dev/null 2>&1 || { echo "ERROR: unzip is not installed on the server"; exit 1; }
mkdir -p mobile/salon_app/build
cd mobile/salon_app/build
rm -rf web
unzip -oq /tmp/build-web-salon.zip
rm -f /tmp/build-web-salon.zip
test -f web/index.html || { echo "ERROR: web/index.html missing after unzip"; exit 1; }
cd __REMOTE_DIR__
docker compose -f docker-compose.production.yml --env-file .env build salon-web
docker compose -f docker-compose.production.yml --env-file .env up -d --force-recreate salon-web
sleep 5
docker compose -f docker-compose.production.yml --env-file .env ps salon-web
curl -s -o /dev/null -w "HTTP: %{http_code}\n" __APP_URL__
'@ `
    -replace '__REMOTE_DIR__', $RemoteDir `
    -replace '__APP_URL__', $AppUrl

Push-Location $appDir
try {
    Write-Step "[1/4] Building Flutter web (base-href=/salon/)"
    & flutter build web --release --base-href=/salon/ --dart-define=API_BASE_URL=$ApiUrl
    if ($LASTEXITCODE -ne 0) { throw "flutter build web failed (exit $LASTEXITCODE)" }
    if (-not (Test-Path "build\web\index.html")) {
        throw "build\web\index.html missing after build"
    }

    Write-Step "[2/4] Creating zip"
    Compress-Archive -Path build\web -DestinationPath build-web-salon.zip -Force
    $zipSize = [math]::Round((Get-Item build-web-salon.zip).Length / 1MB, 2)
    Write-Host "Zip size: $zipSize MB"

    Write-Step "[3/4] Uploading to server"
    # accept-new caches the host key on first connect instead of hanging on an
    # interactive prompt (a real risk for a non-interactive deploy run).
    & scp -P $Port -o StrictHostKeyChecking=accept-new build-web-salon.zip "${User}@${Server}:/tmp/"
    if ($LASTEXITCODE -ne 0) { throw "scp upload failed (exit $LASTEXITCODE)" }

    Write-Step "[4/4] Deploying on server"
    $remoteCmd | & ssh -p $Port -o StrictHostKeyChecking=accept-new "${User}@${Server}" bash -s 2>&1
    if ($LASTEXITCODE -ne 0) { throw "remote deploy failed (exit $LASTEXITCODE)" }
}
finally {
    Pop-Location
}

Write-Host "`n=== Deploy complete ===" -ForegroundColor Green
Write-Host "URL: $AppUrl" -ForegroundColor Green
