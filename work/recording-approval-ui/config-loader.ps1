param(
    [string]$RepoRoot = ''
)

$RepoRoot = if ($RepoRoot) { $RepoRoot } else { Split-Path -Path $PSScriptRoot -Parent | Split-Path -Parent }
$configPath = Join-Path -Path $RepoRoot -ChildPath 'config.local.json'
if (-not (Test-Path -LiteralPath $configPath)) {
    throw "Missing config.local.json. Copy config.example.json to config.local.json and fill in your local paths."
}

$config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
[PSCustomObject]@{
    RepoRoot = $RepoRoot
    ConfigPath = $configPath
    Config = $config
}
