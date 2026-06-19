param(
    [string]$RepoRoot = ''
)

$RepoRoot = if ($RepoRoot) { $RepoRoot } else { Split-Path -Path $PSScriptRoot -Parent | Split-Path -Parent }
$loaderPath = Join-Path -Path $RepoRoot -ChildPath 'work\recording-approval-ui\config-loader.ps1'
$loaded = & $loaderPath -RepoRoot $RepoRoot
$config = $loaded.Config

$SourceDir = $config.sourceRecordingsDir
$OutputJson = Join-Path -Path $RepoRoot -ChildPath 'outputs\recording-approval-ui\data\recordings.json'
$OutputJs = Join-Path -Path $RepoRoot -ChildPath 'outputs\recording-approval-ui\data\recordings.js'
$streamBaseUrl = $config.streamBaseUrl
$streamPathPrefix = $config.streamPathPrefix

$destinations = @($config.destinations)
$routingRules = @($config.routingRules)

function Get-DurationText {
    param([string]$FullName)
    $shell = New-Object -ComObject Shell.Application
    $folder = $shell.Namespace((Split-Path -Path $FullName -Parent))
    $item = $folder.ParseName((Split-Path -Path $FullName -Leaf))
    $folder.GetDetailsOf($item, 27)
}

function Get-DurationSeconds {
    param([string]$DurationText)
    if (-not $DurationText) { return $null }
    $parts = $DurationText.Split(':')
    if ($parts.Count -ne 3) { return $null }
    ([int]$parts[0] * 3600) + ([int]$parts[1] * 60) + [int]$parts[2]
}

function Get-DatePrefix {
    param([string]$Name)
    if ($Name -match '(20\d{2})(\d{2})(\d{2})') {
        return ($matches[1].Substring(2, 2) + $matches[2] + $matches[3])
    }
    return ''
}

function Get-DateToken {
    param([string]$Name)
    if ($Name -match '(20\d{2})(\d{2})(\d{2})') {
        return ($matches[1] + $matches[2] + $matches[3])
    }
    return ''
}

function Get-NormalizedTitleKey {
    param([string]$Name)

    $base = [System.IO.Path]::GetFileNameWithoutExtension($Name)
    $base = $base -replace '^20\d{6}[_\-\s]*', ''
    $base = $base -replace '^\d{6}[_\-\s]*', ''
    $base = $base -replace '20\d{6}[_\-\s]*\d{6}UTC', ''
    $base = $base -replace '20\d{6}[_\-\s]*\d{6}', ''
    $base = $base -replace '-20\d{8}_\d{6}UTC-Meeting Recording$', ''
    $base = $base -replace '-20\d{8}_\d{6}-Meeting Recording$', ''
    $base = $base -replace '\bMeeting Recording\b', ''
    $base = $base -replace '[^A-Za-z0-9]+', ' '
    $base = $base.ToLowerInvariant().Trim()
    return $base
}

function Get-SuggestedDestinationId {
    param([string]$Name)
    foreach ($rule in $routingRules) {
        if (-not $rule.pattern -or -not $rule.destinationId) { continue }
        if ($Name -match $rule.pattern) {
            return $rule.destinationId
        }
    }
    return $null
}

function Get-StreamUrl {
    param([string]$FileName)
    $relativePath = $streamPathPrefix + $FileName
    $encodedPath = [System.Uri]::EscapeDataString($relativePath)
    return $streamBaseUrl + $encodedPath
}

function Get-MediaDurationSeconds {
    param(
        [string]$FullName
    )

    try {
        $durationText = Get-DurationText -FullName $FullName
        return Get-DurationSeconds -DurationText $durationText
    } catch {
        return $null
    }
}

function Find-MatchedMp4Copy {
    param(
        [string]$DateToken,
        [int]$DurationSeconds,
        [object[]]$Destinations
    )

    if (-not $DateToken -or $null -eq $DurationSeconds) { return $null }

    foreach ($destination in $Destinations) {
        $matches = Get-ChildItem -LiteralPath $destination.path -File -Filter *.mp4 -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match $DateToken -or $_.Name -match $DateToken.Substring(2, 6) }

        foreach ($candidate in $matches) {
            $candidateDuration = Get-MediaDurationSeconds -FullName $candidate.FullName
            if ($candidateDuration -eq $DurationSeconds) {
                return [PSCustomObject]@{
                    destinationId = $destination.id
                    path = $candidate.FullName
                    name = $candidate.Name
                }
            }
        }
    }

    return $null
}

function FindVttInDestination {
    param(
        [string]$BaseName,
        [string]$SuggestedNewName,
        [object[]]$Destinations
    )

    $originalVtt = [System.IO.Path]::ChangeExtension($BaseName, '.vtt')
    $suggestedVtt = [System.IO.Path]::ChangeExtension($SuggestedNewName, '.vtt')
    $datePrefix = Get-DatePrefix -Name $BaseName
    $dateToken = Get-DateToken -Name $BaseName
    $sourceKey = Get-NormalizedTitleKey -Name $BaseName

    foreach ($destination in $Destinations) {
        $originalTarget = Join-Path -Path $destination.path -ChildPath $originalVtt
        $suggestedTarget = Join-Path -Path $destination.path -ChildPath $suggestedVtt
        if (Test-Path -LiteralPath $originalTarget) {
            return [PSCustomObject]@{
                destinationId = $destination.id
                path = $originalTarget
                name = $originalVtt
            }
        }
        if (Test-Path -LiteralPath $suggestedTarget) {
            return [PSCustomObject]@{
                destinationId = $destination.id
                path = $suggestedTarget
                name = $suggestedVtt
            }
        }

        $candidates = Get-ChildItem -LiteralPath $destination.path -File -Filter *.vtt -ErrorAction SilentlyContinue
        foreach ($candidate in $candidates) {
            $candidateName = $candidate.Name
            $hasDate = ($datePrefix -and $candidateName -match [regex]::Escape($datePrefix)) -or
                ($dateToken -and $candidateName -match [regex]::Escape($dateToken))
            if (-not $hasDate) { continue }

            $candidateKey = Get-NormalizedTitleKey -Name $candidateName
            if ($candidateKey -and $candidateKey -eq $sourceKey) {
                return [PSCustomObject]@{
                    destinationId = $destination.id
                    path = $candidate.FullName
                    name = $candidate.Name
                }
            }
        }
    }

    return $null
}

$records = Get-ChildItem -LiteralPath $SourceDir -File |
    Sort-Object Name |
    ForEach-Object {
        $durationText = Get-DurationText -FullName $_.FullName
        $durationSeconds = Get-DurationSeconds -DurationText $durationText
        $prefix = Get-DatePrefix -Name $_.Name
        $dateToken = Get-DateToken -Name $_.Name
        $suggestedNewName = if ($prefix) { '{0}_{1}' -f $prefix, $_.Name } else { $_.Name }
        $mp4CopyMatch = Find-MatchedMp4Copy -DateToken $dateToken -DurationSeconds $durationSeconds -Destinations $destinations
        $vttMatch = FindVttInDestination -BaseName $_.Name -SuggestedNewName $suggestedNewName -Destinations $destinations
        [PSCustomObject]@{
            name = $_.Name
            sourcePath = $_.FullName
            sourceUrl = Get-StreamUrl -FileName $_.Name
            durationText = $durationText
            durationSeconds = $durationSeconds
            suspectShort = ($durationSeconds -ne $null -and $durationSeconds -lt 300)
            suggestedDestinationId = Get-SuggestedDestinationId -Name $_.Name
            datePrefix = $prefix
            dateToken = $dateToken
            suggestedNewName = $suggestedNewName
            alreadyCopied = ($null -ne $mp4CopyMatch)
            copiedMp4 = $mp4CopyMatch
            vttFound = ($null -ne $vttMatch)
            copiedVtt = $vttMatch
        }
    }

$payload = [PSCustomObject]@{
    generatedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssK')
    sourceDir = $SourceDir
    destinations = $destinations
    recordings = $records
}

$outputDir = Split-Path -Path $OutputJson -Parent
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$json = $payload | ConvertTo-Json -Depth 6
$json | Set-Content -LiteralPath $OutputJson -Encoding UTF8
("window.RECORDINGS_PAYLOAD = " + $json + ";") | Set-Content -LiteralPath $OutputJs -Encoding UTF8
