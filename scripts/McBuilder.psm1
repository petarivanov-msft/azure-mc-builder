#Requires -Version 7.2
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:RuntimePath = $PSCommandPath

function Write-McJson {
    param([string]$Path, $Value)
    $temp = "$Path.$([guid]::NewGuid()).tmp"
    try {
        $Value | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $temp -Encoding utf8
        Move-Item -LiteralPath $temp -Destination $Path -Force
    } finally {
        if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp }
    }
}

function Read-McProject {
    param([string]$ProjectPath)
    $root = (Resolve-Path -LiteralPath $ProjectPath -ErrorAction Stop).Path
    if ((Get-FileHash -LiteralPath (Join-Path $root 'McBuilder.psm1')).Hash -ne
        (Get-FileHash -LiteralPath $script:RuntimePath).Hash) { throw 'Repository and downloaded runtime versions differ. Use the runtime shipped with this project or re-export and rebuild.' }
    $config = Get-Content -LiteralPath (Join-Path $root 'config.json') -Raw | ConvertFrom-Json -AsHashtable
    $lock = Get-Content -LiteralPath (Join-Path $root 'toolchain.lock.json') -Raw | ConvertFrom-Json -AsHashtable
    if ($config.project.schemaVersion -ne 2 -or $lock.schemaVersion -ne 1) { throw 'Unsupported authoring project/toolchain schema. Re-export the project.' }
    $id = [guid]::Empty
    if (-not [guid]::TryParse($config.project.policyId, [ref]$id)) { throw 'Project policyId must be a persistent GUID.' }
    if ($config.configName -cnotmatch '^[a-zA-Z_][a-zA-Z0-9_]{0,79}$' -or
        $config.version -notmatch '^\d+\.\d+\.\d+$' -or
        $config.platform -cnotin @('Windows', 'Linux') -or
        $config.mode -cnotin @('Audit', 'AuditAndSet') -or
        $config.project.definitionName -notmatch '^[A-Za-z0-9_-]{1,64}$') { throw 'Invalid project name, version, platform, mode or policy identity.' }
    if ($config.resources.Count -eq 0) { throw 'At least one resource is required.' }
    $release = '{0}_v{1}' -f $config.configName, ($config.version -replace '\.', '_')
    [pscustomobject]@{ Root = $root; Config = $config; Lock = $lock; Release = $release; Output = Join-Path $root 'output' }
}

function Initialize-McTools {
    param($Project, [switch]$RestoreTools, [switch]$Azure)
    if (-not $IsWindows -and -not $IsLinux) { throw 'Official authoring supports Windows and Ubuntu, not macOS.' }
    $hostPlatform = if ($IsWindows) { 'Windows' } else { 'Linux' }
    $cache = if ($env:MC_MODULE_CACHE) { $env:MC_MODULE_CACHE } else { Join-Path $Project.Root '.modules' }
    $null = New-Item -ItemType Directory -Path $cache -Force
    $required = [ordered]@{
        PSDesiredStateConfiguration = $Project.Lock.compiler[$hostPlatform]
        GuestConfiguration = $Project.Lock.guestConfiguration
    }
    foreach ($dependency in $Project.Config.dependencies) {
        if ($dependency.name -notmatch '^[A-Za-z][A-Za-z0-9_.-]*$' -or $dependency.version -notmatch '^\d+(\.\d+){1,3}$') {
            throw 'Invalid locked resource dependency.'
        }
        $required[$dependency.name] = $dependency.version
    }
    if ($Azure) { foreach ($name in $Project.Lock.azure.Keys) { $required[$name] = $Project.Lock.azure[$name] } }
    foreach ($name in $required.Keys) {
        $version = $required[$name]
        if ($name -notmatch '^[A-Za-z][A-Za-z0-9_.-]*$' -or $version -notmatch '^\d+(\.\d+){1,3}(-beta1)?$') {
            throw "Invalid toolchain entry: $name"
        }
        $manifest = Join-Path $cache "$name/$($version -replace '-.*$', '')/$name.psd1"
        if (-not (Test-Path -LiteralPath $manifest)) {
            if (-not $RestoreTools) { throw "Missing $name $version in '$cache'. Run package.ps1 -RestoreTools (or deploy.ps1 -RestoreTools for Azure dependencies)." }
            Write-Host "Restoring $name $version from PSGallery into project tool cache..."
            $save = @{ Name = $name; RequiredVersion = $version; Path = $cache; Repository = 'PSGallery'; ErrorAction = 'Stop' }
            if ($version -like '*-*') { $save.AllowPrerelease = $true }
            Save-Module @save
        }
        if (-not (Test-Path -LiteralPath $manifest)) { throw "Restore did not produce the required manifest: $manifest" }
    }
    $env:PSModulePath = "$cache$([IO.Path]::PathSeparator)$env:PSModulePath"
    Import-Module (Join-Path $cache "GuestConfiguration/$($Project.Lock.guestConfiguration)/GuestConfiguration.psd1") -Force
    if ($Azure) {
        foreach ($name in @('Az.Accounts','Az.Storage','Az.Resources')) {
            Import-Module (Join-Path $cache "$name/$($Project.Lock.azure[$name])/$name.psd1") -ErrorAction Stop
        }
    }
    [pscustomobject]@{ Cache = $cache; CompilerVersion = ($required.PSDesiredStateConfiguration -replace '-.*$', '') }
}

function Restore-McToolchain {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$CachePath)
    $lock = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'toolchain.lock.json') -Raw | ConvertFrom-Json -AsHashtable
    $platform = if ($IsWindows) { 'Windows' } else { 'Linux' }
    $dependencies = @($lock.resources[$platform].Keys | ForEach-Object { @{ name = $_; version = $lock.resources[$platform][$_] } })
    $env:MC_MODULE_CACHE = $CachePath
    $null = Initialize-McTools ([pscustomobject]@{ Root = $PSScriptRoot; Lock = $lock; Config = @{ dependencies = $dependencies } }) -RestoreTools
}

function Invoke-McWorker {
    param($Tools, [scriptblock]$Action)
    # GuestConfiguration resets a shared temp directory inside its module installation.
    $lockPath = Join-Path $Tools.Cache '.mc-worker.lock'
    try { $handle = [IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None') }
    catch { throw "Another authoring operation is using '$($Tools.Cache)'. Wait for it to finish. $($_.Exception.Message)" }
    try { & $Action } finally { $handle.Dispose() }
}

function Get-McFingerprints {
    param($Project)
    $hashes = [ordered]@{}
    foreach ($file in @('config.json','Configuration.ps1','toolchain.lock.json','McBuilder.psm1','compile.ps1')) {
        $hashes[$file] = (Get-FileHash -LiteralPath (Join-Path $Project.Root $file) -Algorithm SHA256).Hash
    }
    $hashes
}

function Assert-McArchive {
    param($Project, [string]$Path)
    $zip = [IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $size = ($zip.Entries | Measure-Object -Property Length -Sum).Sum
        if ($size -gt 100MB) { throw 'Uncompressed package exceeds the documented 100 MB limit.' }
        $mofs = @($zip.Entries | Where-Object { $_.FullName -notmatch '[/\\]' -and $_.FullName -like '*.mof' })
        if ($mofs.Count -ne 1 -or $mofs[0].FullName -cne "$($Project.Release).mof") { throw 'Package must contain exactly the compiled release MOF at its root.' }
        $entry = $zip.GetEntry("$($Project.Release).metaconfig.json")
        if ($null -eq $entry) { throw 'Official package metadata is missing.' }
        $reader = [IO.StreamReader]::new($entry.Open())
        try { $meta = $reader.ReadToEnd() | ConvertFrom-Json -AsHashtable } finally { $reader.Dispose() }
        if ($meta.Type -cne $Project.Config.mode -or $meta.Version -cne $Project.Config.version) { throw 'Packaged Type/Version does not match project.' }
        foreach ($dep in $Project.Config.dependencies) {
            $entries = @($zip.Entries | Where-Object { $_.FullName -like "Modules/$($dep.name)/*" })
            if ($entries.Count -eq 0) { throw "Missing dependency in official package: $($dep.name)" }
        }
    } finally { $zip.Dispose() }
}

function Build-McPackage {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$ProjectPath, [switch]$RestoreTools)
    $project = Read-McProject $ProjectPath
    $tools = Initialize-McTools $project -RestoreTools:$RestoreTools
    $null = New-Item -ItemType Directory -Path $project.Output -Force
    foreach ($file in @('build.json','validation.json')) {
        $path = Join-Path $project.Output $file
        if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path }
    }
    Invoke-McWorker $tools {
        $compiled = Join-Path $project.Output "compiled-$([guid]::NewGuid())"
        try {
            & (Join-Path $PSHOME $(if ($IsWindows) { 'pwsh.exe' } else { 'pwsh' })) -NoProfile -NonInteractive -File (Join-Path $project.Root 'compile.ps1') `
                -SourcePath (Join-Path $project.Root 'Configuration.ps1') -ConfigurationName $project.Release `
                -CompilerVersion $tools.CompilerVersion -OutputPath $compiled
            if ($LASTEXITCODE -ne 0) { throw "Official DSC compilation failed (exit $LASTEXITCODE). No fallback MOF was generated." }
            $mofs = @(Get-ChildItem -LiteralPath $compiled -Filter '*.mof' -File)
            if ($mofs.Count -ne 1) { throw 'Compiler must produce exactly one MOF.' }
            $package = New-GuestConfigurationPackage -Name $project.Release -Configuration $mofs[0].FullName `
                -Type $project.Config.mode -Version $project.Config.version -Path $project.Output -Force
            Assert-McArchive $project $package.Path
            $build = [ordered]@{
                schemaVersion = 1; packageFile = "$($project.Release).zip"; packageHash = (Get-FileHash -LiteralPath $package.Path -Algorithm SHA256).Hash
                fingerprints = Get-McFingerprints $project; releaseName = $project.Release; platform = $project.Config.platform
                mode = $project.Config.mode; version = $project.Config.version; builtAt = [datetime]::UtcNow.ToString('o')
                powershell = $PSVersionTable.PSVersion.ToString(); guestConfiguration = $project.Lock.guestConfiguration
            }
            Write-McJson (Join-Path $project.Output 'build.json') $build
            Write-Host 'Official package built. Next: explicitly test it on a trusted, matching-OS test machine before deployment.'
            [pscustomobject]$build
        } finally {
            if (Test-Path -LiteralPath $compiled) { Remove-Item -LiteralPath $compiled -Recurse -Force }
        }
    }
}

function Assert-McBuild {
    param($Project, [switch]$RequireValidation)
    $build = Get-Content -LiteralPath (Join-Path $Project.Output 'build.json') -Raw | ConvertFrom-Json -AsHashtable
    if ($build.schemaVersion -ne 1 -or $build.packageFile -cne "$($Project.Release).zip") { throw 'Invalid build record. Rebuild the project.' }
    $fingerprints = Get-McFingerprints $Project
    foreach ($key in $fingerprints.Keys) {
        if ($build.fingerprints[$key] -cne $fingerprints[$key]) { throw "Stale build: '$key' changed. Rebuild and revalidate." }
    }
    $packagePath = Join-Path $Project.Output $build.packageFile
    if ((Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash -cne $build.packageHash) { throw 'Package bytes changed. Rebuild and revalidate.' }
    if ($RequireValidation) {
        $report = Get-Content -LiteralPath (Join-Path $Project.Output 'validation.json') -Raw | ConvertFrom-Json -AsHashtable
        if ($report.schemaVersion -ne 1 -or $report.status -cne 'Validated' -or $report.packageHash -cne $build.packageHash -or
            $report.platform -cne $Project.Config.platform -or $report.guestConfiguration -cne $Project.Lock.guestConfiguration) {
            throw 'Missing, failed or stale package validation.'
        }
        if ($Project.Config.mode -eq 'AuditAndSet' -and $report.remediationVerified -ne $true) {
            throw 'AuditAndSet requires successful remediation and repeat-evaluation checks on a disposable test host.'
        }
    }
    [pscustomobject]@{ Build = $build; Path = $packagePath }
}

function Assert-McEvaluation {
    param($Result, [int]$ExpectedResources)
    if ($null -eq $Result) { throw 'Evaluation returned no result.' }
    $data = $Result | ConvertTo-Json -Depth 100 | ConvertFrom-Json -AsHashtable
    $allowed = @('True','False','Compliant','NonCompliant')
    if ([string]$data.complianceStatus -notin $allowed) { throw 'Evaluation returned an invalid compliance status.' }
    if ($data['errors'] -or $data['error'] -or $data['status'] -in @('Failed','Error')) { throw 'Package evaluation reported an execution error.' }
    $resources = @($data.resources)
    if ($resources.Count -lt $ExpectedResources) { throw "Evaluation returned $($resources.Count) resources; expected at least $ExpectedResources." }
    foreach ($resource in $resources) {
        if ([string]$resource['complianceStatus'] -notin $allowed -or $resource['errors'] -or $resource['error'] -or $resource['status'] -in @('Failed','Error')) {
            throw 'A resource failed evaluation or returned an invalid compliance status.'
        }
        $propertyReasons = if ($resource['properties']) { $resource['properties']['Reasons'] } else { @() }
        foreach ($reason in @($resource['reasons']) + @($propertyReasons)) {
            if ($null -ne $reason -and [string]$reason['code'] -match '(Exception|ExecutionError|ResourceNotFound|GetConfigurationError)') {
                throw "Resource evaluation failed: $($reason['code'])"
            }
        }
    }
    $data
}

function Test-McPackage {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$ProjectPath, [switch]$AcknowledgeExecution,
        [switch]$Remediate, [switch]$DisposableEnvironment, [switch]$RestoreTools)
    if (-not $AcknowledgeExecution) { throw 'Get/Test executes package code. Review it and pass -AcknowledgeExecution on a trusted test host.' }
    if ($Remediate -and -not $DisposableEnvironment) { throw 'Remediation modifies this machine. Use -DisposableEnvironment only on an explicitly approved disposable host.' }
    $project = Read-McProject $ProjectPath
    $hostPlatform = if ($IsWindows) { 'Windows' } elseif ($IsLinux) { 'Linux' } else { 'Unsupported' }
    if ($hostPlatform -cne $project.Config.platform) { throw "Test this $($project.Config.platform) package on a matching-OS test host." }
    if ($Remediate -and $project.Config.mode -cne 'AuditAndSet') { throw 'Audit packages must not be remediated.' }
    $build = Assert-McBuild $project
    $tools = Initialize-McTools $project -RestoreTools:$RestoreTools
    $receipt = Join-Path $project.Output 'validation.json'
    if (Test-Path -LiteralPath $receipt) { Remove-Item -LiteralPath $receipt }
    Invoke-McWorker $tools {
        try {
            $results = @()
            $result = Get-GuestConfigurationPackageComplianceStatus -Path $build.Path
            $results += Assert-McEvaluation $result $project.Config.resources.Count
            if ($Remediate) {
                foreach ($iteration in 1..2) {
                    Start-GuestConfigurationPackageRemediation -Path $build.Path | Out-Null
                    $after = Assert-McEvaluation (Get-GuestConfigurationPackageComplianceStatus -Path $build.Path) $project.Config.resources.Count
                    if ([string]$after.complianceStatus -notin @('True','Compliant')) { throw "Remediation iteration $iteration did not converge." }
                    $results += $after
                }
            }
            $report = @{ schemaVersion = 1; status = 'Validated'; packageHash = $build.Build.packageHash
                platform = $hostPlatform; guestConfiguration = $project.Lock.guestConfiguration
                remediationVerified = [bool]$Remediate; evaluatedAt = [datetime]::UtcNow.ToString('o'); evaluations = $results }
            Write-McJson $receipt $report
            [pscustomobject]$report
        } catch {
            Write-McJson $receipt @{ schemaVersion = 1; status = 'Failed'; packageHash = $build.Build.packageHash; error = $_.Exception.Message }
            throw
        }
    }
}

function New-McPolicy {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$ProjectPath, [Parameter(Mandatory)][uri]$ContentUri,
        [switch]$UseSystemAssignedIdentity, [switch]$RestoreTools)
    if ($ContentUri.Scheme -cne 'https' -and -not ($ContentUri.IsLoopback -and $ContentUri.Scheme -eq 'http')) { throw 'Package URI must use HTTPS (HTTP is allowed only for loopback tests).' }
    $project = Read-McProject $ProjectPath
    $build = Assert-McBuild $project -RequireValidation
    $tools = Initialize-McTools $project -RestoreTools:$RestoreTools
    Invoke-McWorker $tools {
        $parameters = @{
            PolicyId = $project.Config.project.policyId; PolicyVersion = $project.Config.version
            ContentVersion = $project.Config.version; ContentUri = $ContentUri
            DisplayName = "Machine Configuration: $($project.Config.configName)"
            Description = $(if ($project.Config.description) { $project.Config.description } else { "Machine Configuration: $($project.Config.configName)" })
            Platform = $project.Config.platform; Mode = $(if ($project.Config.mode -eq 'Audit') { 'Audit' } else { 'ApplyAndAutoCorrect' })
            Path = Join-Path $project.Output 'policies'; IncludeVMSS = $false
        }
        if (-not $project.Config.project.includeArc) { $parameters.ExcludeArcMachines = $true }
        if ($UseSystemAssignedIdentity) { $parameters.UseSystemAssignedIdentity = $true; $parameters.LocalContentPath = $build.Path }
        $policy = New-GuestConfigurationPolicy @parameters
        $document = Get-Content -LiteralPath $policy.Path -Raw | ConvertFrom-Json -AsHashtable
        if ($document.properties.metadata.guestConfiguration.contentHash -cne $build.Build.packageHash) {
            throw 'Official policy hash differs from the validated package. No policy was published.'
        }
        [pscustomobject]@{ Path = $policy.Path; PolicyId = $project.Config.project.policyId; DefinitionName = $project.Config.project.definitionName }
    }
}

function Publish-McPackage {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$ProjectPath, [Parameter(Mandatory)][guid]$TenantId,
        [Parameter(Mandatory)][guid]$SubscriptionId, [Parameter(Mandatory)][string]$StorageAccountName,
        [string]$ContainerName = 'guestconfiguration', [ValidateRange(1,6)][int]$SasExpiryDays = 6,
        [switch]$SkipLogin, [switch]$RestoreTools, [switch]$AllowReleaseUpgrade)
    $project = Read-McProject $ProjectPath
    $build = Assert-McBuild $project -RequireValidation
    $null = Initialize-McTools $project -RestoreTools:$RestoreTools -Azure
    Disable-AzContextAutosave -Scope Process | Out-Null
    if (-not $SkipLogin) { Connect-AzAccount -Tenant $TenantId -Subscription $SubscriptionId -Scope Process | Out-Null }
    $context = Get-AzContext
    if ($null -eq $context -or $context.Tenant.Id -ne $TenantId.ToString() -or $context.Subscription.Id -ne $SubscriptionId.ToString()) {
        throw 'Azure context does not match the explicitly requested tenant/subscription. No Azure writes were performed.'
    }
    $existing = Get-AzPolicyDefinition -SubscriptionId $SubscriptionId -Custom |
        Where-Object { $_.Name -eq $project.Config.project.definitionName }
    if ($existing) {
        $metadata = $existing.Metadata
        if ($metadata.guestConfiguration -and $metadata.guestConfiguration.name -ne $project.Release -and -not $AllowReleaseUpgrade) {
            throw 'This changes the guest assignment release name. Review and retire old corrective assignments before using -AllowReleaseUpgrade. The definition was not changed.'
        }
    }
    $storage = New-AzStorageContext -StorageAccountName $StorageAccountName -UseConnectedAccount -Environment $context.Environment.Name
    $containers = @(Get-AzStorageContainer -Context $storage)
    if (-not ($containers | Where-Object Name -EQ $ContainerName)) {
        New-AzStorageContainer -Name $ContainerName -Context $storage -Permission Off | Out-Null
    }
    $blobName = "$($project.Release)-$($build.Build.packageHash.ToLower()).zip"
    Set-AzStorageBlobContent -File $build.Path -Container $ContainerName -Blob $blobName -Context $storage -Force | Out-Null
    $expiry = [datetime]::UtcNow.AddDays($SasExpiryDays)
    $uri = New-AzStorageBlobSASToken -Container $ContainerName -Blob $blobName -Context $storage `
        -Permission r -Protocol HttpsOnly -StartTime ([datetime]::UtcNow.AddMinutes(-5)) -ExpiryTime $expiry -FullUri
    $policy = New-McPolicy -ProjectPath $project.Root -ContentUri $uri
    $definition = New-AzPolicyDefinition -Name $project.Config.project.definitionName `
        -SubscriptionId $SubscriptionId -Policy (Get-Content -LiteralPath $policy.Path -Raw)
    $deployment = @{ schemaVersion = 1; tenantId = $TenantId; subscriptionId = $SubscriptionId
        definitionId = $definition.Id; blobName = $blobName; storageAccount = $StorageAccountName; container = $ContainerName
        packageHash = $build.Build.packageHash; releaseName = $project.Release; sasExpiresAt = $expiry.ToString('o') }
    Write-McJson (Join-Path $project.Output 'deployment.json') $deployment
    Write-Warning "SAS expires $($expiry.ToString('u')). Renew by redeploying the same validated package before expiry."
    Write-Host 'Definition published. No policy assignment or remediation was started. Follow the README for the explicit next step.'
    [pscustomobject]$deployment
}

Export-ModuleMember -Function Build-McPackage, Test-McPackage, New-McPolicy, Publish-McPackage, Restore-McToolchain
