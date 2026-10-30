param(
    [Parameter(Mandatory=$true)][string]$Tag,
    [ValidateSet("none","backend","customer","salon","shared","all")]
    [string]$RunTests = "none",
    [string]$Root = "E:\boya\boya"
)
$ErrorActionPreference = "Continue"
if ($PSVersionTable.PSVersion.Major -lt 7) {
    chcp 65001 | Out-Null
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
}
$outDir = Join-Path $Root "_verify\$Tag"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"

function Save-Cmd {
    param([string]$Name, [string]$Command)
    $output = ""; $code = 0
    try {
        $output = Invoke-Expression "$Command 2>&1" | Out-String
        if ($LASTEXITCODE -ne $null) { $code = $LASTEXITCODE }
    } catch { $output = "EXCEPTION: $($_.Exception.Message)"; $code = -1 }
    $file = Join-Path $script:outDir ("$script:stamp-$Name.txt")
    [IO.File]::WriteAllText($file,
        "COMMAND: $Command`nEXIT_CODE: $code`nTIMESTAMP: $(Get-Date -Format o)`n----`n`n$output",
        [System.Text.UTF8Encoding]::new($false))
    Write-Host "[$Name] exit=$code -> $file"
}

$origDir = Get-Location; Set-Location $Root
try {
    Save-Cmd "git-status"       "git status"
    Save-Cmd "git-log"          "git log --oneline -10"
    Save-Cmd "git-head"         "git rev-parse HEAD"
    Save-Cmd "git-diff-stat"    "git diff --stat"
    Save-Cmd "git-diff"         "git diff"
    Save-Cmd "git-staged-stat"  "git diff --cached --stat"
    Save-Cmd "git-untracked"    "git ls-files --others --exclude-standard"
    Save-Cmd "git-stash-list"   "git stash list"
    Save-Cmd "git-reflog"       "git reflog -10"
    if ($RunTests -ne "none") {
        $apps = if ($RunTests -eq "all") { @("backend","shared","customer","salon") } else { @($RunTests) }
        foreach ($app in $apps) {
            switch ($app) {
                "backend"  { Push-Location "$Root\backend";             Save-Cmd "test-backend"  "npm test -- --passWithNoTests --ci"; Pop-Location }
                "shared"   { Push-Location "$Root\mobile\shared";       Save-Cmd "test-shared"   "fvm flutter test --reporter expanded"; Pop-Location }
                "customer" { Push-Location "$Root\mobile\customer_app"; Save-Cmd "test-customer" "fvm flutter test --reporter expanded"; Pop-Location }
                "salon"    { Push-Location "$Root\mobile\salon_app";    Save-Cmd "test-salon"    "fvm flutter test --reporter expanded"; Pop-Location }
            }
        }
    }
} finally { Set-Location $origDir }
Write-Host "`nSnapshot: $outDir`nNow run Cursor, then re-run with <tag>-after."