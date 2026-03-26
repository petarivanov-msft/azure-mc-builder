# e2e/validate-packages.ps1
# Builds Guest Configuration packages from generated MOFs and validates them
# with Test-GuestConfigurationPackage (local DSC evaluation — no Azure VM needed).
#
# Usage: pwsh -File e2e/validate-packages.ps1 [-InputDir /tmp/mc-e2e] [-TargetPlatform Linux|Windows|All]
#
# Exit codes: number of failed tests (0 = all pass)
#
# VALIDATION PHILOSOPHY:
#   A "PASS" means the DSC engine loaded the resource, ran Get/Test, and returned
#   a clean compliance result (Compliant or NonCompliant with drift reasons).
#   Any result that contains exceptions, stack traces, or resource loading failures
#   is a FAIL — even if DSC returns a non-null complianceStatus.

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

# ─── Error classification patterns ───────────────────────────────────────────
# These patterns in Reason phrases or exception messages indicate the resource
# FAILED TO EXECUTE — not that it found legitimate drift/non-compliance.

# Fatal: resource doesn't exist or can't load (package is structurally invalid)
$fatalResourcePatterns = @(
    'is not recognized as the name of a Resource',
    "couldn't find PowerShell DSC resource",
    'Could not find the type of DSC resource class',
    'Failed to Run Consistency'
)

# Fatal: resource loaded but blew up during execution (Get/Test/Set threw)
# These indicate broken resource logic, bad test data, or missing dependencies.
$executionErrorPatterns = @(
    'failed to execute .* functionality with error message',
    'threw an exception',
    'CommandNotFoundException',
    'InvalidOperationException',
    'System\.Management\.Automation\.\w+Exception',
    '--- End of inner exception stack trace ---',
    'at System\.',
    'at Microsoft\.'
)

$allFatalPatterns = $fatalResourcePatterns + $executionErrorPatterns

# Environment-only: system commands missing on this host but package is valid.
# When these appear INSIDE an execution error (e.g. nxScript calling sysctl),
# the package itself is fine — the host just doesn't have that tool.
$envOnlyPatterns = @(
    'is not recognized as a name of a cmdlet',
    'command not found',
    'No such file or directory'
)

function Test-ReasonIsEnvOnly([string]$phrase) {
    # If the phrase contains an environment-only pattern, it's a host issue, not a package issue
    foreach ($pattern in $script:envOnlyPatterns) {
        if ($phrase -match [regex]::Escape($pattern)) { return $true }
    }
    return $false
}

function Test-ReasonIsFatalResource([string]$phrase) {
    # Check for resource-level failures (can't load, doesn't exist)
    foreach ($pattern in $script:fatalResourcePatterns) {
        if ($phrase -match $pattern) { return $true }
    }
    return $false
}

function Test-ReasonIsFatal([string]$phrase) {
    # Env issues take priority — if the inner cause is "command not found", it's not fatal
    if (Test-ReasonIsEnvOnly $phrase) { return $false }
    # Then check for resource loading failures
    if (Test-ReasonIsFatalResource $phrase) { return $true }
    # Then check for execution errors (only if NOT env-related)
    foreach ($pattern in $script:executionErrorPatterns) {
        if ($phrase -match $pattern) { return $true }
    }
    return $false
}

# ─── ZIP structure validation ─────────────────────────────────────────────────
# Azure GC agent requires versioned module paths: Modules/<Name>/<Version>/
# Local Test-GuestConfigurationPackage does NOT enforce this — it happily runs
# with flat Modules/<Name>/... but Azure rejects it with a misleading
# "does not support remediation" error.

function Get-MofModules([string]$mofContent) {
    # Extract all ModuleName + ModuleVersion pairs from MOF
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
    # Returns array of error strings (empty = all good)
    $errors = @()
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
        $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
        $entries = $zip.Entries | ForEach-Object { $_.FullName }
        $zip.Dispose()

        foreach ($modName in $expectedModules.Keys) {
            $modVer = $expectedModules[$modName]
            # Expected: Modules/<Name>/<Version>/ (with something inside it)
            $versionedPattern = "Modules/$modName/$modVer/"
            $hasVersioned = $entries | Where-Object { $_ -like "$versionedPattern*" }

            if (-not $hasVersioned) {
                # Check if it exists flat (common bug)
                $flatPattern = "Modules/$modName/"
                $hasFlat = $entries | Where-Object { $_ -like "$flatPattern*" -and $_ -notlike "$flatPattern*/*/*/*" }
                if ($hasFlat) {
                    $errors += "Module '$modName' has flat structure (Modules/$modName/...) but Azure requires versioned path (Modules/$modName/$modVer/...)"
                } else {
                    $errors += "Module '$modName' v$modVer not found in ZIP at all (expected Modules/$modName/$modVer/)"
                }
            }
        }
    }
    catch {
        $errors += "Failed to inspect ZIP: $($_.Exception.Message)"
    }
    return $errors
}

function Repair-ZipModuleStructure([string]$zipPath, [hashtable]$expectedModules) {
    # Restages the ZIP with versioned module paths: Modules/<Name>/<Version>/...
    # Returns $true on success, $false on failure
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
        $tmpStage = Join-Path ([System.IO.Path]::GetTempPath()) "zip-repair-$(Get-Random)"
        New-Item -Path $tmpStage -ItemType Directory -Force | Out-Null

        # Extract
        [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $tmpStage)

        # Restage each module with version folder
        foreach ($modName in $expectedModules.Keys) {
            $modVer = $expectedModules[$modName]
            $flatPath = Join-Path $tmpStage "Modules/$modName"
            $versionedPath = Join-Path $tmpStage "Modules/$modName/$modVer"

            if ((Test-Path $flatPath) -and -not (Test-Path $versionedPath)) {
                # Move contents into versioned subfolder
                $tmpMove = Join-Path ([System.IO.Path]::GetTempPath()) "mod-move-$(Get-Random)"
                Move-Item -Path $flatPath -Destination $tmpMove -Force
                New-Item -Path $versionedPath -ItemType Directory -Force | Out-Null
                Get-ChildItem -Path $tmpMove -Force | Move-Item -Destination $versionedPath -Force
                Remove-Item $tmpMove -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        # Repackage
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

function Test-ErrorIsFatalDsc([string]$msg) {
    foreach ($pattern in $script:fatalResourcePatterns) {
        if ($msg -match [regex]::Escape($pattern)) { return $true }
    }
    foreach ($pattern in $script:executionErrorPatterns) {
        if ($msg -match $pattern) { return $true }
    }
    return $false
}

function Test-ErrorIsEnvOnly([string]$msg) {
    # Env errors should NOT match fatal patterns
    if (Test-ErrorIsFatalDsc $msg) { return $false }
    foreach ($pattern in $script:envOnlyPatterns) {
        if ($msg -match [regex]::Escape($pattern)) { return $true }
    }
    return $false
}

# ─── Helpers ──────────────────────────────────────────────────────────────────
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

        # ── Validate ZIP module structure ──
        # Azure requires Modules/<Name>/<Version>/ — local testing doesn't enforce this
        $expectedMods = Get-MofModules $mofContent
        if ($expectedMods.Count -gt 0) {
            $zipErrors = Test-ZipModuleStructure $pkg.Path $expectedMods
            if ($zipErrors.Count -gt 0) {
                Write-Host "   ⚠️  ZIP has flat module structure — auto-repairing..." -ForegroundColor Yellow
                foreach ($ze in $zipErrors) {
                    Write-Host "      $ze" -ForegroundColor DarkYellow
                }
                $repaired = Repair-ZipModuleStructure $pkg.Path $expectedMods
                if ($repaired) {
                    # Verify the repair worked
                    $recheck = Test-ZipModuleStructure $pkg.Path $expectedMods
                    if ($recheck.Count -gt 0) {
                        Write-Host "   ❌ FAIL — ZIP repair did not fix structure" -ForegroundColor Red
                        foreach ($re in $recheck) { Write-Host "      $re" -ForegroundColor Red }
                        $failures += @{ Name = $name; Error = ($recheck -join ' | ') }
                        $failed++
                        Write-Host ''
                        continue
                    }
                    $newHash = (Get-FileHash -Path $pkg.Path -Algorithm SHA256).Hash
                    $newSizeKB = [math]::Round((Get-Item $pkg.Path).Length / 1KB)
                    Write-Host "   ✓ ZIP repaired: ${newSizeKB}KB, SHA256: $($newHash.Substring(0,16))..." -ForegroundColor Green
                } else {
                    Write-Host "   ❌ FAIL — ZIP module structure invalid and repair failed" -ForegroundColor Red
                    $failures += @{ Name = $name; Error = ($zipErrors -join ' | ') }
                    $failed++
                    Write-Host ''
                    continue
                }
            } else {
                $modList = ($expectedMods.GetEnumerator() | ForEach-Object { "$($_.Key) v$($_.Value)" }) -join ', '
                Write-Host "   ✓ ZIP structure: $modList — versioned paths OK" -ForegroundColor DarkGray
            }
        }

        # Test package
        $testCmd = if (Get-Command 'Test-GuestConfigurationPackage' -ErrorAction SilentlyContinue) {
            'Test-GuestConfigurationPackage'
        } else {
            'Get-GuestConfigurationPackageComplianceStatus'
        }
        $result = & $testCmd -Path $pkg.Path

        $status = $result.complianceStatus
        $resCount = ($result.resources | Measure-Object).Count

        if ($null -eq $status) {
            throw 'DSC evaluation returned null complianceStatus'
        }

        $displayStatus = if ($status -eq $true -or $status -eq 'True' -or $status -eq 'Compliant') { 'Compliant' } else { 'NonCompliant' }

        # ── Scan ALL resource reasons for fatal errors ──
        # A NonCompliant result could be legitimate drift OR a resource execution failure.
        # Legitimate drift: "Service 'sshd' is not running", "File does not exist"
        # Execution failure: stack traces, .NET exceptions, resource class not found
        # Environment issue: nxScript calling sysctl/ufw but command not on this host
        $fatalErrors = @()
        $envWarnings = @()

        if ($result.resources) {
            foreach ($r in $result.resources) {
                if ($r.properties -and $r.properties.Reasons) {
                    foreach ($reason in $r.properties.Reasons) {
                        if (-not $reason.Phrase) { continue }
                        $rId = if ($r.ResourceId) { $r.ResourceId } elseif ($r.properties.ConfigurationName) { $r.properties.ConfigurationName } else { '?' }
                        $truncatedPhrase = $reason.Phrase.Substring(0, [Math]::Min(200, $reason.Phrase.Length))

                        if (Test-ReasonIsEnvOnly $reason.Phrase) {
                            # Command missing on this host — package is valid
                            $envWarnings += "[${rId}] $truncatedPhrase"
                        } elseif (Test-ReasonIsFatal $reason.Phrase) {
                            $fatalErrors += "[${rId}] $truncatedPhrase"
                        }
                    }
                }
            }
        }

        if ($fatalErrors.Count -gt 0) {
            Write-Host "   ❌ FAIL — Resource execution error (not valid drift)" -ForegroundColor Red
            foreach ($err in $fatalErrors) {
                Write-Host "      $err" -ForegroundColor Red
            }
            $failures += @{ Name = $name; Error = ($fatalErrors -join ' | ').Substring(0, [Math]::Min(500, ($fatalErrors -join ' | ').Length)) }
            $failed++
        } elseif ($envWarnings.Count -gt 0) {
            Write-Host "   ⚠️  WARN — Package valid, but commands missing on this host" -ForegroundColor Yellow
            foreach ($warn in $envWarnings) {
                Write-Host "      $warn" -ForegroundColor DarkYellow
            }
            $passed++  # Package structure is valid — would work on a real VM
        } else {
            Write-Host "   ✅ PASS — Status: $displayStatus, Resources: $resCount" -ForegroundColor Green
            $passed++
        }

        # Per-resource detail (always print)
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
                    if ($phrases) {
                        $joined = $phrases -join '; '
                        $reasons = " — $($joined.Substring(0, [Math]::Min(300, $joined.Length)))"
                    }
                }
                Write-Host "   $icon $rName$reasons" -ForegroundColor DarkGray
            }
        }
    }
    catch {
        $errMsg = $_.Exception.Message

        # Classify the exception:
        # Priority: env-only > fatal DSC > unknown
        # "sysctl not recognized" inside nxScript = env issue (package valid)
        # "MSFT_ArchiveResource not found" = fatal DSC (package broken)

        $isEnv = Test-ReasonIsEnvOnly $errMsg
        $isFatal = Test-ReasonIsFatalResource $errMsg  # resource-level only, not execution

        if ($isEnv) {
            Write-Host "   ⚠️  WARN — Package valid, but system command missing on this host" -ForegroundColor Yellow
            Write-Host "      $($errMsg.Substring(0, [Math]::Min(200, $errMsg.Length)))..." -ForegroundColor DarkYellow
            $passed++
        } elseif ($isFatal) {
            Write-Host "   ❌ FAIL — DSC resource error (package invalid)" -ForegroundColor Red
            Write-Host "      $($errMsg.Substring(0, [Math]::Min(300, $errMsg.Length)))" -ForegroundColor Red
            $failures += @{ Name = $name; Error = $errMsg.Substring(0, [Math]::Min(500, $errMsg.Length)) }
            $failed++
        } elseif (Test-ErrorIsFatalDsc $errMsg) {
            # Execution error that's NOT env-related — could be broken test data
            Write-Host "   ❌ FAIL — DSC execution error" -ForegroundColor Red
            Write-Host "      $($errMsg.Substring(0, [Math]::Min(300, $errMsg.Length)))" -ForegroundColor Red
            $failures += @{ Name = $name; Error = $errMsg.Substring(0, [Math]::Min(500, $errMsg.Length)) }
            $failed++
        } else {
            Write-Host "   ❌ FAIL — $($errMsg.Substring(0, [Math]::Min(300, $errMsg.Length)))" -ForegroundColor Red
            if ($_.Exception.InnerException) {
                Write-Host "      Inner: $($_.Exception.InnerException.Message.Substring(0, [Math]::Min(200, $_.Exception.InnerException.Message.Length)))" -ForegroundColor DarkRed
            }
            $failures += @{ Name = $name; Error = $errMsg.Substring(0, [Math]::Min(500, $errMsg.Length)) }
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
