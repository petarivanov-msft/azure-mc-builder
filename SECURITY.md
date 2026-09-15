# Security Policy

## Scope

Azure Machine Configuration Builder is a **client-side browser application**. Editing and source-project ZIP
generation happen in the browser. Official compilation, package evaluation and Azure publishing happen only
when the user runs the downloaded PowerShell tools.

The downloaded build/test/publish scripts are the primary execution boundary. Remediation testing belongs
on a trusted disposable host, not a production workstation.

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

- No backend server for the editor
- No telemetry or analytics — no data leaves the browser
- No authentication — the tool itself never sees your Azure credentials
- No network calls — the web app makes zero external requests

### What the generated scripts do

The downloaded bundle includes PowerShell scripts that, when you run them:

| Script | What it does | Requires |
|--------|-------------|----------|
| `package.ps1` | Explicitly restores locked modules, compiles DSC source and creates the package | PowerShell 7.2+, qualified host, module cache/PSGallery |
| `test.ps1` | Executes Get/Test and, only with explicit flags, remediation | Trusted matching-OS test host; disposable host for Set |
| `deploy.ps1` | Authenticates, uploads verified bytes, generates and upserts the policy definition | Existing storage, locked Az tools, Azure permissions |

**You should review the generated scripts before running them.** They are human-readable PowerShell.

### Trust boundaries

1. **Browser to source project:** imported configuration and Script resource content remain user-controlled data. Exporting does not make arbitrary source safe.
2. **Tool restoration:** exact versions are restored into a project-owned cache on explicit request. The known GuestConfiguration compatibility patch checks both source digests; see the authoring documentation.
3. **Evaluation:** Get/Test can execute code. Set requires an additional disposable-host acknowledgement and its actual report must succeed.
4. **Azure publishing:** explicit tenant/subscription selection is checked. The publisher creates no storage accounts, grants no roles and starts no assignments/remediations.

## Security Considerations for Users

### SAS Tokens

The authoring runtime enforces an explicit execution boundary: building does not evaluate the package;
Get/Test requires acknowledgement, and remediation additionally requires a disposable-host flag. Script resources
can execute arbitrary code even in Audit mode, so review all source and use isolated test hosts.
Publication requires matching build/validation fingerprints and explicit tenant/subscription IDs. Receipts protect
against accidental stale deployment, not deliberate tampering. The publisher never assigns a policy or grants roles automatically.

The single publishing runtime uses Microsoft Entra ID and an HTTPS-only, read-only blob SAS with a
**6-day default expiry**. `-SasExpiryDays` is limited to one through six days. Renew before expiry by redeploying
the same validated bytes. There is no Shared Key mode or account-key fallback. Storage policies can impose stricter limits.

SAS URLs are read credentials stored in policy definitions. Keep sensitive material out of packages. Network restrictions must still allow target machines to download the package.

See [New-AzStorageBlobSASToken](https://learn.microsoft.com/powershell/module/az.storage/new-azstorageblobsastoken) for the OAuth-context example.

### Storage Account

Provision a storage account separately. The publisher requires its name and creates a private container if
needed. It never lists account keys or changes account access policy.

For production use, consider additionally enabling:
- Storage firewall rules (restrict to your IP / VNet)
- Diagnostic logging
- Customer-managed encryption keys (if required by your org)

### Policy Definitions

Generated Azure Policy definitions are created or updated **in place** at subscription scope, without deleting
definitions or assignments. The official generator writes policy JSON under the source project's `output/policies`
directory. It contains a SAS read credential: do not publish or commit output directories.

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
