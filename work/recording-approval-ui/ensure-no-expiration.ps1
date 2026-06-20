param(
    [string]$RepoRoot = '',
    [string]$RecordingsPath = '',
    [int]$Limit = 0
)

$RepoRoot = if ($RepoRoot) { $RepoRoot } else { Split-Path -Path $PSScriptRoot -Parent | Split-Path -Parent }
if (-not $RecordingsPath) {
    $RecordingsPath = Join-Path -Path $RepoRoot -ChildPath 'outputs\recording-approval-ui\data\recordings.json'
}

$scriptPath = Join-Path -Path $RepoRoot -ChildPath 'work\recording-approval-ui\ensure-no-expiration.mjs'
$command = "node `"$scriptPath`" --recordings=`"$RecordingsPath`""

if ($Limit -gt 0) {
    $command += " --limit=$Limit"
}

Invoke-Expression $command
