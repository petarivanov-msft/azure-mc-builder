#Requires -Version 7.0
param([Parameter(Mandatory)][string]$InputDir)
$ErrorActionPreference = 'Stop'

function Assert([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "Assertion failed: $Message" }
}

function Assert-Throws([scriptblock]$Action, [string]$Pattern) {
    $caught = $null
    try { & $Action | Out-Null } catch { $caught = $_ }
    Assert ($null -ne $caught) "Expected error matching '$Pattern'"
    Assert ($caught.Exception.Message -match $Pattern) "Unexpected error: $caught"
}

# Prevent autoload of real Azure/GuestConfiguration modules. No network or Azure
# operations are possible in this process; every side-effecting command is mocked.
$mockModules = Join-Path $InputDir 'mock-modules'
foreach ($name in @('Az.Accounts', 'Az.Storage', 'Az.Resources', 'GuestConfiguration', 'PSDscResources')) {
    $dir = New-Item -ItemType Directory -Path (Join-Path $mockModules $name) -Force
    Set-Content (Join-Path $dir "$name.psm1") '# isolated test module'
    New-ModuleManifest -Path (Join-Path $dir "$name.psd1") -RootModule "$name.psm1" -ModuleVersion '2.12.0.0'
}
$env:PSModulePath = "$mockModules$([IO.Path]::PathSeparator)$(Join-Path $PSHOME 'Modules')"

$global:mcTest = @{
    keyCalls = 0
    accountCalls = 0
    policyCalls = 0
    denyStorage = $false
    failPolicy = $false
    sharedKeyAllowed = $true
    flatPackage = $true
    fakeUri = 'https://example.blob.core.windows.net/guestconfiguration/test.zip?sig=test%2B%2F%3D&literal=$&$1\quoted"&se=test'
}

function Get-AzContext {
    [pscustomobject]@{
        Account = @{ Id = 'test' }
        Subscription = @{ Id = '00000000-0000-0000-0000-000000000000'; Name = 'Mock' }
        Environment = @{ Name = 'AzureCloud' }
    }
}
function Connect-AzAccount { throw 'Unexpected login' }
function Set-AzContext { param($SubscriptionId) Get-AzContext }
function Get-AzStorageAccount {
    [CmdletBinding()] param($ResourceGroupName)
    $global:mcTest.accountCalls++
    [pscustomobject]@{ StorageAccountName = 'testaccount'; ResourceGroupName = 'test-rg'; AllowSharedKeyAccess = $global:mcTest.sharedKeyAllowed }
}
function Get-AzStorageAccountKey {
    [CmdletBinding()] param($ResourceGroupName, $Name)
    $global:mcTest.keyCalls++
    @([pscustomobject]@{ Value = 'mock-key' })
}
function New-AzStorageContext {
    [CmdletBinding()] param($StorageAccountName, [switch]$UseConnectedAccount, $StorageAccountKey, $Environment)
    Assert ($Environment -eq 'AzureCloud') 'Cloud environment must be explicit'
    Assert ($UseConnectedAccount -or $StorageAccountKey -eq 'mock-key') 'Explicit auth mode required'
    [pscustomobject]@{ OAuth = [bool]$UseConnectedAccount }
}
function Get-AzStorageContainer {
    [CmdletBinding()] param($Context)
    if ($global:mcTest.denyStorage) { throw 'Mock RBAC denial' }
    [pscustomobject]@{ Name = 'guestconfiguration' }
}
function New-AzStorageContainer { throw 'Unexpected container creation' }
function New-AzStorageAccount { throw 'Unexpected account creation' }
function New-AzResourceGroup { throw 'Unexpected resource group creation' }
function Set-AzStorageBlobContent {
    [CmdletBinding()] param($File, $Container, $Blob, $Context, [switch]$Force)
    Assert (Test-Path -LiteralPath $File) 'Must upload an existing exact package'
    $global:mcTest.uploadedHash = (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash
    Assert ($Blob -eq "ScriptRegression-$($global:mcTest.uploadedHash.Substring(0,8).ToLower()).zip") 'Content-addressed blob name'
}
function New-AzStorageBlobSASToken {
    [CmdletBinding()] param($Container, $Blob, $Permission, $Protocol, [datetime]$StartTime, [datetime]$ExpiryTime, $Context, [switch]$FullUri)
    Assert ($Permission -eq 'r' -and $Protocol -eq 'HttpsOnly' -and $FullUri) 'Read-only HTTPS SAS with full URI'
    if ($Context.OAuth) {
        Assert (($ExpiryTime - $StartTime).TotalDays -lt 7) 'User delegation key lifetime limit'
    } else {
        Assert (($ExpiryTime - $StartTime).TotalDays -gt 1000) 'Explicit long-lived Shared Key opt-in'
    }
    $global:mcTest.fakeUri
}
function Remove-AzPolicyDefinition { throw 'Definitions must never be deleted' }
function New-AzPolicyDefinition {
    [CmdletBinding()] param($Name, $DisplayName, $Policy, $Mode, $SubscriptionId)
    $global:mcTest.policyCalls++
    if ($global:mcTest.failPolicy) { throw 'Mock policy write failure' }
    Assert ($Policy.TrimStart().StartsWith('{')) 'Policy must be JSON in memory, not a shared temporary path'
    $document = $Policy | ConvertFrom-Json
    $gc = $document.properties.metadata.guestConfiguration
    Assert ($gc.contentUri -ceq $global:mcTest.fakeUri) 'URI replacement must be literal and JSON-safe'
    Assert ($gc.contentHash -ceq $global:mcTest.uploadedHash) 'Metadata must use the actual uploaded package hash'
    Assert ($document.properties.metadata.version -eq '2.3.4') 'Policy release version'
    Assert ($gc.configurationParameter -is [pscustomobject]) 'Metadata parameter map must remain an object'
    Assert ($Name -eq 'MC-ScriptRegression') 'Stable definition identity for upsert'
    Assert ($SubscriptionId -eq (Get-AzContext).Subscription.Id) 'Explicit subscription for upsert'
    if ($document.properties.policyRule.then.effect -eq 'deployIfNotExists') {
        $deployment = $document.properties.policyRule.then.details.deployment.properties
        Assert ($deployment.parameters.contentUri.value -ceq $global:mcTest.fakeUri) 'DINE URI must update too'
        Assert ($deployment.parameters.contentHash.value -ceq $global:mcTest.uploadedHash) 'DINE hash must update too'
        Assert ($deployment.template.resources.Count -eq 2) 'Only VM/Arc targets'
        foreach ($resource in $deployment.template.resources) {
            Assert ($resource.properties.guestConfiguration.configurationParameter.Count -eq 0) 'No unsolicited property overrides'
        }
    }
    [pscustomobject]@{ Name = $Name; Id = "/subscriptions/$SubscriptionId/providers/Microsoft.Authorization/policyDefinitions/$Name" }
}
function Install-Module { throw 'Unexpected module installation in isolated tests' }
function New-GuestConfigurationPackage {
    [CmdletBinding()] param($Name, $Configuration, $Path, $Type, $Version, [switch]$Force)
    Assert ($Version -eq '2.3.4') 'Package version must not silently fall back to 1.0.0'
    Assert ($Type -eq $global:mcTest.expectedMode) "Package mode must match policy: expected '$($global:mcTest.expectedMode)', got '$Type'"
    $stage = Join-Path $InputDir ([guid]::NewGuid().ToString())
    $null = New-Item -ItemType Directory -Path $stage
    $modulePath = if ($global:mcTest.flatPackage) { 'Modules/PSDscResources' } else { 'Modules/PSDscResources/2.12.0.0' }
    $moduleDir = New-Item -ItemType Directory -Path (Join-Path $stage $modulePath) -Force
    Set-Content (Join-Path $moduleDir 'PSDscResources.psd1') '@{}'
    Copy-Item -LiteralPath $Configuration -Destination (Join-Path $stage "$Name.mof")
    @{ Type = $Type; Version = $Version } | ConvertTo-Json | Set-Content (Join-Path $stage "$Name.metaconfig.json")
    $null = New-Item -ItemType Directory -Path $Path -Force
    $zipPath = Join-Path $Path "$Name.zip"
    if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath }
    [IO.Compression.ZipFile]::CreateFromDirectory($stage, $zipPath)
    Remove-Item -LiteralPath $stage -Recurse -Force
    [pscustomobject]@{ Name = $Name; Path = $zipPath }
}

$rootScript = Join-Path $InputDir 'root-deploy.ps1'
foreach ($mode in @('Audit', 'AuditAndSet')) {
    $global:mcTest.expectedMode = $mode
    $dir = Join-Path $InputDir $mode
    $packageScript = Join-Path $dir 'package.ps1'
    $deployScript = Join-Path $dir 'deploy.ps1'
    foreach ($path in @($rootScript, $packageScript, $deployScript)) {
        $tokens = $null; $parseErrors = $null
        $null = [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$parseErrors)
        Assert ($parseErrors.Count -eq 0) "PowerShell syntax: $($parseErrors.Message -join '; ')"
    }
    foreach ($flat in @($true, $false)) {
        Write-Output "Testing generated package: $mode, flat=$flat"
        $global:mcTest.flatPackage = $flat
        & $packageScript *>&1 | Out-Null
        $zipPath = Join-Path $dir 'output/ScriptRegression.zip'
        $zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
        try {
            Assert ($null -ne $zip.GetEntry('Modules/PSDscResources/2.12.0.0/PSDscResources.psd1')) 'Versioned module paths in final ZIP'
            $reader = [IO.StreamReader]::new($zip.GetEntry('ScriptRegression.metaconfig.json').Open())
            try { $metadata = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
            Assert ($metadata.Type -eq $mode -and $metadata.Version -eq '2.3.4') 'Actual ZIP metadata'
        } finally { $zip.Dispose() }
    }
    $scripts = @(
        @{ Path = $deployScript; Args = @{} },
        @{ Path = $rootScript; Args = @{ PackagePath = $zipPath } },
        @{ Path = $rootScript; Args = @{ ConfigPath = $dir } }
    )
    foreach ($entry in $scripts) {
        $path = $entry.Path
        $extra = $entry.Args
        Write-Output "Testing deploy: $mode, $path, $($extra.Keys -join ',')"
        $global:mcTest.accountCalls = 0; $global:mcTest.keyCalls = 0
        & $path @extra -StorageAccountName testaccount -SkipLogin *>&1 | Out-Null
        & $path @extra -StorageAccountName testaccount -SkipLogin *>&1 | Out-Null
        Assert ($global:mcTest.accountCalls -eq 0 -and $global:mcTest.keyCalls -eq 0) 'RBAC-only existing storage must not read accounts or keys'

        $global:mcTest.denyStorage = $true
        $before = $global:mcTest.policyCalls
        Assert-Throws { & $path @extra -StorageAccountName testaccount -SkipLogin *>&1 } 'Cannot access blob storage'
        Assert ($global:mcTest.keyCalls -eq 0 -and $global:mcTest.policyCalls -eq $before) 'No auth fallback or policy write after access failure'
        $global:mcTest.denyStorage = $false

        $global:mcTest.failPolicy = $true
        Assert-Throws { & $path @extra -StorageAccountName testaccount -SkipLogin *>&1 } 'policy'
        $global:mcTest.failPolicy = $false
        Assert-Throws { & $path @extra -StorageAccountName testaccount -SasExpiryDays 7 -SkipLogin *>&1 } 'delegation'

        & $path @extra -StorageAccountName testaccount -StorageAuthMode SharedKey -SasExpiryDays 1095 -SkipLogin *>&1 | Out-Null
        Assert ($global:mcTest.keyCalls -eq 1) 'Shared Key access must be explicit'
        $global:mcTest.sharedKeyAllowed = $false
        Assert-Throws { & $path @extra -StorageAccountName testaccount -StorageAuthMode SharedKey -SkipLogin *>&1 } 'disables Shared Key'
        Assert ($global:mcTest.keyCalls -eq 1) 'Do not list keys when Shared Key is disabled'
        $global:mcTest.sharedKeyAllowed = $true
    }
    $metadataPath = Join-Path $dir 'ScriptRegression.metaconfig.json'
    @{ Type = $mode; Version = '9.0.0' } | ConvertTo-Json | Set-Content $metadataPath
    Assert-Throws { & $packageScript *>&1 } 'metadata differs'
}
Write-Output 'All script regression checks passed'
