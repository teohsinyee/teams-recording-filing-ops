param(
    [string]$RepoRoot = '',
    [string]$ApprovalsPath = '',
    [switch]$FreeUpSpace = $true
)

$RepoRoot = if ($RepoRoot) { $RepoRoot } else { Split-Path -Path $PSScriptRoot -Parent | Split-Path -Parent }
$loaderPath = Join-Path -Path $RepoRoot -ChildPath 'work\recording-approval-ui\config-loader.ps1'
$loaded = & $loaderPath -RepoRoot $RepoRoot
$config = $loaded.Config
if (-not $ApprovalsPath) {
    $ApprovalsPath = Join-Path -Path $RepoRoot -ChildPath 'outputs\recording-approval-ui\data\approvals.json'
}

$approval = [System.IO.File]::ReadAllText($ApprovalsPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$recordingsPath = Join-Path -Path $RepoRoot -ChildPath 'outputs\recording-approval-ui\data\recordings.json'
$recordingsData = if (Test-Path -LiteralPath $recordingsPath) {
    [System.IO.File]::ReadAllText($recordingsPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
} else {
    $null
}
$recordingMap = @{}
if ($recordingsData) {
    foreach ($recording in $recordingsData.recordings) {
        $recordingMap[$recording.name] = $recording
    }
}

function Find-RecordingByApproval {
    param(
        [object]$ApprovalItem,
        [object]$RecordingsData
    )

    if (-not $RecordingsData) { return $null }

    $direct = $RecordingsData.recordings | Where-Object { $_.name -eq $ApprovalItem.name } | Select-Object -First 1
    if ($direct) { return $direct }

    $datePrefix = $ApprovalItem.datePrefix
    $durationSeconds = $ApprovalItem.durationSeconds
    if (-not $datePrefix -or $null -eq $durationSeconds) { return $null }

    return $RecordingsData.recordings |
        Where-Object {
            $_.datePrefix -eq $datePrefix -and
            $_.durationSeconds -eq $durationSeconds
        } |
        Select-Object -First 1
}

function Get-LongPath {
    param([string]$Path)

    if ($Path.StartsWith('\\?\')) { return $Path }
    if ($Path.StartsWith('\\')) {
        return '\\?\UNC\' + $Path.TrimStart('\')
    }
    return '\\?\' + $Path
}

function Test-FileExistsRobust {
    param([string]$Path)

    return (Test-Path -LiteralPath $Path) -or [System.IO.File]::Exists((Get-LongPath -Path $Path))
}

function Copy-FileRobust {
    param(
        [string]$SourcePath,
        [string]$TargetPath
    )

    try {
        Copy-Item -LiteralPath $SourcePath -Destination $TargetPath -ErrorAction Stop
        return $true
    } catch {
        try {
            [System.IO.File]::Copy((Get-LongPath -Path $SourcePath), (Get-LongPath -Path $TargetPath), $false)
            return $true
        } catch {
        }

        $sourceDir = Split-Path -Path $SourcePath -Parent
        $sourceName = Split-Path -Path $SourcePath -Leaf
        $targetDir = Split-Path -Path $TargetPath -Parent
        $targetName = Split-Path -Path $TargetPath -Leaf

        $robocopyArgs = @(
            "`"$sourceDir`""
            "`"$targetDir`""
            "`"$sourceName`""
            "/R:1"
            "/W:1"
            "/NFL"
            "/NDL"
            "/NJH"
            "/NJS"
            "/NC"
            "/NS"
            "/NP"
        )

        & robocopy @robocopyArgs | Out-Null
        if ($LASTEXITCODE -le 7) {
            $copiedPath = Join-Path -Path $targetDir -ChildPath $sourceName
            if ($sourceName -ne $targetName -and (Test-FileExistsRobust -Path $copiedPath)) {
                if (Test-FileExistsRobust -Path $TargetPath) {
                    Remove-Item -LiteralPath $copiedPath -Force
                } else {
                    [System.IO.File]::Move((Get-LongPath -Path $copiedPath), (Get-LongPath -Path $TargetPath))
                }
            }
            return (Test-FileExistsRobust -Path $TargetPath)
        }

        return $false
    }
}
$destMap = @{}
foreach ($destination in $approval.destinations) {
    $destMap[$destination.id] = $destination.path
}

$results = foreach ($item in $approval.approvals) {
    if (-not $item.approved -or $item.skipCopy -or -not $item.destinationId) { continue }

    $destDir = $destMap[$item.destinationId]
    if (-not $destDir) {
        [PSCustomObject]@{ Status = 'missing-destination'; Name = $item.name; Target = '' }
        continue
    }

    if (-not (Test-Path -LiteralPath $destDir)) {
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    }

    $sourcePath = $item.sourcePath
    if (-not (Test-Path -LiteralPath $sourcePath)) {
        $recording = $recordingMap[$item.name]
        if (-not $recording) {
            $recording = Find-RecordingByApproval -ApprovalItem $item -RecordingsData $recordingsData
        }
        if ($recording -and (Test-Path -LiteralPath $recording.sourcePath)) {
            $sourcePath = $recording.sourcePath
        } else {
            $fallbackSourcePath = Join-Path -Path $config.sourceRecordingsDir -ChildPath $item.name
            if (Test-Path -LiteralPath $fallbackSourcePath) {
                $sourcePath = $fallbackSourcePath
            }
        }
    }

    $target = Join-Path -Path $destDir -ChildPath $item.suggestedNewName
    if (-not (Test-FileExistsRobust -Path $target)) {
        if (-not (Test-Path -LiteralPath $sourcePath)) {
            $status = 'missing-source'
        } else {
            if (Copy-FileRobust -SourcePath $sourcePath -TargetPath $target) {
                $status = 'copied'
            } else {
                $status = 'copy-failed'
            }
        }
    } else {
        $status = 'already-exists'
    }

    if ($FreeUpSpace -and (Test-FileExistsRobust -Path $target) -and $status -ne 'copy-failed') {
        attrib +U -P $target | Out-Null
    }

    [PSCustomObject]@{
        Status = $status
        Name = $item.name
        Target = $target
        Freed = [bool]$FreeUpSpace
        Source = $sourcePath
    }
}

$results
