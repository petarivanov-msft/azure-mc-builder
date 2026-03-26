# Architecture

This document explains how the Azure Machine Configuration Builder works — from user input to a deployable Azure Policy package.

## High-Level Overview

The builder is a browser-based tool (React + TypeScript) that generates six deployment artifacts from a visual configuration. There's no server — everything runs client-side in the browser.

```
User Input (UI)
     │
     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Config Store  │───▶│  Generators  │───▶│  ZIP Bundle  │
│  (Zustand)    │    │  (6 modules) │    │  (JSZip)     │
└──────────────┘    └──────────────┘    └──────────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
        .mof          policy.json    package.ps1
        .ps1          metaconfig     README.md
```

## The Generator Pipeline

Each generator is independent — they all take a `ConfigurationState` object and produce a specific artifact. There's no chaining between generators. The bundle generator calls all of them to produce the final ZIP.

### 1. MOF Generator (`mofGenerator.ts`)

**Input:** Configuration state with resources and properties.
**Output:** A compiled MOF file (Managed Object Format) with UTF-8 BOM.

The MOF is the core artifact — it's what the Machine Configuration agent actually evaluates on the target machine. The generator:

- Emits a `Configuration` document header with metadata comments
- For each resource, writes an `instance of <ClassName>` block with:
  - `ResourceID` — e.g. `[nxFile]CheckHostsFile` (matches DSC convention)
  - `SourceInfo` — breadcrumb for debugging
  - `ModuleName` / `ModuleVersion` — which DSC module to use
  - All configured properties, formatted per type (strings are escaped and quoted, arrays use `{}` syntax, booleans emit `True`/`False`)
  - `DependsOn` — references other resources by `[ClassName]InstanceName` syntax
- Ends with an `OMI_ConfigurationDocument` instance containing the document metadata

**Key detail:** MOF string escaping is critical. Registry paths contain backslashes (`HKLM:\SOFTWARE\...`), and values can contain quotes, newlines, or null bytes. The `escapeMofString()` function handles all of these.

### 2. PS1 Generator (`ps1Generator.ts`)

**Input:** Configuration state.
**Output:** A human-readable PowerShell DSC Configuration script.

This is the "source code" equivalent of the MOF. It's not used for deployment (the MOF is), but it's included as a reference so users can:

- Understand what the configuration does in familiar PowerShell syntax
- Modify and recompile it manually if needed
- Use it as a starting point for more complex configurations

### 3. Policy Generator (`policyGenerator.ts`)

**Input:** Configuration state.
**Output:** An Azure Policy definition JSON.

This is the most complex generator. It produces either:

- **AuditIfNotExists** (for `Audit` mode) — checks if a compliant GC assignment exists
- **DeployIfNotExists** (for `AuditAndSet` mode) — deploys a GC assignment that remediates drift

**Key architectural decisions:**

- **Dual resource targeting:** The `if` condition matches both `Microsoft.Compute/virtualMachines` AND `Microsoft.HybridCompute/machines` (Azure Arc), so the same policy works for both VM types.
- **Conditional ARM resources (DINE only):** The deployment template contains two GC assignment resources — one for VMs, one for Arc — with ARM `condition` expressions that activate the correct one based on `[field('type')]`. This was necessary because VM and Arc GC assignments use different resource type paths.
- **API version:** Uses `2024-04-05` for GC assignments (required for `assignmentType` support) and `2024-03-01` for VM/extension resources.
- **parameterHash:** When configurations have parameters (via `configurationParameter`), the `existenceCondition` includes a `parameterHash` check. This ensures the policy detects drift not just in compliance status but also in parameter values.
- **Extension auto-deployment:** DINE policies include the GC agent extension as a prerequisite resource (`ConfigurationForWindows` or `ConfigurationForLinux`) with `typeHandlerVersion: '1.*'` and auto-upgrade enabled.

### 4. Metaconfig Generator (`metaconfigGenerator.ts`)

**Input:** Configuration state.
**Output:** A `metaconfig.json` file.

The metaconfig tells the GC agent on the machine how to behave:

- `Audit` mode → `Type: "Audit"`, `configurationMode: "MonitorOnly"` — observe and report only
- `AuditAndSet` mode → `Type: "AuditAndSet"`, `configurationMode: "ApplyAndAutoCorrect"` — fix drift automatically

**Important:** The generator emits a full metaconfig (not just the `Type` field). A minimal metaconfig causes some GC agent versions to reject remediation packages. This was discovered and fixed during E2E testing against real Azure VMs.

### 5. Package Script Generator (`packageScriptGenerator.ts`)

**Input:** Configuration state.
**Output:** A `package.ps1` PowerShell 7 script.

This is the "glue" script that turns the raw MOF into a deployable package. When the user runs it on their workstation:

1. **Detects required DSC modules** by parsing the MOF for `ModuleName` and `ModuleVersion` entries
2. **Installs them automatically** — both `GuestConfiguration` and the DSC resource modules (e.g. `PSDscResources`, `nxtools`, `SecurityPolicyDsc`)
3. **Calls `New-GuestConfigurationPackage`** to bundle the MOF + modules into a deployable `.zip`
4. **Runs a local compliance test** via `Get-GuestConfigurationPackageComplianceStatus` to validate the package before deployment

The script includes both a dynamic path (MOF parsing) and a static fallback (hardcoded module list) for reliability.

### 6. README Generator (`readmeGenerator.ts`)

**Input:** Configuration state.
**Output:** Step-by-step deployment instructions.

Generates a README tailored to the specific configuration — correct module names, policy type, platform-specific prerequisite initiative IDs, and PowerShell commands with the configuration name pre-filled.

### Bundle Generator (`bundleGenerator.ts`)

Calls all six generators and produces a ZIP file (via JSZip) with all artifacts at the root level. Also provides a `computeContentHash()` utility for SHA256 hashing.

## Resource Schemas

The builder knows about 29 DSC resources across 6 modules. Each schema (`src/schemas/`) defines:

```typescript
interface ResourceSchema {
  resourceName: string;     // e.g. "Registry"
  moduleName: string;       // e.g. "PSDscResources"
  moduleVersion: string;    // e.g. "2.12.0.0"
  mofClassName: string;     // e.g. "MSFT_RegistryResource"
  platform: 'Windows' | 'Linux';
  properties: PropertySchema[];  // with types, validation, enums
}
```

Schemas are the source of truth for:
- What properties are available for each resource
- Which properties are required vs optional
- Which property is the key property (for MOF `ResourceID`)
- Enum values (e.g. `State: Running | Stopped`)
- Validation patterns and messages

## Templates

Nine pre-built templates (`src/templates/`) demonstrate realistic configurations. Each template is a complete `ConfigurationState` that can be loaded directly into the store. Templates cover:

- CIS-aligned Windows security baselines (14 resources)
- Linux SSH hardening, file permissions, user security
- Script-based audits (nxScript with `[Reason]` class)
- Remediation (AuditAndSet with nxScript)

## State Management

The store (`src/store/configStore.ts`) uses Zustand with:

- **Undo/redo** — full state snapshots stored in `past[]` / `future[]` arrays
- **LocalStorage persistence** — configuration survives browser refresh
- **Import/export** — JSON serialisation for sharing configurations
- **Validation** — checks for duplicate instance names, missing required properties, and nxFile `Mode` format warnings

## Build & CI

- **Vite** — development server and production build
- **Vitest** — 137 unit tests covering all 29 resource schemas, MOF generation, policy generation, escaping edge cases
- **E2E validation** — `e2e/generate-test-configs.ts` creates 46 test configurations, `e2e/validate-packages.ps1` compiles them with `New-GuestConfigurationPackage` and runs local compliance tests
- **GitHub Actions** — CI runs lint + test on every push; Pages workflow deploys the built site

## Deployment Architecture (Azure Side)

Once a package leaves the builder, the Azure deployment flow is:

```
                    ┌───────────────────────────────────────────────────┐
                    │              Azure Control Plane                  │
                    │                                                   │
  package.zip ────▶ │  Blob Storage  ──▶  Azure Policy  ──▶  Policy    │
  (SAS URL)         │                      Definition        Assignment │
                    │                                                   │
                    └───────────────────────┬───────────────────────────┘
                                            │
                              ┌──────────────┼──────────────┐
                              │              │              │
                              ▼              ▼              ▼
                         Azure VM       Azure VM       Arc Server
                        (Windows)       (Linux)        (Linux)
                              │              │              │
                              ▼              ▼              ▼
                         GC Agent        GC Agent       GC Agent
                        downloads       downloads      downloads
                        package.zip    package.zip    package.zip
                              │              │              │
                              ▼              ▼              ▼
                        Evaluates MOF   Evaluates MOF  Evaluates MOF
                        Reports to ARM  Reports to ARM Reports to ARM
```

The GC agent evaluates every 15 minutes by default. For `ApplyAndAutoCorrect` assignments, it also remediates drift on each cycle.
