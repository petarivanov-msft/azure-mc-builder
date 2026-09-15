#Requires -Version 7.2
param([Parameter(Mandatory)][string]$CachePath)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'McBuilder.psm1') -Force
Restore-McToolchain -CachePath $CachePath
