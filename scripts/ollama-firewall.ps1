param([ValidateSet('Install','Verify')][string]$Mode = 'Verify')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
# Exclude only IPv4 loopback and IPv6 ::1. Local model RPC uses loopback.
$remoteRanges = @('0.0.0.0-126.255.255.255', '128.0.0.0-255.255.255.255', '::2-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')
try {
    $engine = (Get-Command ollama.exe -CommandType Application -ErrorAction Stop).Source
    $root = Split-Path -Parent $engine
    $programs = @(Get-ChildItem -LiteralPath $root -Filter '*.exe' -Recurse -File -ErrorAction Stop | Select-Object -ExpandProperty FullName)
    if ($programs.Count -eq 0) { throw 'No se encontraron ejecutables de Ollama.' }
    if ($Mode -eq 'Install') {
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
        if (-not ([Security.Principal.WindowsPrincipal]::new($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Se requieren permisos de administrador.' }
    }
    if ((Get-Service MpsSvc).Status -ne 'Running') { throw 'El servicio Firewall de Windows no esta activo.' }
    $profiles = @(Get-NetFirewallProfile -PolicyStore ActiveStore)
    if ($profiles.Count -ne 3 -or @($profiles | Where-Object { $_.Enabled -ne 'True' }).Count -gt 0) { throw 'El Firewall de Windows debe estar activo en los tres perfiles.' }
    foreach ($program in $programs) {
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $hash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($program.ToLowerInvariant()))).Replace('-','').Substring(0,16) } finally { $sha.Dispose() }
        $name = 'Folio-Ollama-Offline-' + $hash
        if ($Mode -eq 'Install') {
            # Replace only Folio's own rule for this exact executable.
            $existing = Get-NetFirewallRule -PolicyStore PersistentStore -Name $name -ErrorAction SilentlyContinue
            if ($existing) { $existing | Remove-NetFirewallRule }
            New-NetFirewallRule -PolicyStore PersistentStore -Name $name -DisplayName ('Folio: IA sin Internet - ' + [IO.Path]::GetFileName($program)) -Group 'Folio - Ollama sin Internet' -Description 'Bloqueo saliente de Ollama fuera de loopback. Impide descargas y servicios de nube. Creado por solicitud del usuario de Folio.' -Direction Outbound -Action Block -Enabled True -Profile Any -Program $program -Protocol Any -RemoteAddress $remoteRanges | Out-Null
        }
        $rules = @(Get-NetFirewallRule -PolicyStore ActiveStore -Name $name -ErrorAction Stop)
        if ($rules.Count -ne 1) { throw 'No se encontro una regla efectiva unica para Ollama.' }
        $rule = $rules[0]
        if ($rule.Enabled -ne 'True' -or $rule.Direction -ne 'Outbound' -or $rule.Action -ne 'Block' -or $rule.Profile -ne 'Any') { throw 'Una regla de bloqueo no esta activa para todos los perfiles.' }
        $app = $rule | Get-NetFirewallApplicationFilter
        if ($app.Program -ine $program) { throw 'Una regla apunta a otro ejecutable.' }
        $ports = $rule | Get-NetFirewallPortFilter
        if ($ports.Protocol -ne 'Any' -or $ports.LocalPort -ne 'Any' -or $ports.RemotePort -ne 'Any') { throw 'Una regla limita el bloqueo a algunos puertos o protocolos.' }
        $addresses = $rule | Get-NetFirewallAddressFilter
        if ($addresses.LocalAddress -ne 'Any') { throw 'Una regla limita las direcciones locales.' }
        $actual = @($addresses.RemoteAddress | ForEach-Object { $_.ToLowerInvariant() })
        if (@(Compare-Object ($remoteRanges | Sort-Object) ($actual | Sort-Object)).Count -gt 0) { throw 'Una regla no cubre todas las direcciones fuera de loopback.' }
        $interfaces = $rule | Get-NetFirewallInterfaceFilter
        $interfaceTypes = $rule | Get-NetFirewallInterfaceTypeFilter
        $services = $rule | Get-NetFirewallServiceFilter
        if ($interfaces.InterfaceAlias -ne 'Any' -or $interfaceTypes.InterfaceType -ne 'Any' -or $services.Service -ne 'Any') { throw 'Una regla tiene restricciones de interfaz o servicio.' }
    }
    @{ verified = $true; engine = $engine; programs = $programs.Count; mode = $Mode } | ConvertTo-Json -Compress
} catch {
    @{ verified = $false; error = 'No se pudo verificar el bloqueo de Internet de Ollama. Ejecuta bloquear-internet-ia.cmd con permisos de administrador y comprueba que el Firewall de Windows este activo.' } | ConvertTo-Json -Compress
    exit 1
}
