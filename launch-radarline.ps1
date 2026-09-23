$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = if ($env:RADARLINE_PORT) { $env:RADARLINE_PORT } else { '4335' }
$url = "http://127.0.0.1:$port/#command"

Set-Location -LiteralPath $projectDirectory
$healthy = $false
try {
  $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 1
  $healthy = $response.StatusCode -eq 200
} catch { }

if (-not $healthy) {
  Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory $projectDirectory -WindowStyle Hidden
  for ($attempt = 0; $attempt -lt 25; $attempt++) {
    Start-Sleep -Milliseconds 200
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 1
      if ($response.StatusCode -eq 200) { break }
    } catch { }
  }
}

Start-Process $url
