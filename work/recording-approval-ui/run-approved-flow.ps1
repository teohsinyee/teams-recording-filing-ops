param(
    [string]$RepoRoot = '',
    [string]$ApprovalsPath = '',
    [int]$VttLimit = 0,
    [switch]$SkipVtt,
    [switch]$SkipRefresh
)

$RepoRoot = if ($RepoRoot) { $RepoRoot } else { Split-Path -Path $PSScriptRoot -Parent | Split-Path -Parent }
if (-not $ApprovalsPath) {
    $ApprovalsPath = Join-Path -Path $RepoRoot -ChildPath 'outputs\recording-approval-ui\data\approvals.json'
}

$logsDir = Join-Path -Path $RepoRoot -ChildPath 'outputs\recording-approval-ui\logs'
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
$runStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logPath = Join-Path -Path $logsDir -ChildPath "run-$runStamp.log"
$summaryPath = Join-Path -Path $logsDir -ChildPath "run-$runStamp.summary.json"

$copyScript = Join-Path -Path $RepoRoot -ChildPath 'work\recording-approval-ui\copy-approved-recordings.ps1'
$vttScript = Join-Path -Path $RepoRoot -ChildPath 'work\recording-approval-ui\download-missing-vtt.ps1'
$refreshScript = Join-Path -Path $RepoRoot -ChildPath 'work\recording-approval-ui\generate-recordings-json.ps1'

Start-Transcript -Path $logPath -Force | Out-Null
try {
    $startedAt = Get-Date

    Write-Host "Run log: $logPath"
    Write-Host 'Step 1/3: copy approved MP4 files'
    $copyResults = @(& $copyScript -RepoRoot $RepoRoot -ApprovalsPath $ApprovalsPath)
    $copyResults

    $vttStepStatus = if ($SkipVtt) { 'skipped' } else { 'ran' }
    if (-not $SkipVtt) {
        Write-Host 'Step 2/3: download missing VTT files'
        $vttArgs = @{
            RepoRoot = $RepoRoot
            ApprovalsPath = $ApprovalsPath
        }
        if ($VttLimit -gt 0) {
            $vttArgs.Limit = $VttLimit
        }
        & $vttScript @vttArgs
    } else {
        Write-Host 'Step 2/3: skipped VTT download'
    }

    $refreshStepStatus = if ($SkipRefresh) { 'skipped' } else { 'ran' }
    if (-not $SkipRefresh) {
        Write-Host 'Step 3/3: refresh review data'
        & $refreshScript -RepoRoot $RepoRoot | Out-Null
    } else {
        Write-Host 'Step 3/3: skipped refresh'
    }

    $endedAt = Get-Date
    $summary = [PSCustomObject]@{
        startedAt = $startedAt.ToString('o')
        endedAt = $endedAt.ToString('o')
        approvalsPath = $ApprovalsPath
        logPath = $logPath
        copy = [PSCustomObject]@{
            total = $copyResults.Count
            copied = @($copyResults | Where-Object Status -eq 'copied').Count
            alreadyExists = @($copyResults | Where-Object Status -eq 'already-exists').Count
            missingSource = @($copyResults | Where-Object Status -eq 'missing-source').Count
            failed = @($copyResults | Where-Object Status -in @('copy-failed', 'invalid-target-name', 'invalid-target-path', 'missing-destination')).Count
        }
        vtt = [PSCustomObject]@{
            status = $vttStepStatus
            limit = $VttLimit
        }
        refresh = [PSCustomObject]@{
            status = $refreshStepStatus
        }
    }
    $summary | ConvertTo-Json -Depth 5 | Set-Content -Path $summaryPath -Encoding UTF8
    Write-Host "Run summary: $summaryPath"
} finally {
    Stop-Transcript | Out-Null
}
