# Security Policy

## Scope

Azure Machine Configuration Builder is a **client-side browser application**. All configuration building, MOF generation, and ZIP packaging happens entirely in your browser — no data is sent to any server.

The generated deployment scripts (`package.ps1`, `deploy.ps1`) run on **your workstation** and interact with your Azure subscription. These scripts are the primary security-relevant surface.

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do NOT open a public GitHub issue** for security vulnerabilities
2. Email: **petarivanov-msft@users.noreply.github.com** with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. You should receive a response within 7 days

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

`deploy.ps1` generates a SAS token for the uploaded package blob with a **3-year expiry**, consistent with the [Microsoft documentation example](https://learn.microsoft.com/en-us/azure/governance/machine-configuration/how-to/develop-custom-package/4-publish-package). Consider:

- Storing packages in a storage account with restricted network access
- Rotating SAS tokens periodically by re-running the deploy script

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

Generated Azure Policy definitions are created at subscription scope. They require **Resource Policy Contributor** role. Review the generated `policy.json` before deploying — it defines what the policy evaluates and (for AuditAndSet mode) what it remediates.

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
