$formatEnumerationLimit = -1
Set-Location e:\boya\boya\mobile\salon_app
Get-ChildItem -Path lib -Recurse -Filter *.dart |
  Select-String -Pattern "salonHomePath|go\('/dashboard'\)|go\(salonHomePath\)" |
  ForEach-Object { "$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }
