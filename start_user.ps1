$ErrorActionPreference = 'Stop'
$portalRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js was not found. Install Node.js and try again.'
  exit 1
}
& node.exe (Join-Path $portalRoot 'start_user.mjs')
exit $LASTEXITCODE
