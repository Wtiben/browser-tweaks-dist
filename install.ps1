<#
  Installs the Browser Tweaks bridge: the native process the add-on talks to.

  The add-on itself comes from https://wtiben.github.io/browser-tweaks-dist and updates itself through Firefox. This is the
  other half, which Firefox cannot install: a native messaging host is a separate program on
  disk, named in a registry key, and no extension can write either.

  Run it once. After that the bridge updates itself, because the only thing that changes per
  release is a file it downloads and verifies on its own:

      irm https://wtiben.github.io/browser-tweaks-dist/install.ps1 | iex

  No administrator rights: everything here lives under %LOCALAPPDATA% and HKEY_CURRENT_USER.
#>

$ErrorActionPreference = 'Stop'

$Dist        = 'https://wtiben.github.io/browser-tweaks-dist'
$HostName    = 'browser_tweaks'
$GeckoId     = 'browser-tweaks@innovadis.local'
$ChromiumId  = 'kfijbkchmcgagkfnbbdiakipfgmachcd'
$PublicKey   = 'MCowBQYDK2VwAyEAf4kE9zB9mTutIU8TdgCFiq/3nz2QjuTbn21vM0TM0T8='
$BunVersion  = '1.3.11'
$BunSha      = '066f8694f8b7d8df592452746d18f01710d4053e93030922dbc6e8c34a8c4b9f'
$BunBaseSha  = '9d0e0f923e9626f3bc6044fc32e0d3ab29039aea753f5678ef8801cf26f75288'

$Root     = Join-Path $env:LOCALAPPDATA 'browser-tweaks'
$Bin      = Join-Path $Root 'bin'
$Runtime  = Join-Path $Bin 'runtime'
$Versions = Join-Path $Root 'versions'
$BunExe   = Join-Path $Runtime 'bun.exe'

New-Item -ItemType Directory -Force -Path $Bin, $Runtime, $Versions | Out-Null

function Get-FileSha256($Path) {
  return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLower()
}

# ---------------------------------------------------------------- the runtime

function Install-Bun($Flavour, $Expected) {
  $url = "https://github.com/oven-sh/bun/releases/download/bun-v$BunVersion/$Flavour.zip"
  $zip = Join-Path $env:TEMP "$Flavour-$BunVersion.zip"
  Write-Host "  downloading $Flavour ..."
  Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing

  $actual = Get-FileSha256 $zip
  if ($actual -ne $Expected) {
    Remove-Item $zip -Force
    throw "bun download does not match its pinned hash (got $actual, expected $Expected)."
  }

  $unpacked = Join-Path $env:TEMP "$Flavour-$BunVersion"
  Remove-Item $unpacked -Recurse -Force -ErrorAction SilentlyContinue
  Expand-Archive -Path $zip -DestinationPath $unpacked -Force
  $found = Get-ChildItem -Path $unpacked -Filter 'bun.exe' -Recurse | Select-Object -First 1
  if (-not $found) { throw "no bun.exe inside $Flavour.zip" }

  Copy-Item $found.FullName $BunExe -Force
  Remove-Item $zip, $unpacked -Recurse -Force -ErrorAction SilentlyContinue
}

function Test-Bun {
  try { & $BunExe --version *> $null; return $LASTEXITCODE -eq 0 } catch { return $false }
}

Write-Host 'Browser Tweaks bridge'
Write-Host ''

if ((Test-Path $BunExe) -and (Test-Bun)) {
  Write-Host "  runtime already installed"
} else {
  Install-Bun 'bun-windows-x64' $BunSha
  # The standard build needs AVX2 and dies on a CPU without it, which only shows up here.
  if (-not (Test-Bun)) {
    Write-Host '  that build will not run on this CPU, taking the baseline one'
    Install-Bun 'bun-windows-x64-baseline' $BunBaseSha
    if (-not (Test-Bun)) { throw 'neither bun build runs on this machine.' }
  }
}

# ---------------------------------------------------------------- the bridge

# Written before the bundle it protects, because the bridge reads this file to decide
# whether to accept an update and nothing else ever writes it. Rotating the key means
# running this installer again, everywhere; that is the cost of pinning and the point of it.
Set-Content -Path (Join-Path $Bin 'bridge-signing.pub') -Value $PublicKey -NoNewline -Encoding ascii

$manifest = Invoke-RestMethod -Uri "$Dist/bridge.json" -UseBasicParsing
$release = $manifest.bridges |
  Sort-Object { [version]$_.version } |
  Select-Object -Last 1
if (-not $release) { throw "no bridge published at $Dist/bridge.json" }

Write-Host "  bridge $($release.version)"
$bundle = Join-Path $env:TEMP "bridge-$($release.version).js"
Invoke-WebRequest -Uri $release.url -OutFile $bundle -UseBasicParsing

if ((Get-FileSha256 $bundle) -ne $release.sha256.ToLower()) {
  Remove-Item $bundle -Force
  throw 'the bridge download does not match the hash in the manifest.'
}

# Verified with bun rather than with .NET, which has no Ed25519. bun is already on disk by
# this point and is the same runtime that will check every later update, so the first
# install is held to exactly the standard the automatic ones are.
$verifier = Join-Path $env:TEMP 'verify-bridge.mjs'
Set-Content -Path $verifier -Encoding ascii -Value @'
import { createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
const [bundle, signature, publicKey] = process.argv.slice(2);
const key = createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' });
const ok = verify(null, readFileSync(bundle), key, Buffer.from(signature, 'base64'));
process.exit(ok ? 0 : 1);
'@

& $BunExe $verifier $bundle $release.signature $PublicKey
if ($LASTEXITCODE -ne 0) {
  Remove-Item $bundle, $verifier -Force -ErrorAction SilentlyContinue
  throw 'the bridge download is not signed by the key this installer pins.'
}
Remove-Item $verifier -Force -ErrorAction SilentlyContinue

$target = Join-Path $Versions $release.version
New-Item -ItemType Directory -Force -Path $target | Out-Null
Move-Item $bundle (Join-Path $target 'bridge.js') -Force

# ---------------------------------------------------------------- the launcher

# Two files that never change again, which is the whole design: the registry names this .bat
# for good, so anything that might need updating has to live on the other side of it.
#
# Written as an array rather than a here-string so Set-Content joins the lines with CRLF.
# A batch file with Unix line endings runs the first line together with the second: cmd
# reads it as an echo-off with two arguments, does nothing, and exits without ever starting
# the bridge. Silently, which is the expensive part.
Set-Content -Path (Join-Path $Bin 'bridge-host.bat') -Encoding ascii -Value @(
  '@echo off',
  '"%~dp0runtime\bun.exe" "%~dp0launch.js"'
)

Set-Content -Path (Join-Path $Bin 'launch.js') -Encoding ascii -Value @'
/**
 * Runs the newest bridge that is installed, and nothing else.
 *
 * Imported rather than spawned, so there is one process and stdin and stdout are already
 * the browser's. Deliberately the only file here with no opinions: it does not check for
 * updates, does not read settings and does not know what a bridge does. Rolling back is
 * deleting a directory, which works because this picks whatever is left.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const versions = join(import.meta.dirname, '..', 'versions');

const parts = name => name.split('.').map(part => Number.parseInt(part, 10) || 0);
const newer = (a, b) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
};

const installed = readdirSync(versions, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && /^\d+\.\d+\.\d+$/.test(entry.name))
  .map(entry => entry.name)
  .sort((a, b) => (newer(a, b) ? -1 : 1));

if (!installed.length) {
  console.error('[browser-tweaks] no bridge installed under ' + versions);
  process.exit(1);
}

await import(pathToFileURL(join(versions, installed[0], 'bridge.js')).href);
'@

# ---------------------------------------------------------------- registration

$launcher = Join-Path $Bin 'bridge-host.bat'

$firefoxManifest = Join-Path $Bin "$HostName.firefox.json"
@{
  name = $HostName
  description = 'Bridge between the Browser Tweaks addon and herdr'
  path = $launcher
  type = 'stdio'
  allowed_extensions = @($GeckoId)
} | ConvertTo-Json | Set-Content -Path $firefoxManifest -Encoding utf8

$chromiumManifest = Join-Path $Bin "$HostName.chromium.json"
@{
  name = $HostName
  description = 'Bridge between the Browser Tweaks addon and herdr'
  path = $launcher
  type = 'stdio'
  allowed_origins = @("chrome-extension://$ChromiumId/")
} | ConvertTo-Json | Set-Content -Path $chromiumManifest -Encoding utf8

$registrations = @(
  @{ Key = "HKCU:\Software\Mozilla\NativeMessagingHosts\$HostName";        Manifest = $firefoxManifest },
  @{ Key = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"; Manifest = $chromiumManifest },
  @{ Key = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName"; Manifest = $chromiumManifest }
)

foreach ($registration in $registrations) {
  New-Item -Path $registration.Key -Force | Out-Null
  Set-ItemProperty -Path $registration.Key -Name '(Default)' -Value $registration.Manifest
}

Write-Host ''
Write-Host 'Installed.'
Write-Host "  launcher: $launcher"
Write-Host "  bridge:   $(Join-Path $Versions $release.version)"
Write-Host ''
Write-Host 'Now install the add-on, if you have not already:'
Write-Host "  $Dist/updates.json lists the current build"
Write-Host ''
Write-Host 'Restart the browser if it was already running.'
