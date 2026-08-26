$ErrorActionPreference = 'Stop'

$DesktopRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ResourcesRoot = Join-Path $DesktopRoot 'src-tauri/resources'
$GnubgRoot = Join-Path $ResourcesRoot 'gnubg'
$Manifest = Get-Content (Join-Path $GnubgRoot 'bundle-manifest.json') -Raw |
  ConvertFrom-Json

$Binary = Join-Path $GnubgRoot $Manifest.binary
$Data = Join-Path $GnubgRoot $Manifest.dataDirectory
$Bridge = (Resolve-Path (Join-Path $DesktopRoot '../../packages/ai/bridge.py')).Path

$StartInfo = [Diagnostics.ProcessStartInfo]::new()
$StartInfo.FileName = $Binary
$StartInfo.WorkingDirectory = Split-Path $Binary
$StartInfo.UseShellExecute = $false
$StartInfo.CreateNoWindow = $true
$StartInfo.RedirectStandardInput = $true
$StartInfo.RedirectStandardOutput = $true
$StartInfo.RedirectStandardError = $true
$StartInfo.EnvironmentVariables['PYTHONIOENCODING'] = 'utf-8'
$StartInfo.Arguments = "-q -t -r -P `"$Data`" -D `"$Data`" --python=$Bridge"

$Process = [Diagnostics.Process]::new()
$Process.StartInfo = $StartInfo
[void]$Process.Start()
$OutputTail = [Collections.Generic.Queue[string]]::new()

try {
  function Fail-With-Diagnostics([string]$Message) {
    if (-not $Process.HasExited) {
      $Process.Kill()
      $Process.WaitForExit()
    }
    $Stderr = $Process.StandardError.ReadToEnd().Trim()
    $Output = ($OutputTail.ToArray() -join "`n").Trim()
    if ($Output) {
      $Message = "$Message`nGNU Backgammon stdout:`n$Output"
    }
    if ($Stderr) {
      throw "$Message`nGNU Backgammon stderr:`n$Stderr"
    }
    throw $Message
  }

  function Send-Request([hashtable]$Request) {
    $Process.StandardInput.WriteLine(($Request | ConvertTo-Json -Compress -Depth 5))
    $Process.StandardInput.Flush()
  }

  function Read-Response([int]$Id) {
    $Deadline = [DateTime]::UtcNow.AddSeconds(120)
    while ([DateTime]::UtcNow -lt $Deadline) {
      $Read = $Process.StandardOutput.ReadLineAsync()
      $Remaining = [Math]::Max(1, [int]($Deadline - [DateTime]::UtcNow).TotalMilliseconds)
      if (-not $Read.Wait($Remaining)) {
        break
      }
      $Line = $Read.Result
      if ($null -eq $Line) {
        Fail-With-Diagnostics "GNU Backgammon exited before response $Id"
      }
      if ($OutputTail.Count -eq 32) {
        [void]$OutputTail.Dequeue()
      }
      $OutputTail.Enqueue($Line)
      if ($Line.TrimStart().StartsWith('{')) {
        $Candidate = $Line | ConvertFrom-Json
        if ($Candidate.id -eq $Id) {
          return $Candidate
        }
      }
    }
    Fail-With-Diagnostics "Timed out waiting for GNU Backgammon response $Id"
  }

  Send-Request @{
    id = 1
    method = 'rank_moves'
    params = @{
      positionId = '4HPwATDgc/ABMA'
      dice = @(6, 5)
      plies = 0
    }
  }

  $Response = Read-Response 1
  if (-not $Response.ok) {
    throw "Bundled GNU Backgammon bridge failed: $($Response.error)"
  }
  if ($Response.result.moves.Count -lt 1) {
    throw 'Bundled GNU Backgammon bridge returned no opening moves'
  }

  Send-Request @{
    id = 2
    method = 'cube_decision'
    params = @{
      positionId = '4HPwATDgc/ABMA'
      cubeValue = 1
      cubeOwned = $false
    }
  }
  $Cube = Read-Response 2
  if (-not $Cube.ok) {
    throw "Bundled GNU Backgammon cube bridge failed: $($Cube.error)"
  }
  if ($Cube.result.action -notin @('no-double', 'double', 'too-good')) {
    throw "Bundled GNU Backgammon returned invalid cube action: $($Cube.result.action)"
  }

  Write-Host (
    "Bundled GNU Backgammon smoke passed with " +
    "$($Response.result.moves.Count) legal moves and cube action $($Cube.result.action)"
  )
} finally {
  try {
    $Process.StandardInput.Close()
  } catch {
    # A diagnostic failure may already have stopped the process.
  }
  if (-not $Process.HasExited) {
    if (-not $Process.WaitForExit(5000)) {
      $Process.Kill()
    }
  }
  $Process.Dispose()
}
