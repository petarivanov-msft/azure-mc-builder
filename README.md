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
4. **Preview** the generated MOF, PS1, metaconfig, policy JSON, and deployment script in real time
5. **Download** a ready-to-use package bundle with everything you need to deploy

The downloaded bundle contains:

| File | Purpose |
|------|---------|
| `<Name>.mof` | Compiled DSC configuration (what the MC agent evaluates) |
| `<Name>.ps1` | PowerShell DSC Configuration script (human-readable source) |
| `metaconfig.json` | MC agent behavior settings (reference copy — `package.ps1` embeds this automatically) |
| `policy.json` | Azure Policy definition (AuditIfNotExists or DeployIfNotExists) |
| `package.ps1` | Helper script — auto-installs modules, creates deployable package, tests locally |
| `deploy.ps1` | Deploy script — uploads ZIP to blob storage and creates the policy definition |
| `README.md` | Step-by-step deployment instructions |

## End-to-End Workflow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. Build in  │────▶│ 2. Download  │────▶│ 3. Run        │────▶│ 4. Run       │
│  the web app  │     │   .zip       │     │  package.ps1  │     │  deploy.ps1  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                       │
┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  7. View      │◀────│ 6. MC agent  │◀────│ 5. Assign    │◀───────────┘
│  compliance   │     │  evaluates   │     │  from Portal │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Quick Start

```powershell
# 1. Build your config in the web app, download the ZIP

# 2. Extract and create the deployable package (on your workstation, NOT the target VM)
#    Use pwsh (PowerShell 7+), NOT powershell (Windows PowerShell 5.1)
cd <extracted-folder>
pwsh ./package.ps1   # Installs modules, creates output/<Name>.zip, runs local test

# 3. Upload to Azure Blob Storage and create the policy definition
#    (requires Az module: Install-Module Az)
pwsh ./deploy.ps1    # Authenticates, uploads ZIP, creates policy definition

# 4. Assign the policy from the Azure Portal
#    Navigate to: Azure Portal → Policy → Definitions → search "MC-<Name>"
#    Click Assign, select your scope, and save.
#
#    Or assign via PowerShell:
#    $def = Get-AzPolicyDefinition -Name 'MC-<Name>'
#    New-AzPolicyAssignment -Name 'MyAssignment' -PolicyDefinition $def -Scope '/subscriptions/<sub-id>'
```

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
- **PowerShell 7.x** — run `pwsh`, not `powershell` (Windows PowerShell 5.1 won't work) — [install guide](https://learn.microsoft.com/powershell/scripting/install/installing-powershell)
- **Az PowerShell module** — `Install-Module Az -Scope CurrentUser` (for Steps 3–6: upload, policy creation, assignment)
- DSC modules are installed automatically by `package.ps1`

> **Author packages on your workstation**, not on target VMs. PowerShell 7 is cross-platform — you can build Linux packages from Windows and vice versa.

## Tech Stack

- React 18 + TypeScript + Vite
- [Fluent UI v9](https://react.fluentui.dev/) (Microsoft's design system)
- [Zustand](https://github.com/pmndrs/zustand) (state management with undo/redo)
- Deployed to [GitHub Pages](https://petarivanov-msft.github.io/azure-mc-builder/)

## Development

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # Production build → dist/
npm run lint      # ESLint
npm test          # Vitest (445 tests)
```

### E2E Validation

The CI pipeline validates every generated package against the real DSC engine:

```bash
# Generate all 41 test configurations (5 blocked resources are skipped)
npx tsx e2e/generate-test-configs.ts

# Validate packages (requires pwsh + GuestConfiguration module)
pwsh e2e/validate-packages.ps1
```

**CI results:** 16/16 Linux packages + 25/25 Windows packages pass local DSC evaluation. These results have been verified against real Azure VMs running the Guest Configuration agent.

## License

MIT
