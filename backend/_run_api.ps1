$ErrorActionPreference = 'Continue'
Set-Location 'e:\BOYA platform\backend'
if (Test-Path 'api-run.log') { Remove-Item 'api-run.log' -Force }
$proc = Start-Process -FilePath 'node' -ArgumentList 'dist/main.js' -WorkingDirectory 'e:\BOYA platform\backend' -RedirectStandardOutput 'api-run.log' -RedirectStandardError 'api-run.err.log' -PassThru -WindowStyle Hidden
Write-Output ("started pid " + $proc.Id)
Start-Sleep -Seconds 20
Write-Output '--- stdout ---'
if (Test-Path 'api-run.log') { Get-Content 'api-run.log' -Tail 40 }
Write-Output '--- stderr ---'
if (Test-Path 'api-run.err.log') { Get-Content 'api-run.err.log' -Tail 40 }
Write-Output '--- port 3000 ---'
(Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Quiet)