$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Version = '1.08.003'
$InstallerName = 'gnubg-1_08_003-20240428-setup.exe'
$InstallerUrl = "https://ftp.gnu.org/gnu/gnubg/$InstallerName"
$InstallerSha256 = '68cd01d92a99e6ec4bdb5f544c14ecbfcc7d9119afb0d2ac189698b309e62d06'
$ExtractorVersion = '1.9'
$ExtractorName = "innoextract-$ExtractorVersion-windows.zip"
$ExtractorUrl = "https://constexpr.org/innoextract/files/$ExtractorName"
$ExtractorSha256 = '6989342c9b026a00a72a38f23b62a8e6a22cc5de69805cf47d68ac2fec993065'
$SourceUrl = 'https://ftp.gnu.org/gnu/gnubg/gnubg-release-1.08.003-sources.tar.gz'
$LicenseUrl = 'https://www.gnu.org/licenses/gpl-3.0.txt'

$DesktopRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ResourcesRoot = Join-Path $DesktopRoot 'src-tauri/resources'
$InstallRoot = Join-Path $ResourcesRoot 'gnubg'
$Notice = Join-Path $ResourcesRoot 'THIRD-PARTY-NOTICES.txt'

function Get-Sha256([string]$Path) {
  $Algorithm = [Security.Cryptography.SHA256]::Create()
  $Stream = [IO.File]::OpenRead($Path)
  try {
    $Bytes = $Algorithm.ComputeHash($Stream)
    return [BitConverter]::ToString($Bytes).Replace('-', '').ToLowerInvariant()
  } finally {
    $Stream.Dispose()
    $Algorithm.Dispose()
  }
}

if ($env:NARD_GNUBG_CACHE_DIR) {
  $CacheRoot = $env:NARD_GNUBG_CACHE_DIR
} else {
  $CacheRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'nard-build-cache/gnubg'
}
$Installer = Join-Path $CacheRoot $InstallerName
$ExtractorArchive = Join-Path $CacheRoot $ExtractorName
$ExtractorRoot = Join-Path $CacheRoot "innoextract-$ExtractorVersion-windows"
$Extractor = Join-Path $ExtractorRoot 'innoextract.exe'

New-Item -ItemType Directory -Force -Path $CacheRoot | Out-Null

function Get-VerifiedDownload(
  [string]$Path,
  [string]$Url,
  [string]$Sha256,
  [string]$Label
) {
  $NeedsDownload = -not (Test-Path $Path)
  if (-not $NeedsDownload) {
    $CachedHash = Get-Sha256 $Path
    $NeedsDownload = $CachedHash -ne $Sha256
  }

  if ($NeedsDownload) {
    if (Test-Path $Path) {
      Remove-Item -Force $Path
    }
    Write-Host "Downloading $Label"
    Invoke-WebRequest -Uri $Url -OutFile $Path -TimeoutSec 900
  }

  $ActualHash = Get-Sha256 $Path
  if ($ActualHash -ne $Sha256) {
    throw "$Label checksum mismatch: expected $Sha256, got $ActualHash"
  }
}

Get-VerifiedDownload `
  $Installer `
  $InstallerUrl `
  $InstallerSha256 `
  "GNU Backgammon $Version from ftp.gnu.org"
Get-VerifiedDownload `
  $ExtractorArchive `
  $ExtractorUrl `
  $ExtractorSha256 `
  "innoextract $ExtractorVersion from constexpr.org"

if (-not (Test-Path $Extractor)) {
  if (Test-Path $ExtractorRoot) {
    Remove-Item -Recurse -Force $ExtractorRoot
  }
  New-Item -ItemType Directory -Force -Path $ExtractorRoot | Out-Null
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::ExtractToDirectory($ExtractorArchive, $ExtractorRoot)
}
if (-not (Test-Path $Extractor)) {
  throw "innoextract executable not found at $Extractor"
}

if (Test-Path $InstallRoot) {
  Remove-Item -Recurse -Force $InstallRoot
}
New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null

& $Extractor `
  --silent `
  --extract `
  --exclude-temp `
  --output-dir $InstallRoot `
  -- `
  $Installer
if ($LASTEXITCODE -ne 0) {
  throw "innoextract exited with code $LASTEXITCODE"
}

$Binary = Get-ChildItem -Path $InstallRoot -Recurse -File -Filter 'gnubg-cli.exe' |
  Select-Object -First 1
$Weights = Get-ChildItem -Path $InstallRoot -Recurse -File -Filter 'gnubg.wd' |
  Select-Object -First 1
$Bearoff = Get-ChildItem -Path $InstallRoot -Recurse -File -Filter 'gnubg_os*.bd' |
  Select-Object -First 1

if (-not $Binary) {
  throw 'The official installer did not contain gnubg-cli.exe'
}
if (-not $Weights) {
  throw 'The official installer did not contain gnubg.wd'
}
if (-not $Bearoff) {
  throw 'The official installer did not contain a one-sided bearoff database'
}

$BundledLicense = Join-Path $InstallRoot 'COPYING'
if (-not (Test-Path $BundledLicense)) {
  $InstalledLicense = Get-ChildItem -Path $InstallRoot -Recurse -File |
    Where-Object { $_.Name -match '^COPYING(\.txt)?$' } |
    Select-Object -First 1
  if ($InstalledLicense) {
    Copy-Item -Force $InstalledLicense.FullName $BundledLicense
  } else {
    Invoke-WebRequest -Uri $LicenseUrl -OutFile $BundledLicense -TimeoutSec 120
  }
}

Copy-Item -Force $Notice (Join-Path $InstallRoot 'NARD-GNUBG-NOTICE.txt')

function Relative-To-Install([string]$Path) {
  $Root = [IO.Path]::GetFullPath($InstallRoot)
  $FullPath = [IO.Path]::GetFullPath($Path)
  return $FullPath.Substring($Root.Length).TrimStart([char[]]'\/').Replace('\', '/')
}

$Manifest = [ordered]@{
  version = $Version
  binary = Relative-To-Install $Binary.FullName
  dataDirectory = Relative-To-Install $Weights.Directory.FullName
  weights = Relative-To-Install $Weights.FullName
  oneSidedBearoff = Relative-To-Install $Bearoff.FullName
  license = 'COPYING'
  installerUrl = $InstallerUrl
  installerSha256 = $InstallerSha256
  sourceUrl = $SourceUrl
}
$ManifestJson = $Manifest | ConvertTo-Json
$Utf8NoBom = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText(
  (Join-Path $InstallRoot 'bundle-manifest.json'),
  $ManifestJson,
  $Utf8NoBom
)

Write-Host "Staged GNU Backgammon $Version"
Write-Host "  binary: $($Manifest.binary)"
Write-Host "  weights: $($Manifest.weights)"
Write-Host "  one-sided bearoff: $($Manifest.oneSidedBearoff)"
