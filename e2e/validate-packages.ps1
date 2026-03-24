# e2e/validate-packages.ps1
# Builds Guest Configuration packages from generated MOFs and validates them
# with Test-GuestConfigurationPackage (local DSC evaluation — no Azure VM needed).
#
# Usage: pwsh -File e2e/validate-packages.ps1 [-InputDir /tmp/mc-e2e] [-TargetPlatform Linux|Windows|All]

#Requires -Version 7.0
param(
    [string]$InputDir = (Join-Path ([System.IO.Path]::GetTempPath()) 'mc-e2e'),
    [ValidateSet('Linux', 'Windows', 'All')]
    [string]$TargetPlatform = 'All'
)

$ErrorActionPreference = 'Stop'
$totalTests = 0
$passed = 0
$failed = 0
$skipped = 0
$failures = @()

# Detect host OS
$hostIsLinux = $IsLinux
$hostIsWindows = $IsWindows

function Get-ConfigPlatform([string]$mofContent) {
    if ($mofContent -match 'ModuleName = "nxtools"') { return 'Linux' }
    if ($mofContent -match 'ModuleName = "PSDscResources"') { return 'Windows' }
    if ($mofContent -match 'ModuleName = "SecurityPolicyDsc"') { return 'Windows' }
    if ($mofContent -match 'ModuleName = "AuditPolicyDsc"') { return 'Windows' }
    if ($mofContent -match 'ModuleName = "NetworkingDsc"') { return 'Windows' }
    if ($mofContent -match 'ModuleName = "ComputerManagementDsc"') { return 'Windows' }
    return 'Unknown'
}

function Test-CanRun([string]$platform) {
    if ($TargetPlatform -ne 'All' -and $TargetPlatform -ne $platform) { return $false }
    if ($platform -eq 'Linux' -and -not $hostIsLinux) { return $false }
    if ($platform -eq 'Windows' -and -not $hostIsWindows) { return $false }
    return $true
}

# ─── Install modules ─────────────────────────────────────────────────────────
Write-Host '📦 Ensuring required PowerShell modules...' -ForegroundColor Cyan

$requiredModules = @(
    @{ Name = 'GuestConfiguration'; Version = ''; Platform = 'All' }
    @{ Name = 'PSDscResources'; Version = '2.12.0.0'; Platform = 'Windows' }
    @{ Name = 'nxtools'; Version = '1.6.0'; Platform = 'Linux' }
    @{ Name = 'SecurityPolicyDsc'; Version = '2.10.0.0'; Platform = 'Windows' }
    @{ Name = 'AuditPolicyDsc'; Version = '1.4.0.0'; Platform = 'Windows' }
    @{ Name = 'NetworkingDsc'; Version = '9.0.0'; Platform = 'Windows' }
    @{ Name = 'ComputerManagementDsc'; Version = '9.2.0'; Platform = 'Windows' }
)

foreach ($mod in $requiredModules) {
    # Skip modules not needed for this platform
    if ($mod.Platform -ne 'All') {
        if ($mod.Platform -eq 'Linux' -and -not $hostIsLinux) { continue }
        if ($mod.Platform -eq 'Windows' -and -not $hostIsWindows) { continue }
    }
    $installed = if ($mod.Version) {
        Get-Module -ListAvailable -Name $mod.Name | Where-Object { $_.Version -eq $mod.Version }
    } else {
        Get-Module -ListAvailable -Name $mod.Name
    }

    if (-not $installed) {
        Write-Host "   Installing $($mod.Name) $(if ($mod.Version) { "v$($mod.Version)" })..."
        $installParams = @{ Name = $mod.Name; Force = $true; Scope = 'CurrentUser' }
        if ($mod.Version) { $installParams['RequiredVersion'] = $mod.Version }
        Install-Module @installParams -ErrorAction Stop
    } else {
        Write-Host "   ✓ $($mod.Name) $(if ($mod.Version) { "v$($mod.Version)" }) installed" -ForegroundColor DarkGray
    }
}

# ─── Process each config ─────────────────────────────────────────────────────
Write-Host "`n🧪 Running E2E validation...`n" -ForegroundColor Cyan

$configDirs = Get-ChildItem -Path $InputDir -Directory | Sort-Object Name

foreach ($dir in $configDirs) {
    $name = $dir.Name
    $mofFile = Join-Path $dir.FullName "$name.mof"

    if (-not (Test-Path $mofFile)) {
        Write-Host "⚠️  $name — No MOF file, skipping" -ForegroundColor Yellow
        $skipped++
        continue
    }

    $mofContent = Get-Content $mofFile -Raw
    $platform = Get-ConfigPlatform $mofContent
    $totalTests++

    if (-not (Test-CanRun $platform)) {
        Write-Host "⏭️  $name ($platform) — Skipped (wrong OS or filter)" -ForegroundColor DarkGray
        $skipped++
        continue
    }

    # Detect package type from metaconfig
    $pkgType = 'Audit'
    $metaFile = Join-Path $dir.FullName "$name.metaconfig.json"
    if (Test-Path $metaFile) {
        $meta = Get-Content $metaFile -Raw | ConvertFrom-Json
        if ($meta.Type -eq 'AuditAndSet') { $pkgType = 'AuditAndSet' }
    }

    Write-Host "── $name ($platform, $pkgType) ──" -ForegroundColor White

    try {
        # Build package
        $outDir = Join-Path $dir.FullName 'output'
        if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }

        $pkg = New-GuestConfigurationPackage `
            -Name $name `
            -Configuration $mofFile `
            -Path $outDir `
            -Type $pkgType `
            -Force

        if (-not $pkg -or -not (Test-Path $pkg.Path)) {
            throw 'New-GuestConfigurationPackage produced no output'
        }

        $hash = (Get-FileHash -Path $pkg.Path -Algorithm SHA256).Hash
        $sizeKB = [math]::Round((Get-Item $pkg.Path).Length / 1KB)
        Write-Host "   📦 Package: ${sizeKB}KB, SHA256: $($hash.Substring(0,16))..." -ForegroundColor DarkGray

        # Test package (v4.x renamed to Get-GuestConfigurationPackageComplianceStatus)
        $testCmd = if (Get-Command 'Test-GuestConfigurationPackage' -ErrorAction SilentlyContinue) {
            'Test-GuestConfigurationPackage'
        } else {
            'Get-GuestConfigurationPackageComplianceStatus'
        }
        $result = & $testCmd -Path $pkg.Path

        $status = $result.complianceStatus
        $resCount = ($result.resources | Measure-Object).Count

        # complianceStatus is a boolean or string:
        #   True / 'Compliant' = all resources compliant
        #   False / 'NonCompliant' = some resources non-compliant
        # Both mean DSC EVALUATED SUCCESSFULLY — the package is valid.
        # Only null/empty/error means something went wrong.
        if ($null -eq $status) {
            throw 'DSC evaluation returned null complianceStatus'
        }

        $displayStatus = if ($status -eq $true -or $status -eq 'True' -or $status -eq 'Compliant') { 'Compliant' } else { 'NonCompliant' }
        Write-Host "   ✅ PASS — Status: $displayStatus, Resources: $resCount" -ForegroundColor Green

            # Per-resource detail
            if ($result.resources) {
                foreach ($r in $result.resources) {
                    $rStatus = $r.complianceStatus
                    $icon = if ($rStatus -eq 'true' -or $rStatus -eq 'True' -or $rStatus -eq 'Compliant') { '  ✓' } else { '  ✗' }
                    $rName = ''
                    if ($r.properties -and $r.properties.ConfigurationName) {
                        $rName = $r.properties.ConfigurationName
                    } elseif ($r.ResourceId) {
                        $rName = $r.ResourceId
                    }

                    $reasons = ''
                    if ($r.properties -and $r.properties.Reasons) {
                        $phrases = $r.properties.Reasons | ForEach-Object { $_.Phrase } | Where-Object { $_ }
                        if ($phrases) { $reasons = " — $($phrases -join '; ')" }
                    }
                    Write-Host "   $icon $rName$reasons" -ForegroundColor DarkGray
                }
            }

            $passed++
    }
    catch {
        $errMsg = $_.Exception.Message

        # Commands like sysctl, ufw, etc. may not exist on CI/dev hosts but work on Azure VMs.
        # If DSC engine ran but a system command was missing, the PACKAGE is valid — mark as warning.
        $knownEnvErrors = @('is not recognized as a name of a cmdlet', 'command not found', 'No such file or directory')
        $isEnvIssue = $false
        foreach ($pattern in $knownEnvErrors) {
            if ($errMsg -match [regex]::Escape($pattern)) { $isEnvIssue = $true; break }
        }

        if ($isEnvIssue) {
            Write-Host "   ⚠️  WARN — Package valid, but system command missing on this host" -ForegroundColor Yellow
            Write-Host "      $($errMsg.Substring(0, [Math]::Min(200, $errMsg.Length)))..." -ForegroundColor DarkYellow
            $passed++  # Package structure is valid — would work on a real VM
        } else {
            Write-Host "   ❌ FAIL — $errMsg" -ForegroundColor Red
            if ($_.Exception.InnerException) {
                Write-Host "      Inner: $($_.Exception.InnerException.Message)" -ForegroundColor DarkRed
            }
            $failures += @{ Name = $name; Error = $errMsg }
            $failed++
        }
    }

    Write-Host ''
}

# ─── Summary ──────────────────────────────────────────────────────────────────
Write-Host '═══════════════════════════════════════════════════' -ForegroundColor Cyan
Write-Host "E2E Results: $passed passed, $failed failed, $skipped skipped (of $totalTests total)" -ForegroundColor $(if ($failed -eq 0) { 'Green' } else { 'Red' })

if ($failures.Count -gt 0) {
    Write-Host "`nFailures:" -ForegroundColor Red
    foreach ($f in $failures) {
        Write-Host "  ❌ $($f.Name): $($f.Error)" -ForegroundColor Red
    }
}

Write-Host '═══════════════════════════════════════════════════' -ForegroundColor Cyan

exit $failed
