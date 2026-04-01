# MEMORY.md — MC Builder Long-Term Memory

## Project State (2026-04-01 ~11:55 UTC)
- 451 unit tests passing, CI green
- Latest commit: 18e6b4d
- Comprehensive E2E testing in progress — 19 packages deployed to VMs
- Petar presenting to PG tomorrow (April 2)

## Key Decisions (Today)
- **Policy generator:** Audit → AuditIfNotExists, AuditAndSet → DeployIfNotExists (matches MS docs)
- **Always use PowerShell Az modules**, NOT az CLI for policy operations
- **Removed WindowsFeature** entirely from catalog (not just blocked)
- **MsiPackage confirmed working** in GC agent (Chrome install test passed)
- **Archive confirmed broken** in GC agent (MSFT_ArchiveResource not found)
- **Removed local compliance test** from package.ps1 (cross-platform fails)
- **Fixed deploy.ps1** PS string terminator error + added AuditAndSet remediation instructions
- **Fixed Download ZIP** button (DOM append + error handling)

## Blocked Resources (3)
- Archive (MSFT_ArchiveResource) — GC agent can't resolve class
- WindowsOptionalFeature — needs DISM module
- WindowsPackageCab — needs DISM module (confirmed by MS docs)

## Active Resource Counts
- 28 total in catalog (20 Windows, 8 Linux)
- 25 active, 3 blocked

## Test Results (In Progress)
- 19 packages deployed via proper policy flow (definition → assignment → remediation)
- win-test-01: WinRegistryAudit=Compliant, WinChromeInstall=Compliant, WinSecPolicyAudit=NonCompliant(drift), others pending
- linux-test-01: LinuxFileAudit=Pending, LinuxServiceRemediate=NonCompliant, others pending
- Storage: amce2etest037387/guestconfiguration in AMC-E2E-Testing

## Test VMs
- win-test-01: Windows Server 2022, uksouth, GC extension installed
- linux-test-01: Ubuntu 24.04, uksouth, GC extension installed

## Known Issues
- DINE policy assignments need remediation task for existing VMs
- AuditIfNotExists relies on prerequisite initiative (12794019) to create GC assignments
- Chrome MSI ProductId changes with versions — currently {6939CB9C-515D-372C-AF4A-BA8D6A40CC4B}

## Next Steps
- Wait for all 19 test results
- Clean up, step back, align with MS docs flow
- Consider removing metaconfig.json from ZIP (package.ps1 generates it)
- Consider whether MOF needs to be in ZIP (it's input to package.ps1, so yes)
