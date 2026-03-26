# e2e/validate-packages.ps1
# Builds Guest Configuration packages from generated MOFs and validates them
# with Test-GuestConfigurationPackage (local DSC evaluation).
#
# Usage: pwsh -File e2e/validate-packages.ps1 [-InputDir /tmp/mc-e2e] [-TargetPlatform Linux|Windows|All]
#
# Exit codes: number of failed tests (0 = all pass)
#
# What this does:
#   1. Build package (New-GuestConfigurationPackage)
#   2. Fix ZIP module paths for Azure compatibility (the cmdlet doesn't enforce this)
#   3. Validate package (Test-GuestConfigurationPackage)
#   4. Report results

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

$hostIsLinux = $IsLinux
$hostIsWindows = $IsWindows

# ─── ZIP structure helpers ────────────────────────────────────────────────────
# Azure GC agent requires Modules/<Name>/<Version>/ inside the ZIP.
# New-GuestConfigurationPackage on Linux produces flat Modules/<Name>/ which
# works locally but Azure rejects with a misleading error.

function Get-MofModules([string]$mofContent) {
    $modules = @{}
    $instances = [regex]::Matches($mofContent, '(?s)instance of \w+.*?\{.*?\}')
    foreach ($inst in $instances) {
        $block = $inst.Value
        $modName = if ($block -match 'ModuleName\s*=\s*"([^"]+)"') { $Matches[1] } else { $null }
        $modVer  = if ($block -match 'ModuleVersion\s*=\s*"([^"]+)"') { $Matches[1] } else { $null }
        if ($modName -and $modVer -and $modName -ne 'GuestConfiguration') {
            $modules[$modName] = $modVer
        }
    }
    return $modules
}

function Test-ZipModuleStructure([string]$zipPath, [hashtable]$expectedModules) {
    $errors = @()
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
        $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
        $entries = $zip.Entries | ForEach-Object { $_.FullName }
        $zip.Dispose()

        foreach ($modName in $expectedModules.Keys) {
            $modVer = $expectedModules[$modName]
            $hasVersioned = $entries | Where-Object { $_ -like "Modules/$modName/$modVer/*" }
            if (-not $hasVersioned) {
                $hasFlat = $entries | Where-Object { $_ -like "Modules/$modName/*" }
                if ($hasFlat) {
                    $errors += "'$modName' is flat (Modules/$modName/) — Azure requires Modules/$modName/$modVer/"
                } else {
                    $errors += "'$modName' v$modVer not found in ZIP"
                }
            }
        }
    }
    catch {
        $errors += "ZIP inspection failed: $($_.Exception.Message)"
    }
    return $errors
}

function Repair-ZipModuleStructure([string]$zipPath, [hashtable]$expectedModules) {
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
        $tmpStage = Join-Path ([System.IO.Path]::GetTempPath()) "zip-repair-$(Get-Random)"
        New-Item -Path $tmpStage -ItemType Directory -Force | Out-Null
        [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $tmpStage)

        foreach ($modName in $expectedModules.Keys) {
            $modVer = $expectedModules[$modName]
            $flatPath = Join-Path $tmpStage "Modules/$modName"
            $versionedPath = Join-Path $tmpStage "Modules/$modName/$modVer"

            if ((Test-Path $flatPath) -and -not (Test-Path $versionedPath)) {
                $tmpMove = Join-Path ([System.IO.Path]::GetTempPath()) "mod-move-$(Get-Random)"
                Move-Item -Path $flatPath -Destination $tmpMove -Force
                New-Item -Path $versionedPath -ItemType Directory -Force | Out-Null
                Get-ChildItem -Path $tmpMove -Force | Move-Item -Destination $versionedPath -Force
                Remove-Item $tmpMove -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        Remove-Item $zipPath -Force
        [System.IO.Compression.ZipFile]::CreateFromDirectory($tmpStage, $zipPath)
        Remove-Item $tmpStage -Recurse -Force -ErrorAction SilentlyContinue
        return $true
    }
    catch {
        Write-Host "      Repair failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# ─── Helpers ──────────────────────────────────────────────────────────────────
function Get-ConfigPlatform([string]$mofContent) {
    if ($mofContent -match 'ModuleName = "nxtools"') { return 'Linux' }
    if ($mofContent -match 'ModuleName = "(PSDscResources|SecurityPolicyDsc|AuditPolicyDsc|NetworkingDsc|ComputerManagementDsc)"') { return 'Windows' }
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
        # 1. Build package
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

        # 2. Fix ZIP module structure if needed
        $expectedMods = Get-MofModules $mofContent
        if ($expectedMods.Count -gt 0) {
            $zipErrors = Test-ZipModuleStructure $pkg.Path $expectedMods
            if ($zipErrors.Count -gt 0) {
                Write-Host "   🔧 Fixing flat module paths for Azure compatibility..." -ForegroundColor Yellow
                $repaired = Repair-ZipModuleStructure $pkg.Path $expectedMods
                if (-not $repaired) {
                    throw "ZIP module structure repair failed"
                }
                # Verify
                $recheck = Test-ZipModuleStructure $pkg.Path $expectedMods
                if ($recheck.Count -gt 0) {
                    throw "ZIP still invalid after repair: $($recheck -join '; ')"
                }
                $newHash = (Get-FileHash -Path $pkg.Path -Algorithm SHA256).Hash
                Write-Host "   ✓ Fixed — SHA256: $($newHash.Substring(0,16))..." -ForegroundColor DarkGray
            }
        }

        # 3. Validate package
        $testCmd = if (Get-Command 'Test-GuestConfigurationPackage' -ErrorAction SilentlyContinue) {
            'Test-GuestConfigurationPackage'
        } else {
            'Get-GuestConfigurationPackageComplianceStatus'
        }
        $result = & $testCmd -Path $pkg.Path

        if ($null -eq $result.complianceStatus) {
            throw 'Test-GuestConfigurationPackage returned null complianceStatus'
        }

        $isCompliant = $result.complianceStatus -eq $true -or $result.complianceStatus -eq 'True' -or $result.complianceStatus -eq 'Compliant'
        $resCount = ($result.resources | Measure-Object).Count

        # 4. Report
        if ($isCompliant) {
            Write-Host "   ✅ PASS — Compliant, $resCount resources" -ForegroundColor Green
        } else {
            Write-Host "   ✅ PASS — NonCompliant (drift detected), $resCount resources" -ForegroundColor Green
        }
        $passed++

        # Per-resource detail
        if ($result.resources) {
            foreach ($r in $result.resources) {
                $rStatus = $r.complianceStatus
                $icon = if ($rStatus -eq 'true' -or $rStatus -eq 'True' -or $rStatus -eq 'Compliant') { '✓' } else { '✗' }
                $rName = if ($r.properties.ConfigurationName) { $r.properties.ConfigurationName } elseif ($r.ResourceId) { $r.ResourceId } else { '?' }
                $reasons = ''
                if ($r.properties -and $r.properties.Reasons) {
                    $phrases = ($r.properties.Reasons | ForEach-Object { $_.Phrase } | Where-Object { $_ }) -join '; '
                    if ($phrases) { $reasons = " — $($phrases.Substring(0, [Math]::Min(200, $phrases.Length)))" }
                }
                Write-Host "     $icon $rName$reasons" -ForegroundColor DarkGray
            }
        }
    }
    catch {
        Write-Host "   ❌ FAIL — $($_.Exception.Message)" -ForegroundColor Red
        $failures += @{ Name = $name; Error = $_.Exception.Message.Substring(0, [Math]::Min(500, $_.Exception.Message.Length)) }
        $failed++
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
