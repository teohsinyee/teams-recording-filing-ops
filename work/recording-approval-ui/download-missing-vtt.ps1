param(
    [string]$RepoRoot = '',
    [string]$RecordingsPath = '',
    [string]$ApprovalsPath = '',
    [int]$Limit = 0
)

$RepoRoot = if ($RepoRoot) { $RepoRoot } else { Split-Path -Path $PSScriptRoot -Parent | Split-Path -Parent }
$loaderPath = Join-Path -Path $RepoRoot -ChildPath 'work\recording-approval-ui\config-loader.ps1'
$loaded = & $loaderPath -RepoRoot $RepoRoot
if (-not $RecordingsPath) {
    $RecordingsPath = Join-Path -Path $RepoRoot -ChildPath 'outputs\recording-approval-ui\data\recordings.json'
}
if (-not $ApprovalsPath) {
    $ApprovalsPath = Join-Path -Path $RepoRoot -ChildPath 'outputs\recording-approval-ui\data\approvals.json'
}

$scriptPath = Join-Path -Path $RepoRoot -ChildPath 'work\recording-approval-ui\download-missing-vtt.mjs'
$command = "node `"$scriptPath`" --recordings=`"$RecordingsPath`" --approvals=`"$ApprovalsPath`""

if ($Limit -gt 0) {
    $command += " --limit=$Limit"
}

Invoke-Expression $command
