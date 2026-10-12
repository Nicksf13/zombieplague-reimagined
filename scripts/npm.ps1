# Use a system Node.js or the portable copy under .tools, without changing Windows.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
    $nodeExecutable = $nodeCommand.Source
    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $npmCommand) { throw 'Node.js was found, but npm.cmd is missing. Install Node.js LTS with npm.' }
    $npmExecutable = $npmCommand.Source
} else {
    $toolsPath = Join-Path $projectRoot '.tools'
    $portableNode = Get-ChildItem -LiteralPath $toolsPath -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^node-v\d+\.\d+\.\d+-win-x64$' } |
        Sort-Object { [version]($_.Name -replace '^node-v', '' -replace '-win-x64$', '') } -Descending |
        Select-Object -First 1
    if (-not $portableNode) { throw 'Install Node.js LTS (22+) or place its portable win-x64 distribution in .tools.' }
    $nodeExecutable = Join-Path $portableNode.FullName 'node.exe'
    $npmExecutable = Join-Path $portableNode.FullName 'npm.cmd'
}
$previousPath = $env:PATH
Push-Location -LiteralPath $projectRoot
try {
    $env:PATH = (Split-Path -Parent $nodeExecutable) + ';' + $env:PATH
    & $npmExecutable @args
    $npmExitCode = $LASTEXITCODE
} finally {
    $env:PATH = $previousPath
    Pop-Location
}
exit $npmExitCode
