#Requires -Version 7.2
[CmdletBinding()]
param(
    [string]$ProjectPath = $PSScriptRoot,
    [switch]$AcknowledgeExecution,
    [switch]$Remediate,
    [switch]$DisposableEnvironment,
    [switch]$RestoreTools
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'McBuilder.psm1') -Force
$PSBoundParameters.ProjectPath = $ProjectPath
Test-McPackage @PSBoundParameters
