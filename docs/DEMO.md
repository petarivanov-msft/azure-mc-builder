# Demo Script — April 2nd Walkthrough

A step-by-step script for demonstrating the Azure Machine Configuration Builder. Covers the full lifecycle: building a configuration, generating artifacts, deploying to Azure, and verifying compliance.

**Time estimate:** 20–25 minutes (plus ~10 min for GC agent evaluation if showing live compliance).

---

## Pre-Demo Setup (do before the meeting)

1. **Have these tabs open:**
   - Builder: https://petarivanov-msft.github.io/azure-mc-builder/
   - Azure Portal → Policy → Compliance
   - Azure Portal → Resource Group with a test VM (running)
   - This document

2. **Have these ready:**
   - PowerShell 7 terminal (run `pwsh --version` to confirm)
   - `Az` module installed (`Import-Module Az`)
   - A storage account with a `guestconfiguration` container
   - A running Azure VM or Arc server for live testing (optional but impressive)

3. **Pre-deploy a config 30 min before the demo** so you have compliance results to show. The GC agent takes 5–15 min to evaluate.

---

## Part 1: The Problem (2 min)

> *"Azure Machine Configuration lets you audit and enforce what's **inside** VMs — registry keys, services, files, packages. It's Azure Policy but for the OS layer.*
>
> *The catch? You need to write MOF files, PowerShell DSC scripts, package them with specific tools, create Azure Policy JSON with correct API versions and ARM template conditions, handle Arc vs VM differences... It's a lot of moving parts.*
>
> *This builder eliminates all of that. You pick resources, configure properties, and it generates everything — ready to deploy."*

---

## Part 2: Building a Configuration (5 min)

### Open the builder and start fresh

1. Go to https://petarivanov-msft.github.io/azure-mc-builder/
2. Click **Reset** if there's a previous config loaded

### Set the basics

1. **Configuration Name:** `DemoSecurityAudit`
2. **Platform:** Windows
3. **Mode:** Audit
4. Leave version as `1.0.0`

### Add resources

**Resource 1: Registry — TLS 1.2**
1. Click **Add Resource**
2. Select **Registry** from the Windows section
3. Instance name: `EnforceTLS12`
4. Set properties:
   - Key: `HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.2\Client`
   - ValueName: `Enabled`
   - ValueType: `Dword`
   - ValueData: `1`
   - Ensure: `Present`

> *"This checks whether TLS 1.2 is enabled on the client side. It's a common CIS benchmark requirement."*

**Resource 2: Service — Windows Update**
1. Click **Add Resource** → **Service**
2. Instance name: `WindowsUpdateRunning`
3. Properties:
   - Name: `wuauserv`
   - State: `Running`

> *"Now we're also checking if Windows Update is running. Notice I can add dependencies — if I wanted the service check to only run after the registry check passes, I'd set DependsOn."*

**Resource 3 (optional): WindowsFeature**
1. Add **WindowsFeature**
2. Instance name: `BitLockerInstalled`
3. Properties:
   - Name: `BitLocker`
   - Ensure: `Present`

### Show the preview

1. Click through the **Preview** tabs:
   - **MOF** — point out the `instance of` blocks, proper escaping of the registry path backslashes
   - **PS1** — "This is the human-readable DSC script, included for reference"
   - **Policy** — "This is the Azure Policy definition. Notice it targets both `Microsoft.Compute/virtualMachines` AND `Microsoft.HybridCompute/machines` — one policy covers both Azure VMs and Arc servers"
   - **package.ps1** — "This auto-installs the DSC modules, bundles the package, and runs a local test"

> *"Everything updates in real time as you configure. What you see is exactly what gets deployed."*

---

## Part 3: Templates (2 min)

> *"We also include pre-built templates for common scenarios."*

1. Click **Templates**
2. Load **Windows Security Baseline (CIS)** — "14 resources covering TLS, Defender, firewall, audit logging, WDigest"
3. Scroll through the resource list to show the breadth
4. Switch preview to **MOF** — show the DependsOn chains
5. Click **Reset** to go back to the demo config (or reload it)

---

## Part 4: Download and Deploy (5 min)

### Download the bundle

1. Click **Download** — saves `DemoSecurityAudit.zip`
2. Extract and show the 6 files:
   - `DemoSecurityAudit.mof`
   - `DemoSecurityAudit.ps1`
   - `metaconfig_DemoSecurityAudit.json`
   - `policy.json`
   - `package.ps1`
   - `README.md`

### Run package.ps1 (live or pre-recorded)

```powershell
cd DemoSecurityAudit
pwsh ./package.ps1
```

> *"It detects the required module (PSDscResources), installs it, creates the deployable package, and runs a local compliance test. Green means the MOF is valid and evaluable."*

Show the output:
- Module detection from MOF
- Package creation → `output/DemoSecurityAudit.zip` with SHA256 hash
- Local test result

### Upload and deploy (if showing live Azure)

```powershell
# Upload to blob storage
$ctx = (Get-AzStorageAccount -ResourceGroupName 'myRG' -Name 'mystorage').Context
Set-AzStorageBlobContent -Container 'guestconfiguration' -File '.\output\DemoSecurityAudit.zip' -Context $ctx
$uri = New-AzStorageBlobSASToken -Container 'guestconfiguration' -Blob 'DemoSecurityAudit.zip' `
  -Permission r -ExpiryTime (Get-Date).AddYears(3) -Context $ctx -FullUri

# Get content hash
$hash = (Get-FileHash '.\output\DemoSecurityAudit.zip' -Algorithm SHA256).Hash

# Update policy.json (replace {{contentUri}} and {{contentHash}})
# Then create the policy
New-AzPolicyDefinition -Name 'DemoSecurityAudit' -Policy '.\policy.json' -Mode 'Indexed'

# Assign it
$def = Get-AzPolicyDefinition -Name 'DemoSecurityAudit'
New-AzPolicyAssignment -Name 'DemoSecurityAudit' -PolicyDefinition $def `
  -Scope '/subscriptions/<sub-id>/resourceGroups/<rg>'
```

---

## Part 5: Compliance Results (3 min)

> *"The MC agent on the VM downloads the package, evaluates the MOF against the actual machine state, and reports back to Azure."*

**If you pre-deployed 30 min ago:**

1. Open Azure Portal → Policy → Compliance
2. Filter to the demo policy
3. Show the compliance state (Compliant / NonCompliant)
4. Click into a non-compliant resource to show per-resource details

**If showing the GC assignment directly:**

```powershell
# Check assignment status
az rest --method GET --url "https://management.azure.com/subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.Compute/virtualMachines/<vm>/providers/Microsoft.GuestConfiguration/guestConfigurationAssignments/DemoSecurityAudit?api-version=2024-04-05"
```

> *"We've tested this end-to-end on Azure VMs (Windows + Linux), Arc-enabled servers, single and multi-resource configs, and remediation (AuditAndSet). Everything works — from the builder through to real Azure compliance reporting."*

---

## Part 6: Technical Highlights (3 min)

Bullet points to mention (pick what resonates with the audience):

- **29 DSC resources** across 6 modules — covers registry, services, files, packages, users, groups, firewall, audit policy, scheduled tasks, and more
- **9 pre-built templates** — CIS baselines, SSH hardening, network security, remediation
- **Cross-platform packaging** — build Linux configs from Windows and vice versa
- **Arc-aware policy generation** — one policy definition handles both Azure VMs and Arc servers automatically
- **E2E validated** — 137 unit tests + 46 package validation tests + real Azure deployment verification
- **No backend** — pure client-side, deploys as a static site to GitHub Pages
- **MIT licensed** — open source, available at [github.com/petarivanov-msft/azure-mc-builder](https://github.com/petarivanov-msft/azure-mc-builder)

---

## Backup Slides / Talking Points

**"How does remediation work?"**
> AuditAndSet mode generates a DINE (DeployIfNotExists) policy. The GC agent runs in `ApplyAndAutoCorrect` mode — it checks every 15 minutes and fixes any drift automatically. We've verified this: a Linux file was created from nothing by the agent, and it persists across reboots.

**"Why not just use Azure Policy Guest Configuration directly?"**
> You can, and this tool generates the exact same artifacts. The difference is you don't need to know MOF syntax, DSC module names, ARM template conditions, or the correct API versions. The builder handles all of that.

**"Does it work with Azure Arc?"**
> Yes. The generated policy `if` condition matches both `Microsoft.Compute/virtualMachines` and `Microsoft.HybridCompute/machines`. For DINE policies, the ARM template includes conditional resources for both. Tested and verified on an Arc-enabled Ubuntu container.

**"What about parameters?"**
> The policy generator supports `configurationParameter` — properties from your resources become parameters in the Azure Policy. It also generates `parameterHash` in the `existenceCondition` so the policy detects when parameter values change.

---

## Cleanup After Demo

```powershell
# Remove policy assignment and definition
Remove-AzPolicyAssignment -Name 'DemoSecurityAudit' -Scope '<scope>'
Remove-AzPolicyDefinition -Name 'DemoSecurityAudit'

# Delete the blob
Remove-AzStorageBlob -Container 'guestconfiguration' -Blob 'DemoSecurityAudit.zip' -Context $ctx

# Deallocate test VMs to stop billing
az vm deallocate -g <rg> -n <vm> --no-wait
```
