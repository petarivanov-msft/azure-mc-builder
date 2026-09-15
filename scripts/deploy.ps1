#Requires -Version 7.2
[CmdletBinding()]
param(
    [string]$ProjectPath = $PSScriptRoot,
    [Parameter(Mandatory)][string]$TenantId,
    [Parameter(Mandatory)][string]$SubscriptionId,
    [Parameter(Mandatory)][string]$StorageAccountName,
    [string]$ContainerName = 'guestconfiguration',
    [ValidateRange(1,6)][int]$SasExpiryDays = 6,
    [switch]$SkipLogin,
    [switch]$UseAzureCli,
    [switch]$RestoreTools,
    [switch]$AllowReleaseUpgrade
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'McBuilder.psm1') -Force
$PSBoundParameters.ProjectPath = $ProjectPath
Publish-McPackage @PSBoundParameters
