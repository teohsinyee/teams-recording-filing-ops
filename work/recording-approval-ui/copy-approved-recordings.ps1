param(
    [string]$ApprovalsPath = 'C:\Users\sinyee\Documents\Codex\2026-06-18\c-users-sinyee-onedrive-avnet-recordings\outputs\recording-approval-ui\data\approvals.json',
    [switch]$FreeUpSpace = $true
)

$approval = Get-Content -Raw -LiteralPath $ApprovalsPath | ConvertFrom-Json
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

    $target = Join-Path -Path $destDir -ChildPath $item.suggestedNewName
    if (-not (Test-Path -LiteralPath $target)) {
        Copy-Item -LiteralPath $item.sourcePath -Destination $target
        $status = 'copied'
    } else {
        $status = 'already-exists'
    }

    if ($FreeUpSpace -and (Test-Path -LiteralPath $target)) {
        attrib +U -P $target | Out-Null
    }

    [PSCustomObject]@{
        Status = $status
        Name = $item.name
        Target = $target
        Freed = [bool]$FreeUpSpace
    }
}

$results
