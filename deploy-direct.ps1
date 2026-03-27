# deploy-direct.ps1 — Directly assign a GC package to a VM (bypasses Azure Policy)
# For debugging/testing only — results won't show in Policy compliance views
#
# Usage:
#   .\deploy-direct.ps1 -PackagePath .\output\MyConfig.zip -ResourceGroupName 'MyRG' -VMName 'MyVM'
#
# What this does:
#   1. Connects to Azure (or uses existing context)
#   2. Uploads the ZIP to blob storage + generates SAS URL
#   3. Creates a GC assignment directly on the VM (no policy involved)
#   4. The GC agent picks it up within minutes and evaluates immediately

#Requires -Version 7.0
#Requires -Modules Az.Accounts, Az.Storage, GuestConfiguration

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$PackagePath,

    [Parameter(Mandatory)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory)]
    [string]$VMName,

    [string]$SubscriptionId,

    [string]$StorageAccountName,

    [string]$StorageResourceGroup,

    [string]$ContainerName = 'guestconfiguration',

    [string]$Location = 'uksouth',

    [ValidateSet('Audit', 'AuditAndSet')]
    [string]$Mode = 'Audit',

    [switch]$SkipLogin,

    [switch]$SkipUpload,

    [string]$ContentUri
)

$ErrorActionPreference = 'Stop'

# ─── Validate ─────────────────────────────────────────────────────────────────

if (-not (Test-Path $PackagePath)) {
    Write-Error "Package not found: $PackagePath"
    exit 1
}

if (-not $SkipUpload -and -not $ContentUri -and -not $StorageAccountName) {
    # Will auto-create storage
}

if ($SkipUpload -and -not $ContentUri) {
    Write-Error "-ContentUri is required when using -SkipUpload"
    exit 1
}

$packageFile = Get-Item $PackagePath
$configName = $packageFile.BaseName
$hash = (Get-FileHash -Path $PackagePath -Algorithm SHA256).Hash

Write-Host ''
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  GC Direct Assignment — Debug/Test                          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "  Package:  $configName" -ForegroundColor Gray
Write-Host "  Mode:     $Mode" -ForegroundColor Gray
Write-Host "  VM:       $VMName ($ResourceGroupName)" -ForegroundColor Gray
Write-Host "  Hash:     $($hash.Substring(0,16))..." -ForegroundColor Gray
Write-Host ''

# ─── Azure Login ──────────────────────────────────────────────────────────────

if (-not $SkipLogin) {
    $context = Get-AzContext -ErrorAction SilentlyContinue
    if (-not $context) {
        Write-Host '🔑 Connecting to Azure...' -ForegroundColor Cyan
        Connect-AzAccount
    } else {
        Write-Host "🔑 Using existing context: $($context.Account.Id)" -ForegroundColor Gray
    }
}

if ($SubscriptionId) {
    Set-AzContext -SubscriptionId $SubscriptionId | Out-Null
}

$context = Get-AzContext
$subId = $context.Subscription.Id
Write-Host "   Subscription: $($context.Subscription.Name)" -ForegroundColor Gray
Write-Host ''

# ─── Upload (unless skipped) ─────────────────────────────────────────────────

if (-not $SkipUpload) {
    $storageRg = if ($StorageResourceGroup) { $StorageResourceGroup } else { $ResourceGroupName }

    if (-not $StorageAccountName) {
        $StorageAccountName = "mcpkgs$($subId.Substring(0,8).ToLower() -replace '[^a-z0-9]','')"
        if ($StorageAccountName.Length -gt 24) { $StorageAccountName = $StorageAccountName.Substring(0, 24) }
    }

    Write-Host '📦 Setting up storage...' -ForegroundColor Cyan

    $storage = Get-AzStorageAccount -ResourceGroupName $storageRg -Name $StorageAccountName -ErrorAction SilentlyContinue
    if (-not $storage) {
        Write-Host "   Creating storage account: $StorageAccountName" -ForegroundColor Gray
        $storage = New-AzStorageAccount `
            -ResourceGroupName $storageRg `
            -Name $StorageAccountName `
            -Location $Location `
            -SkuName Standard_LRS `
            -Kind StorageV2 `
            -AllowBlobPublicAccess $false
    } else {
        Write-Host "   Using existing storage: $StorageAccountName" -ForegroundColor Gray
    }

    $storageCtx = $storage.Context

    $container = Get-AzStorageContainer -Name $ContainerName -Context $storageCtx -ErrorAction SilentlyContinue
    if (-not $container) {
        New-AzStorageContainer -Name $ContainerName -Context $storageCtx -Permission Off | Out-Null
    }

    $blobName = "$configName.zip"
    Write-Host "   Uploading $blobName..." -ForegroundColor Gray
    Set-AzStorageBlobContent -File $PackagePath -Container $ContainerName -Blob $blobName -Context $storageCtx -Force | Out-Null

    $ContentUri = New-AzStorageBlobSASToken `
        -Container $ContainerName `
        -Blob $blobName `
        -Permission r `
        -ExpiryTime (Get-Date).AddYears(3) `
        -Context $storageCtx `
        -FullUri

    Write-Host "   ✅ Uploaded" -ForegroundColor Green
    Write-Host ''
}

# ─── Create GC Assignment directly on VM ──────────────────────────────────────

Write-Host '🎯 Creating GC assignment on VM...' -ForegroundColor Cyan

$assignmentType = if ($Mode -eq 'AuditAndSet') { 'ApplyAndAutoCorrect' } else { 'Audit' }

$gcParams = @{
    Name              = $configName
    ResourceGroupName = $ResourceGroupName
    VMName            = $VMName
    ContentUri        = $ContentUri
    ContentHash       = $hash
    AssignmentType    = $assignmentType
    Version           = '1.0.0'
}

$assignment = New-GuestConfigurationAssignment @gcParams

Write-Host "   ✅ Assignment created: $configName" -ForegroundColor Green
Write-Host "   Status: $($assignment.Properties.LatestAssignmentReport.Assignment.ComplianceStatus)" -ForegroundColor Gray
Write-Host ''

# ─── Wait and poll ────────────────────────────────────────────────────────────

Write-Host '⏱  Polling compliance (GC agent evaluates every ~5 min)...' -ForegroundColor Cyan
Write-Host '   Press Ctrl+C to stop waiting' -ForegroundColor Gray
Write-Host ''

$maxAttempts = 12  # 12 x 30s = 6 minutes
for ($i = 1; $i -le $maxAttempts; $i++) {
    Start-Sleep -Seconds 30
    try {
        $report = Get-GuestConfigurationAssignmentReport -Name $configName -ResourceGroupName $ResourceGroupName -VMName $VMName -Latest
        $status = $report.Properties.ComplianceStatus
        Write-Host "   [$i/$maxAttempts] Status: $status" -ForegroundColor $(if ($status -eq 'Compliant') { 'Green' } elseif ($status -eq 'NonCompliant') { 'Yellow' } else { 'Gray' })

        if ($status -eq 'Compliant' -or $status -eq 'NonCompliant') {
            Write-Host ''
            Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor $(if ($status -eq 'Compliant') { 'Green' } else { 'Yellow' })
            Write-Host "║  Result: $status                                       ║" -ForegroundColor $(if ($status -eq 'Compliant') { 'Green' } else { 'Yellow' })
            Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor $(if ($status -eq 'Compliant') { 'Green' } else { 'Yellow' })

            if ($report.Properties.Resources) {
                Write-Host ''
                Write-Host '  Resources:' -ForegroundColor White
                foreach ($r in $report.Properties.Resources) {
                    $icon = if ($r.ComplianceStatus -eq 'Compliant') { '✅' } else { '❌' }
                    $reasons = if ($r.Reasons) { " — $($r.Reasons.Phrase -join '; ')" } else { '' }
                    Write-Host "    $icon $($r.ResourceId)$reasons"
                }
            }
            Write-Host ''
            break
        }
    } catch {
        Write-Host "   [$i/$maxAttempts] Waiting... ($($_.Exception.Message))" -ForegroundColor Gray
    }
}

if ($i -gt $maxAttempts) {
    Write-Host '   ⏰ Timed out — check manually:' -ForegroundColor Yellow
    Write-Host "   Get-GuestConfigurationAssignmentReport -Name '$configName' -ResourceGroupName '$ResourceGroupName' -VMName '$VMName' -Latest" -ForegroundColor Gray
    Write-Host ''
}

Write-Host '🧹 To remove this assignment:' -ForegroundColor Gray
Write-Host "   Remove-GuestConfigurationAssignment -Name '$configName' -ResourceGroupName '$ResourceGroupName' -VMName '$VMName'" -ForegroundColor Gray
Write-Host ''
