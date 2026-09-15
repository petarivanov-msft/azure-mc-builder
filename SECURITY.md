# Security Policy

## Scope

Azure Machine Configuration Builder is a **client-side browser application**. All configuration building, MOF generation, and ZIP packaging happens entirely in your browser — no data is sent to any server.

The generated deployment scripts (`package.ps1`, `deploy.ps1`) run on **your workstation** and interact with your Azure subscription. These scripts are the primary security-relevant surface.

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it through GitHub's **private vulnerability reporting**:

1. **Do NOT open a public GitHub issue** for security vulnerabilities
2. Go to the [Security tab](https://github.com/petarivanov-msft/azure-mc-builder/security) of this repository
3. Click **"Report a vulnerability"**
4. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
5. You should receive a response within 7 days

## Security Model

### What this tool does NOT have access to

- No backend server — everything runs in your browser
- No telemetry or analytics — no data leaves the browser
- No authentication — the tool itself never sees your Azure credentials
- No network calls — the web app makes zero external requests

### What the generated scripts do

The downloaded bundle includes PowerShell scripts that, when you run them:

| Script | What it does | Requires |
|--------|-------------|----------|
| `package.ps1` | Installs DSC modules from PSGallery, compiles the MOF into a GC package | PowerShell 7, internet access to PSGallery |
| `deploy.ps1` | Authenticates to Azure, creates storage account, uploads package, creates policy definition | Az PowerShell module, Azure credentials |

**You should review the generated scripts before running them.** They are human-readable PowerShell.

### Trust boundaries

1. **Browser → ZIP download**: Trusted. All generation is deterministic from the UI state. No external inputs.
2. **PSGallery module installation**: `package.ps1` installs modules from the PowerShell Gallery by name and version. PSGallery is Microsoft's official module repository. Module integrity relies on PSGallery's infrastructure.
3. **Azure deployment**: `deploy.ps1` authenticates via `Connect-AzAccount` (interactive login). It creates resources in your subscription using your identity and permissions.

## Security Considerations for Users

### SAS Tokens

The official-authoring preview adds an explicit execution boundary: building does not evaluate the package;
Get/Test requires acknowledgement, and remediation additionally requires a disposable-host flag. Script resources
can execute arbitrary code even in Audit mode, so review all source and use isolated test hosts.
Publication requires matching build/validation fingerprints and explicit tenant/subscription IDs. Receipts protect
against accidental stale deployment, not deliberate tampering. The preview never assigns a policy or grants roles automatically.

Both deployment scripts default to Microsoft Entra ID (`-StorageAuthMode UserDelegation`) and an HTTPS-only, read-only blob SAS with a **6-day expiry**. User delegation keys are limited to seven days; the script caps the SAS at six days to leave room for clock skew. Renew the URL before expiry by re-running deployment. The script prints the expiry warning.

For an approved long-lived service SAS, explicitly pass `-StorageAuthMode SharedKey -SasExpiryDays 1095`. This requires permission to list account keys and Shared Key authentication enabled on the account. There is **no silent fallback** from Entra ID to account keys, nor any automatic RBAC grant. Storage-account SAS expiration policies can impose stricter limits.

SAS URLs are read credentials stored in policy definitions. Keep sensitive material out of packages. Network restrictions must still allow target machines to download the package.

See [New-AzStorageBlobSASToken](https://learn.microsoft.com/powershell/module/az.storage/new-azstorageblobsastoken) for the OAuth-context example.

### Storage Account

The script creates a storage account with:
- `AllowBlobPublicAccess = $false` — no anonymous access
- `Standard_LRS` — locally redundant storage
- Container-level access set to `Off` (private)

For production use, consider additionally enabling:
- Storage firewall rules (restrict to your IP / VNet)
- Diagnostic logging
- Customer-managed encryption keys (if required by your org)

### Policy Definitions

Generated Azure Policy definitions are created or updated **in place** at subscription scope; deployment does not delete definitions or assignments. They require **Resource Policy Contributor** role. Review the generated `policy.json` before deploying — it defines what the policy evaluates and (for AuditAndSet mode) what it remediates. Filled policy JSON is passed in memory, not written to a shared temporary file.

### AuditAndSet Mode

Configurations in **AuditAndSet** mode will actively change settings on target VMs. This is by design, but:
- Always start with **Audit** mode to understand your compliance baseline
- Review exactly which resources and properties will be enforced
- Test on a small scope before assigning broadly

### Local State

The builder persists your configuration to browser `localStorage` for convenience. This data stays in your browser and is not synced anywhere. Clear it via browser settings or by clicking "Reset" in the app.

## Dependencies

This project uses the following runtime dependencies:

| Package | Purpose |
|---------|---------|
| `react`, `react-dom` | UI framework |
| `@fluentui/react-components` | Microsoft Fluent UI design system |
| `zustand` | State management |
| `jszip` | ZIP file generation (client-side) |
| `uuid` | Unique ID generation for resources |

All dependencies are from well-maintained, widely-used packages. Dependabot is configured to monitor for security updates weekly.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest on `main` | ✅ |
| GitHub Pages deployment | ✅ |
| Older commits | ❌ |

This is a single-branch project deployed continuously. Always use the latest version at [petarivanov-msft.github.io/azure-mc-builder](https://petarivanov-msft.github.io/azure-mc-builder/).
