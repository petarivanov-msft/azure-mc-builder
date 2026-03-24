# Azure Permissions Guide

Everything you need to set up before deploying Machine Configuration packages.

## 1. Register the Resource Provider

The `Microsoft.GuestConfiguration` resource provider must be registered on your subscription. This is a one-time step.

```bash
# Azure CLI
az provider register --namespace Microsoft.GuestConfiguration
az provider show --namespace Microsoft.GuestConfiguration --query registrationState

# PowerShell
Register-AzResourceProvider -ProviderNamespace Microsoft.GuestConfiguration
```

**Common error if skipped:** `The resource type 'guestConfigurationAssignments' could not be found`

## 2. Required RBAC Roles

### For creating and assigning custom policies

| Role | Scope | Why |
|------|-------|-----|
| **Resource Policy Contributor** | Subscription or Management Group | Create custom policy definitions and assign them |

This role includes:
- `Microsoft.Authorization/policyDefinitions/write` — create custom policies
- `Microsoft.Authorization/policyAssignments/write` — assign policies to scopes
- `Microsoft.Authorization/policyAssignments/delete` — remove assignments

### For uploading packages to blob storage

| Role | Scope | Why |
|------|-------|-----|
| **Storage Blob Data Contributor** | Storage account | Upload .zip packages and generate SAS tokens |

### For the managed identity (auto-handled by built-in policies)

The MC agent on VMs needs a system-assigned managed identity to pull packages and report compliance. The built-in initiative handles this, but if you're setting it up manually:

| Permission | Purpose |
|------------|---------|
| `Microsoft.Authorization/roleAssignments/write` | Assign the managed identity role to VMs |
| `Microsoft.Compute/virtualMachines/write` | Enable system-assigned identity on VMs |

### For testing (creating VMs)

| Role | Scope | Why |
|------|-------|-----|
| **Virtual Machine Contributor** | Resource group | Create and manage test VMs |

## 3. Built-in Policies (Must Be Assigned)

These three policies must be assigned at the subscription or management group level. Without them, the MC agent won't be installed on VMs and compliance won't be evaluated.

### Deploy MC Extension

Automatically installs the Machine Configuration extension on VMs.

| Platform | Policy Name | Policy ID |
|----------|-------------|-----------|
| Windows | Deploy the Windows Guest Configuration extension | `385f5831-96d4-41db-9a3c-cd3af78aaae6` |
| Linux | Deploy the Linux Guest Configuration extension | `331e8ea8-378a-410f-a2e5-ae22f38bb0da` |

```bash
# Assign Windows MC extension policy
az policy assignment create \
  --name "deploy-mc-windows" \
  --policy "385f5831-96d4-41db-9a3c-cd3af78aaae6" \
  --scope "/subscriptions/<subscription-id>" \
  --mi-system-assigned \
  --location uksouth

# Assign Linux MC extension policy
az policy assignment create \
  --name "deploy-mc-linux" \
  --policy "331e8ea8-378a-410f-a2e5-ae22f38bb0da" \
  --scope "/subscriptions/<subscription-id>" \
  --mi-system-assigned \
  --location uksouth
```

### Add System-Assigned Managed Identity

Ensures VMs have a system-assigned managed identity (required for the MC agent to authenticate).

| Policy Name | Policy ID |
|-------------|-----------|
| Add system-assigned managed identity | `3cf2ab00-13f1-4d0c-8971-2ac904541a7e` |

```bash
az policy assignment create \
  --name "add-system-identity" \
  --policy "3cf2ab00-13f1-4d0c-8971-2ac904541a7e" \
  --scope "/subscriptions/<subscription-id>" \
  --mi-system-assigned \
  --location uksouth
```

> **Tip:** There's a built-in **initiative** (policy set) that bundles all three: `Deploy prerequisites to enable Guest Configuration policies on virtual machines`. Initiative ID: `12794019-7a00-42cf-95c2-882eed337cc8`. Assigning this one initiative covers everything.

```bash
# Assign the initiative (recommended — covers all three)
az policy assignment create \
  --name "mc-prerequisites" \
  --policy-set-definition "12794019-7a00-42cf-95c2-882eed337cc8" \
  --scope "/subscriptions/<subscription-id>" \
  --mi-system-assigned \
  --location uksouth
```

## 4. Storage Account Setup

You need a storage account to host your MC packages. The MC agent downloads packages via HTTPS (SAS token or managed identity).

```bash
# Create resource group and storage account
az group create -n MC-Packages -l uksouth
az storage account create -n mcpackagesstore -g MC-Packages -l uksouth --sku Standard_LRS

# Create a container for packages
az storage container create --account-name mcpackagesstore -n guestconfiguration

# Upload a package
az storage blob upload \
  --account-name mcpackagesstore \
  --container-name guestconfiguration \
  --file ./output/MyConfig.zip \
  --name MyConfig.zip

# Generate a read-only SAS URL (valid 3 years)
az storage blob generate-sas \
  --account-name mcpackagesstore \
  --container-name guestconfiguration \
  --name MyConfig.zip \
  --permissions r \
  --expiry $(date -u -d "+3 years" '+%Y-%m-%dT%H:%MZ') \
  --full-uri
```

## 5. Complete Setup Checklist

```
[ ] Microsoft.GuestConfiguration resource provider registered
[ ] Resource Policy Contributor role assigned (subscription scope)
[ ] Storage Blob Data Contributor role assigned (storage account)
[ ] Built-in MC prerequisites initiative assigned
[ ] Storage account and container created
[ ] Package uploaded with SAS URL generated
[ ] Policy definition created with contentUri and contentHash
[ ] Policy assigned to target scope
```

## 6. Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `The resource type 'guestConfigurationAssignments' could not be found` | Resource provider not registered | `az provider register --namespace Microsoft.GuestConfiguration` |
| `GuestConfigurationAssignmentValidationFailed` | Hash mismatch between policy and actual package | Re-generate hash: `Get-FileHash MyConfig.zip -Algorithm SHA256` |
| `couldn't find PowerShell DSC resource with moduleName:nx` | Using the legacy `nx` module instead of `nxtools` | Rebuild package with `nxtools` module (this builder handles it) |
| `Extension 'AzurePolicyforLinux' not found` | MC extension not deployed | Assign the MC prerequisites initiative |
| Compliance stuck at "Not started" | MC extension not installed or identity missing | Check VM extensions and managed identity |
| Results take >30 minutes | Normal for first evaluation after assignment | MC agent polls every ~15 min; first eval can take up to 30 min |
