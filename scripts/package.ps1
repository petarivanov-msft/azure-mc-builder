#Requires -Version 7.2
[CmdletBinding()]
param([string]$ProjectPath = $PSScriptRoot, [switch]$RestoreTools)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'McBuilder.psm1') -Force
Build-McPackage -ProjectPath $ProjectPath -RestoreTools:$RestoreTools
