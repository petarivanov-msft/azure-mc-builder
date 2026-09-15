#Requires -Version 7.2
param([Parameter(Mandatory)][string]$ProjectPath)
$ErrorActionPreference = 'Stop'
$module = Import-Module (Join-Path $ProjectPath 'McBuilder.psm1') -PassThru -Force
& $module {
    param($root)
    function Assert($value, $message) { if (-not $value) { throw $message } }
    function Throws([scriptblock]$action, $pattern) {
        $caught = $null
        try { & $action | Out-Null } catch { $caught = $_ }
        Assert ($null -ne $caught -and $caught.Exception.Message -match $pattern) "Expected '$pattern'; received '$caught'"
    }
    $project = Read-McProject $root
    $null = New-Item -ItemType Directory -Path $project.Output -Force
    $package = Join-Path $project.Output "$($project.Release).zip"
    Set-Content -LiteralPath $package 'unit test bytes'
    $hash = (Get-FileHash -LiteralPath $package -Algorithm SHA256).Hash
    $build = @{ schemaVersion = 1; packageFile = "$($project.Release).zip"; packageHash = $hash; fingerprints = Get-McFingerprints $project }
    Write-McJson (Join-Path $project.Output 'build.json') $build
    $receipt = @{ schemaVersion = 1; status = 'Validated'; packageHash = $hash; platform = $project.Config.platform;
        guestConfiguration = $project.Lock.guestConfiguration; remediationVerified = $false }
    Write-McJson (Join-Path $project.Output 'validation.json') $receipt
    $null = Assert-McBuild $project -RequireValidation
    $receipt.packageHash = 'wrong'
    Write-McJson (Join-Path $project.Output 'validation.json') $receipt
    Throws { Assert-McBuild $project -RequireValidation } 'validation'
    $receipt.packageHash = $hash
    Write-McJson (Join-Path $project.Output 'validation.json') $receipt
    Add-Content -LiteralPath $package 'changed'
    Throws { Assert-McBuild $project } 'bytes changed'
    Set-Content -LiteralPath $package 'unit test bytes'
    $source = Get-Content -LiteralPath (Join-Path $root 'Configuration.ps1') -Raw
    Add-Content -LiteralPath (Join-Path $root 'Configuration.ps1') '# change'
    Throws { Assert-McBuild $project } 'Stale build'
    [IO.File]::WriteAllText((Join-Path $root 'Configuration.ps1'), $source)
    $build.fingerprints = Get-McFingerprints $project
    Write-McJson (Join-Path $project.Output 'build.json') $build
    $evaluation = @{ complianceStatus = $false; resources = @(@{ complianceStatus = $false; reasons = @(@{ code = 'ExpectedDrift'; phrase = 'Marker absent' }) }) }
    $result = Assert-McEvaluation $evaluation 1
    Assert ($result.complianceStatus -eq $false) 'Expected drift should not be an execution failure'
    Throws { Assert-McEvaluation $null 1 } 'no result'
    Throws { Assert-McEvaluation @{ complianceStatus = 'Unknown'; resources = @() } 1 } 'invalid'
    Throws { Assert-McEvaluation @{ complianceStatus = $false; resources = @() } 1 } 'resources'
    Throws { Assert-McEvaluation @{ complianceStatus = $false; resources = @(@{ complianceStatus = $null }) } 1 } 'invalid'
    Throws { Assert-McEvaluation @{ complianceStatus = $false; error = 'Execution failed'; resources = @() } 1 } 'execution error'
    $evaluation.resources[0].reasons[0].code = 'GetConfigurationException'
    Throws { Assert-McEvaluation $evaluation 1 } 'evaluation failed'
    Throws { Test-McPackage -ProjectPath $root } 'AcknowledgeExecution'
    Throws { Test-McPackage -ProjectPath $root -AcknowledgeExecution -Remediate } 'DisposableEnvironment'

    function script:Initialize-McTools { param($Project, [switch]$RestoreTools, [switch]$Azure) @{ Cache = $Project.Root } }
    function script:New-GuestConfigurationPolicy {
        param($PolicyId,$PolicyVersion,$ContentVersion,$ContentUri,$DisplayName,$Description,$Platform,$Mode,$Path,
            [bool]$IncludeVMSS,[switch]$ExcludeArcMachines,[switch]$UseSystemAssignedIdentity,$LocalContentPath)
        Assert (-not $IncludeVMSS) 'VMSS must remain excluded'
        Assert (-not $PSBoundParameters.ContainsKey('LocalContentPath')) 'SAS mode must not pass LocalContentPath'
        Assert ($Mode -eq 'Audit') 'Mode mapping'
        $null = New-Item -ItemType Directory -Path $Path -Force
        $file = Join-Path $Path 'official-generated.json'
        $bytes = Get-FileHash -LiteralPath (Join-Path (Split-Path $Path) 'OfficialTest_v1_2_3.zip') -Algorithm SHA256
        Write-McJson $file @{ properties = @{ metadata = @{ guestConfiguration = @{ contentHash = $bytes.Hash } } } }
        @{ Path = $file }
    }
    $policy = New-McPolicy -ProjectPath $root -ContentUri 'https://example.invalid/package.zip'
    Assert ($policy.Path.EndsWith('official-generated.json')) 'Must consume actual cmdlet output path'
    function script:Disable-AzContextAutosave { param($Scope) }
    function script:Get-AzContext { @{ Tenant = @{ Id = 'wrong' }; Subscription = @{ Id = 'wrong' } } }
    Throws { Publish-McPackage -ProjectPath $root -TenantId '00000000-0000-0000-0000-000000000001' -SubscriptionId '00000000-0000-0000-0000-000000000002' -StorageAccountName 'test' -SkipLogin } 'context does not match'
    Write-Output 'Official runtime contract checks passed'
} $ProjectPath
