# MC Builder Test Infrastructure

Terraform config to quickly spin up test VMs + storage for MC package testing.

## Quick Deploy

```bash
cd infra
terraform init
terraform apply -var="admin_password=YourP@ssw0rd123!"
```

## Quick Destroy

```bash
terraform destroy -auto-approve
```

## Options

| Variable | Default | Description |
|----------|---------|-------------|
| `deploy_windows` | `true` | Deploy a Windows Server 2022 VM |
| `deploy_linux` | `true` | Deploy an Ubuntu 24.04 VM |
| `admin_password` | *(required)* | VM admin password |
| `prefix` | `mc-test` | Resource name prefix |

Deploy only Linux:
```bash
terraform apply -var="admin_password=P@ss123!" -var="deploy_windows=false"
```

## What's Created

- Resource group `AMC-Testing` (tagged `safe-to-delete`)
- Storage account with `guestconfiguration` container
- Windows VM (Standard_B1s) with MC extension + managed identity
- Linux VM (Standard_B1s) with MC extension + managed identity
- VNet, subnet, NSG, public IPs

Everything is the smallest/cheapest tier. Destroy after testing.
