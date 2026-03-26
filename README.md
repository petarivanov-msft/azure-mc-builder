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
2. **Add resources** from a catalog of 29 DSC resources across 6 modules
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
| `README.md` | Step-by-step deployment instructions |

## End-to-End Workflow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. Build in  │────▶│ 2. Download  │────▶│ 3. Run        │────▶│ 4. Upload to │
│  the web app  │     │   .zip       │     │  package.ps1  │     │  blob storage│
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                       │
┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  7. View      │◀────│ 6. MC agent  │◀────│ 5. Create &  │◀───────────┘
│  compliance   │     │  evaluates   │     │  assign policy│
└──────────────┘     └──────────────┘     └──────────────┘
```

### Quick Start

```powershell
# 1. Build your config in the web app, download the ZIP

# 2. Create the deployable package (on your workstation, NOT the target VM)
#    Use pwsh (PowerShell 7+), NOT powershell (Windows PowerShell 5.1)
cd <extracted-folder>
pwsh ./package.ps1   # Installs modules, creates .zip package, runs local test

# 3. Upload to Azure Blob Storage (requires Az module: Install-Module Az)
$ctx = (Get-AzStorageAccount -ResourceGroupName 'myRG' -Name 'mystorage').Context
Set-AzStorageBlobContent -Container 'guestconfiguration' -File '.\output\MyConfig.zip' -Context $ctx
$uri = New-AzStorageBlobSASToken -Container 'guestconfiguration' -Blob 'MyConfig.zip' `
  -Permission r -ExpiryTime (Get-Date).AddYears(3) -Context $ctx -FullUri

# 4. Get the content hash
$hash = (Get-FileHash '.\output\MyConfig.zip' -Algorithm SHA256).Hash

# 5. Update policy.json with the URI and hash, then create the policy
#    Replace {{contentUri}} and {{contentHash}} in policy.json
New-AzPolicyDefinition -Name 'MyConfig' -Policy '.\policy.json' -Mode 'Indexed'

# 6. Assign the policy to a scope
$def = Get-AzPolicyDefinition -Name 'MyConfig'
New-AzPolicyAssignment -Name 'MyConfig' -PolicyDefinition $def -Scope '/subscriptions/<sub-id>'
```

## Supported Resources (29)

### Windows — PSDscResources v2.12.0.0

| Resource | What It Checks |
|----------|---------------|
| Registry | Registry key values and data |
| Service | Windows service state and startup type |
| WindowsProcess | Running processes |
| WindowsFeature | Installed Windows features/roles (Server SKU only) |
| WindowsOptionalFeature | Optional Windows features |
| Environment | Environment variables |
| Script | Custom PowerShell compliance checks |
| MsiPackage | Installed MSI packages |
| WindowsPackageCab | Installed CAB packages |
| Group | Local group membership |
| User | Local user accounts |
| Archive | ZIP/archive extraction state |

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
| Windows Security Baseline | Windows | Audit | 14 (CIS-aligned) |
| Windows Service Monitoring | Windows | Audit | 5 |
| Windows Audit Policy Baseline | Windows | Audit | 8 |
| Windows Network Security | Windows | Audit | 6 |
| Linux SSH Hardening | Linux | Audit | 5 |
| Linux File Permissions | Linux | Audit | 6 |
| Linux Script-Based Audit | Linux | Audit | 5 (nxScript) |
| Linux User Security | Linux | Audit | 4 |
| Linux Sysctl Remediation | Linux | AuditAndSet | 5 (nxScript, remediates) |

## Configuration Modes

- **Audit** — checks compliance and reports it. Does not change anything on the VM.
- **AuditAndSet** — checks compliance and **remediates** drift (applies the desired state). The MC agent uses `ApplyAndAutoCorrect` mode internally.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | How the generators work, the pipeline from UI to ZIP, schema design |
| [Demo Script](docs/DEMO.md) | Step-by-step walkthrough for live demonstrations |
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
npm test          # Vitest (113 tests)
```

### E2E Validation

The CI pipeline validates every generated package against the real DSC engine:

```bash
# Generate all 46 test configurations
npx tsx e2e/generate-test-configs.ts

# Validate packages (requires pwsh + GuestConfiguration module)
pwsh e2e/validate-packages.ps1
```

**CI results:** 16/16 Linux packages + 30/30 Windows packages pass local DSC evaluation. These results have been verified against real Azure VMs running the Guest Configuration agent.

## License

MIT
