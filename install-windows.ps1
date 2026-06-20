$ErrorActionPreference = "Stop"

$AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BundledNodeBin = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
$BundledPnpm = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd"

function Use-Node {
    $pathNode = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($pathNode) {
        return $pathNode.Source
    }

    $bundledNode = Join-Path $BundledNodeBin "node.exe"
    if (Test-Path $bundledNode) {
        $env:PATH = "$BundledNodeBin;$env:PATH"
        return $bundledNode
    }

    throw "Could not find node.exe. Install Node.js from https://nodejs.org or run this inside Codex Desktop after its runtime is available."
}

function Resolve-Pnpm {
    $pathPnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
    if ($pathPnpm) {
        return $pathPnpm.Source
    }

    if (Test-Path $BundledPnpm) {
        return $BundledPnpm
    }

    throw "Could not find pnpm. Install Node.js from https://nodejs.org or run this inside Codex Desktop after its runtime is available."
}

$node = Use-Node
$pnpm = Resolve-Pnpm
Set-Location $AppRoot

Write-Host "Installing AutoGen Editor dependencies..."
Write-Host "Using Node: $node"
Write-Host "Using: $pnpm"
& $pnpm install

if ($LASTEXITCODE -ne 0) {
    throw "Dependency installation failed."
}

Write-Host "Preparing Electron..."
& $pnpm rebuild electron
if ($LASTEXITCODE -ne 0) {
    throw "Electron setup failed."
}

Write-Host ""
Write-Host "Install complete. Run start-windows.cmd to launch the editor."
