param(
    [string]$RecordingsPath = 'C:\Users\sinyee\Documents\Codex\2026-06-18\c-users-sinyee-onedrive-avnet-recordings\outputs\recording-approval-ui\data\recordings.json',
    [string]$ApprovalsPath = 'C:\Users\sinyee\Downloads\approvals.json',
    [int]$Limit = 0
)

$scriptPath = 'C:\Users\sinyee\Documents\Codex\2026-06-18\c-users-sinyee-onedrive-avnet-recordings\work\recording-approval-ui\download-missing-vtt.mjs'
$command = "node `"$scriptPath`" --recordings=`"$RecordingsPath`" --approvals=`"$ApprovalsPath`""

if ($Limit -gt 0) {
    $command += " --limit=$Limit"
}

Invoke-Expression $command
