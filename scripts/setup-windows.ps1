param(
    [ValidateSet('Check','Install')][string]$Mode = 'Check',
    [switch]$Development,
    [switch]$WithAI,
    [switch]$ConfigureFirewall,
    [switch]$InstallSpanishOcr
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
}
function Install-Package([string]$Id) {
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) { throw 'No se encontro WinGet. Instala App Installer de Microsoft o usa los instaladores oficiales indicados en MANUAL-IA.md.' }
    & winget.exe install --id $Id --exact --source winget --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 3010) { throw "WinGet no pudo instalar $Id. Codigo: $LASTEXITCODE" }
    Refresh-Path
}
function Get-OcrLanguages {
    try {
        Add-Type -AssemblyName System.Runtime.WindowsRuntime
        $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
        return @([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object { $_.LanguageTag })
    } catch { return @() }
}
try {
    if ($Mode -eq 'Install') {
        if ($Development) {
            $node = Get-Command node.exe -ErrorAction SilentlyContinue
            if (-not $node) { Install-Package 'OpenJS.NodeJS.LTS' }
            $nodeVersion = (& node.exe --version).Trim().TrimStart('v')
            if ([version]$nodeVersion -lt [version]'22.13.0') { throw 'Se requiere Node.js 22.13 o posterior. Actualiza Node desde nodejs.org y repite.' }
            Push-Location $projectRoot
            try {
                & npm.cmd ci --no-audit --no-fund
                if ($LASTEXITCODE -ne 0) { throw 'npm ci no termino correctamente.' }
                & node.exe (Join-Path $projectRoot 'node_modules/electron/install.js')
                if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar el motor de Electron.' }
            }
            finally { Pop-Location }
        }
        if ($WithAI -and -not (Get-Command ollama.exe -ErrorAction SilentlyContinue)) { Install-Package 'Ollama.Ollama' }
        if ($InstallSpanishOcr -and -not ((Get-OcrLanguages) -contains 'es-ES')) {
            Add-WindowsCapability -Online -Name 'Language.OCR~~~es-ES~0.0.1.0' | Out-Null
        }
        if ($ConfigureFirewall) {
            & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'ollama-firewall.ps1') -Mode Install
            if ($LASTEXITCODE -ne 0) { throw 'No se confirmo el bloqueo. Ejecuta bloquear-internet-ia.cmd como administrador o usa el menu Folio en la app de escritorio.' }
        }
    }
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    $ollamaCommand = Get-Command ollama.exe -ErrorAction SilentlyContinue
    $version = if ($nodeCommand) { (& node.exe --version).Trim() } else { $null }
    $firewallVerified = $false
    if ($ollamaCommand) {
        $policyText = & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'ollama-firewall.ps1') -Mode Verify
        try { $firewallVerified = ($policyText | ConvertFrom-Json).verified -eq $true } catch { }
    }
    [ordered]@{
        mode = $Mode
        nodeVersion = $version
        nodeRequiredForPackagedApp = $false
        sourceDependenciesInstalled = ((Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/pdf-parse/package.json')) -and (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/mammoth/package.json')))
        desktopBuildDependenciesInstalled = ((Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/electron/package.json')) -and (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/electron-builder/package.json')))
        desktopRuntimePrepared = (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/electron/dist/electron.exe'))
        ollamaInstalled = [bool]$ollamaCommand
        firewallVerified = $firewallVerified
        ocrLanguages = @(Get-OcrLanguages)
        modelProvisioning = 'No se descargan modelos. Usa los ya instalados o importa un GGUF local segun MANUAL-IA.md.'
    } | ConvertTo-Json -Depth 4
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
