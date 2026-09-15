# Azure Machine Configuration Builder

[![CI](https://github.com/petarivanov-msft/azure-mc-builder/actions/workflows/ci.yml/badge.svg)](https://github.com/petarivanov-msft/azure-mc-builder/actions/workflows/ci.yml)
[![GitHub Pages](https://github.com/petarivanov-msft/azure-mc-builder/actions/workflows/pages.yml/badge.svg)](https://github.com/petarivanov-msft/azure-mc-builder/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A visual, browser-based tool for building Azure Machine Configuration (formerly Guest Configuration) packages — no MOF or DSC knowledge required.

**Live:** [petarivanov-msft.github.io/azure-mc-builder](https://petarivanov-msft.github.io/azure-mc-builder)

## What Is Azure Machine Configuration?

Azure Machine Configuration (MC) lets you audit and enforce OS-level settings on Azure VMs and Arc-connected servers through Azure Policy. Think of it as "Azure Policy, but for what's *inside* the VM" — registry keys, services, files, packages, users, and more.

MC uses PowerShell Desired State Configuration (DSC) under the hood, but you don't need to write DSC code. That's what this builder is for.

## What This Builder Does

1. **Pick a platform** (Windows or Linux) and a configuration name
2. **Add resources** from a catalog of DSC resources across 6 modules
3. **Configure properties** with validated inputs, enums, and contextual help
4. **Preview** the DSC source, project metadata, build/test/publish scripts and README
5. **Download** a source project, then compile, validate and publish with Microsoft's tools

The downloaded ZIP is an **authoring project**, not a deployable Machine Configuration package:

| File | Purpose |
|------|---------|
| `Configuration.ps1` | DSC source consumed by the official compiler |
| `config.json` | Editable configuration, dependencies and persistent policy identity |
| `toolchain.lock.json` | Exact tool and resource versions |
| `compile.ps1`, `package.ps1` | Compile source and build the real package |
| `test.ps1` | Explicit evaluation and optional disposable-host remediation |
| `deploy.ps1`, `McBuilder.psm1` | Shared publishing wrapper and runtime |
| `README.md` | Platform- and mode-specific instructions |

## Build, Test, Publish

The browser never generates a final MOF, metaconfig or policy definition. The DSC compiler and
GuestConfiguration **4.12.0** create those artifacts after download.

```powershell
# Run from the extracted source project on a qualified Windows or Ubuntu host:
pwsh ./package.ps1 -RestoreTools

# Explicit Audit evaluation on a trusted, matching-OS test host:
pwsh ./test.ps1 -AcknowledgeExecution

# For AuditAndSet, use a disposable host: this changes that machine.
# pwsh ./test.ps1 -AcknowledgeExecution -Remediate -DisposableEnvironment

# Publish the verified bytes to storage and create/update a policy definition:
pwsh ./deploy.ps1 -RestoreTools -TenantId 'Your-Tenant-ID' -SubscriptionId 'Your-Subscription-ID' -StorageAccountName 'YourStorageAccount'
```

The local module cache is `.modules` (or `MC_MODULE_CACHE`). Exact versions are locked, and a validation
receipt is tied to the package and build inputs. **A failed Set cannot be hidden by a later compliant Get.**
Linux evaluation requires root; Windows localization errors are failures, not valid drift.

Provision storage and permissions first. Publishing uses Microsoft Entra ID and a read-only HTTPS SAS
valid for at most six days, without Shared Key access. Renew before expiry by redeploying the same validated
package. `-UseAzureCli` explicitly reuses an existing CLI login without changing its default subscription.

Assignment, identity grants and initial remediation are separate, explicit operations; follow the downloaded
README. Azure VMs need the Machine Configuration extension and identity prerequisites. Arc targeting is explicit;
VM scale sets are excluded. A successful remediation deployment is not proof of guest-level compliance.

Older saved configuration JSON remains importable, including projects with a retired workflow selection.
The saved policy identity is retained; all new downloads use the single source-project workflow.
See [official authoring](docs/OFFICIAL-AUTHORING.md) for verification, updates, the pinned compatibility guard and rollback.

## Supported Resources

### Windows — PSDscResources v2.12.0.0

| Resource | What It Checks |
|----------|---------------|
| Registry | Registry key values and data |
| Service | Windows service state and startup type |
| WindowsProcess | Running processes |
| Environment | Environment variables |
| Script | Custom PowerShell compliance checks |
| MsiPackage | Installed MSI packages |
| User | Local user accounts |

### Windows — SecurityPolicyDsc v2.10.0.0

| Resource | What It Checks |
|----------|---------------|
| AccountPolicy | Password and lockout policies |
| UserRightsAssignment | User rights (41 policy types) |
| SecurityOption | Security options (interactive logon, network security, etc.) |

### Windows — AuditPolicyDsc v1.4.0.0

| Resource | What It Checks |
|----------|---------------|
| AuditPolicySubcategory | Windows audit policy subcategories (58 types) |
| AuditPolicyOption | CrashOnAuditFail and FullPrivilegeAuditing |

### Windows — NetworkingDsc v9.0.0

| Resource | What It Checks |
|----------|---------------|
| Firewall | Windows Firewall rules (ports, protocols, profiles, auth) |

### Windows — ComputerManagementDsc v9.2.0

| Resource | What It Checks |
|----------|---------------|
| ScheduledTask | Scheduled task configuration |
| TimeZone | System time zone |
| PowerPlan | Active power plan |

### Linux — nxtools v1.6.0

| Resource | What It Checks |
|----------|---------------|
| nxFile | Files, directories, symlinks — permissions, owner, content |
| nxFileLine | Specific lines in config files |
| nxFileContentReplace | Regex-based content matching in files |
| nxService | Systemd/init service state |
| nxPackage | Installed packages (apt/yum/dnf) |
| nxUser | Local user accounts |
| nxGroup | Local group membership |
| nxScript | Custom PowerShell compliance scripts (with `[Reason]` class support) |

## Templates

The builder includes 9 ready-to-use templates:

| Template | Platform | Mode | Resources |
|----------|----------|------|-----------|
| Windows Security Baseline (CIS) | Windows | Audit | 14 |
| Windows Audit Policy | Windows | Audit | 8 |
| Windows Network Security | Windows | Audit | 5 |
| Windows Service Monitoring | Windows | Audit | 3 |
| Linux SSH Hardening | Linux | Audit | 5 |
| Linux Script-Based Audit (nxScript) | Linux | Audit | 5 |
| Linux User & Group Security | Linux | Audit | 6 |
| Linux File Permissions | Linux | Audit | 4 |
| Linux Sysctl Remediation (nxScript) | Linux | AuditAndSet | 5 |

## Configuration Modes

- **Audit** — checks compliance and reports it. Does not change anything on the VM.
- **AuditAndSet** — checks compliance and **remediates** drift (applies the desired state). The MC agent uses `ApplyAndAutoCorrect` mode internally.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | How the generators work, the pipeline from UI to ZIP, schema design |
| [Template Gallery](docs/TEMPLATES.md) | Visual overview of all 9 pre-built templates with resource details |
| [Permissions Guide](docs/PERMISSIONS.md) | Azure RBAC roles and prerequisites |
| [FAQ](docs/FAQ.md) | Common questions about authoring, deployment, and troubleshooting |

## Required Azure Permissions

See [docs/PERMISSIONS.md](docs/PERMISSIONS.md) for the full guide.

**Minimum roles:**

| Role | Scope | Purpose |
|------|-------|---------|
| Resource Policy Contributor | Subscription | Create & assign custom policies |
| Storage Blob Data Contributor | Storage account | Upload packages |

**One-time setup:**

1. Register the `Microsoft.GuestConfiguration` resource provider
2. Assign the **"Deploy prerequisites to enable Guest Configuration policies on virtual machines"** initiative (`12794019-7a00-42cf-95c2-882eed337cc8`) — this auto-deploys the MC agent extension and system-assigned managed identity

## Prerequisites

- **Azure subscription** with the permissions above
- **PowerShell 7.2+** — run `pwsh`, not `powershell` — [install guide](https://learn.microsoft.com/powershell/scripting/install/installing-powershell)
- Restore the locked DSC/Az modules explicitly with `-RestoreTools`; global installations are not upgraded

> Compile and test on a qualified matching-OS Windows or Ubuntu host. Cross-OS compilation and macOS authoring
> are not promised. Remediation testing belongs on a disposable machine, not a production workstation.

## Tech Stack

- React 19 + TypeScript + Vite
- [Fluent UI v9](https://react.fluentui.dev/) (Microsoft's design system)
- [Zustand](https://github.com/pmndrs/zustand) (state management with undo/redo)
- Deployed to [GitHub Pages](https://petarivanov-msft.github.io/azure-mc-builder/)

## Development

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # Production build → dist/
npm run lint      # ESLint
npm test          # Source-project, migration and runtime-contract tests
```

### Native Validation

The Windows/Ubuntu CI matrix compiles all matching catalog resources and templates, then uses the shipped
runtime to package and evaluate representative fixtures, check remediation/idempotence/drift, reject partial
Set failures, generate official policies and verify locked publishing-tool imports. Native tests require
their explicit flags; a skipped native test is not counted as verification.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the disposable-runner commands.

## License

MIT
