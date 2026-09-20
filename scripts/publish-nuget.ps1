# Builds and pushes Umbraco.BlockFieldVisibility to nuget.org.
# Usage:
#   $env:NUGET_API_KEY = "your-nuget-org-api-key"
#   .\scripts\publish-nuget.ps1
# Optional: -Version 1.0.1 to pack without editing the csproj

param(
    [string]$Version = "0.0.1",
    [string]$OutputDir = "$PSScriptRoot\..\artifacts\nuget"
)

$ErrorActionPreference = "Stop"
$project = Join-Path $PSScriptRoot "..\src\Umbraco.BlockFieldVisibility\Umbraco.BlockFieldVisibility.csproj"

if (-not $env:NUGET_API_KEY) {
    Write-Error "Set NUGET_API_KEY to your nuget.org API key (Account -> API keys)."
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$packArgs = @("pack", $project, "-c", "Release", "-o", $OutputDir)
if ($Version) {
    $packArgs += @("-p:Version=$Version")
}

dotnet @packArgs

$nupkg = Get-ChildItem -Path $OutputDir -Filter "Our.Umbraco.BlockFieldVisibility.*.nupkg" |
    Where-Object { $_.Name -notmatch "\.symbols\." } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $nupkg) {
    Write-Error "No .nupkg found in $OutputDir"
}

Write-Host "Pushing $($nupkg.FullName) ..."
dotnet nuget push $nupkg.FullName --api-key $env:NUGET_API_KEY --source https://api.nuget.org/v3/index.json --skip-duplicate

$snupkg = Join-Path $OutputDir ($nupkg.BaseName + ".snupkg")
if (Test-Path $snupkg) {
    dotnet nuget push $snupkg --api-key $env:NUGET_API_KEY --source https://api.nuget.org/v3/index.json --skip-duplicate
}

Write-Host "Done. Package: https://www.nuget.org/packages/Our.Umbraco.BlockFieldVisibility"
