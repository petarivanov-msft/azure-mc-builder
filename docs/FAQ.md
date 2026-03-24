# Frequently Asked Questions

## Building Configurations

### What's the difference between Audit and AuditAndSet?

- **Audit** — checks if the VM matches the desired state and *reports* compliance. It never changes anything.
- **AuditAndSet** — checks compliance *and* can automatically fix drift by applying the desired configuration.

Most customers start with Audit to understand their baseline, then move to AuditAndSet for enforcement.

### Can I author packages on any OS?

Yes. PowerShell 7 is cross-platform. You can build Linux packages on Windows, Windows packages on macOS — it doesn't matter. The `New-GuestConfigurationPackage` cmdlet works everywhere.

**Always author on your workstation, not on target VMs.**

### Do I need to install modules on target VMs?

No. The `New-GuestConfigurationPackage` cmdlet bundles everything into the .zip — the DSC resource module (`PSDscResources` or `nxtools`), the MOF, and the metaconfig. The MC agent extracts and uses what's in the package.

### What's the metaconfig.json file?

It tells the MC agent how to behave — specifically, whether to run in Audit or AuditAndSet mode. The builder generates this automatically based on your mode selection.

### Can I use custom DSC resources?

Yes, as long as they have actual PowerShell implementations (`.psm1` files). The MC agent runs resources via PowerShell — schema-only MOF resources don't work. `New-GuestConfigurationPackage` will bundle your custom module into the package automatically.

### What does `New-GuestConfigurationPackage` actually do?

It takes your `.mof` file, resolves all referenced DSC modules (e.g. `PSDscResources`, `nxtools`), copies them into a ZIP alongside a `metaconfig.json`, and outputs a ready-to-deploy package. This is the official way to create MC packages.

---

## Linux-Specific

### Why does Linux use nxtools instead of nx?

The `nx` module on PSGallery (v1.0) is **schema-only** — it contains `.schema.mof` files but no PowerShell implementation code (`.psm1`). The actual `nx` resource logic was built into the old OMI/DSC for Linux engine as native C code. The modern MC agent (`gc_worker`) doesn't ship those native providers.

[`nxtools`](https://github.com/Azure/nxtools) (v1.6.0) is the official replacement, built specifically for Machine Configuration. It has full PowerShell class-based DSC resources that the MC agent can execute.

### My Linux config fails with "couldn't find PowerShell DSC resource"

This means the package references `moduleName: nx` instead of `moduleName: nxtools`. Rebuild the configuration using this builder — it generates the correct `nxtools` references automatically.

### What Linux resources are available?

All from the `nxtools` module:

| Resource | Purpose |
|----------|---------|
| `nxFile` | Manage files, directories, symlinks, permissions |
| `nxFileLine` | Ensure specific lines exist in config files |
| `nxFileContentReplace` | Regex-based search and replace in files |
| `nxService` | Check systemd/init service state |
| `nxPackage` | Verify installed packages (apt/yum/dnf) |
| `nxUser` | Manage local user accounts |
| `nxGroup` | Manage local groups and membership |
| `nxScript` | Custom PowerShell-based compliance checks |

---

## Deployment & Compliance

### What Azure policies need to be in place before MC works?

Three things must be assigned at the subscription level:

1. **Deploy MC Extension** — installs the `AzurePolicyforWindows` or `AzurePolicyforLinux` extension on VMs
2. **Add System-Assigned Managed Identity** — the MC agent needs an identity to authenticate
3. **Your custom policy** — the one created from this builder's output

There's a built-in initiative that covers #1 and #2: *"Deploy prerequisites to enable Guest Configuration policies on virtual machines"* (ID: `12794019-7a00-42cf-95c2-882eed337cc8`).

### How long until compliance results appear?

- **First evaluation:** 5–15 minutes after the assignment is created (the MC agent checks in every ~15 minutes)
- **Subsequent checks:** Every 15 minutes
- **After policy assignment:** Can take up to 30 minutes for the first full cycle (extension install → package download → evaluation → report)

### What's the contentHash in the policy for?

Integrity verification. When the MC agent downloads the package, it computes the SHA256 hash and compares it to the hash in the policy definition. If they don't match, the assignment fails with `GuestConfigurationAssignmentValidationFailed`. Always regenerate the hash when you update a package.

### What are "Reasons" in compliance reports?

Each resource in a MC package can return structured `Reasons` — a code and a human-readable phrase explaining *why* something is non-compliant. For example:

```json
{
  "code": "nxFileLine:nxFileLine:LineNotFound",
  "phrase": "Can't find the expected line 'PermitRootLogin no'."
}
```

This is much more useful than a simple pass/fail — it tells you exactly what's wrong.

---

## Troubleshooting

### Package creation fails with "Found a dependency on PSDesiredStateConfiguration"

The `GuestConfiguration` module doesn't allow resources from `PSDesiredStateConfiguration`. Use `PSDscResources` instead — it's a drop-in replacement. This builder already uses `PSDscResources` for all Windows resources.

### Compliance shows "Not started" after 30+ minutes

Check:
1. Is the MC extension installed on the VM? (`Get-AzVMExtension -ResourceGroupName '<rg>' -VMName '<vm>' | Select Name, ProvisioningState`)
2. Does the VM have a system-assigned managed identity? (`(Get-AzVM -ResourceGroupName '<rg>' -Name '<vm>').Identity`)
3. Is the SAS URL still valid and accessible?
4. Check the MC agent logs:
   - **Windows:** `C:\ProgramData\GuestConfig\gc_agent_logs\gc_agent.log`
   - **Linux:** `/var/lib/GuestConfig/gc_agent_logs/gc_agent.log`

### Hash mismatch error

If you see `GuestConfigurationAssignmentValidationFailed`, the hash in your policy doesn't match the uploaded package. Fix:

```powershell
# Get the correct hash
(Get-FileHash .\output\MyConfig.zip -Algorithm SHA256).Hash
# Update the policy definition with the new hash
```
