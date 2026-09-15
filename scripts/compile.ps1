#Requires -Version 7.2
param(
    [Parameter(Mandatory)][string]$SourcePath,
    [Parameter(Mandatory)][string]$ConfigurationName,
    [Parameter(Mandatory)][string]$OutputPath,
    [Parameter(Mandatory)][string]$CompilerVersion
)
$ErrorActionPreference = 'Stop'
Import-Module PSDesiredStateConfiguration -RequiredVersion $CompilerVersion -ErrorAction Stop
# Parse the Configuration declaration only after the compiler is loaded.
. $SourcePath
& $ConfigurationName -OutputPath $OutputPath | Out-Null
