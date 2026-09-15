#Requires -Version 7.2
[CmdletBinding()]
param(
    [Parameter(Mandatory)][Alias('OfficialProjectPath')][string]$ProjectPath,
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
& (Join-Path $PSScriptRoot 'scripts/deploy.ps1') @PSBoundParameters
