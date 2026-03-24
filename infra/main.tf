terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

variable "subscription_id" {
  description = "Azure subscription ID"
  # No default — set in terraform.tfvars or via -var
}

variable "location" {
  default = "uksouth"
}

variable "prefix" {
  description = "Prefix for resource names"
  default     = "mc-test"
}

variable "deploy_windows" {
  description = "Deploy a Windows test VM"
  type        = bool
  default     = true
}

variable "deploy_linux" {
  description = "Deploy a Linux test VM"
  type        = bool
  default     = true
}

variable "admin_username" {
  default = "azureuser"
}

variable "admin_password" {
  description = "VM admin password (min 12 chars, complexity required)"
  sensitive   = true
}

# --- Resource Group ---
resource "azurerm_resource_group" "main" {
  name     = "AMC-Testing"
  location = var.location

  tags = {
    purpose = "MC Builder testing"
    cleanup = "safe-to-delete"
  }
}

# --- Storage Account (for MC packages) ---
resource "azurerm_storage_account" "packages" {
  name                     = "${var.prefix}pkgs${random_id.suffix.hex}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "random_id" "suffix" {
  byte_length = 3
}

resource "azurerm_storage_container" "guestconfig" {
  name               = "guestconfiguration"
  storage_account_id = azurerm_storage_account.packages.id
}

# --- Network (shared) ---
resource "azurerm_virtual_network" "main" {
  name                = "${var.prefix}-vnet"
  address_space       = ["10.0.0.0/24"]
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
}

resource "azurerm_subnet" "main" {
  name                 = "default"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.0.0/24"]
}

resource "azurerm_network_security_group" "main" {
  name                = "${var.prefix}-nsg"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
}

# --- Windows VM ---
resource "azurerm_public_ip" "win" {
  count               = var.deploy_windows ? 1 : 0
  name                = "${var.prefix}-win-pip"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  allocation_method   = "Static"
  sku                 = "Standard"
}

resource "azurerm_network_interface" "win" {
  count               = var.deploy_windows ? 1 : 0
  name                = "${var.prefix}-win-nic"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.main.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.win[0].id
  }
}

resource "azurerm_windows_virtual_machine" "win" {
  count               = var.deploy_windows ? 1 : 0
  name                = "${var.prefix}-win"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  size                = "Standard_B1s"
  admin_username      = var.admin_username
  admin_password      = var.admin_password

  network_interface_ids = [azurerm_network_interface.win[0].id]

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "MicrosoftWindowsServer"
    offer     = "WindowsServer"
    sku       = "2022-datacenter-azure-edition"
    version   = "latest"
  }

  identity {
    type = "SystemAssigned"
  }

  tags = {
    purpose = "MC testing"
  }
}

# MC extension for Windows
resource "azurerm_virtual_machine_extension" "win_gc" {
  count                = var.deploy_windows ? 1 : 0
  name                 = "AzurePolicyforWindows"
  virtual_machine_id   = azurerm_windows_virtual_machine.win[0].id
  publisher            = "Microsoft.GuestConfiguration"
  type                 = "ConfigurationforWindows"
  type_handler_version = "1.0"
  auto_upgrade_minor_version = true
}

# --- Linux VM ---
resource "azurerm_public_ip" "linux" {
  count               = var.deploy_linux ? 1 : 0
  name                = "${var.prefix}-linux-pip"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  allocation_method   = "Static"
  sku                 = "Standard"
}

resource "azurerm_network_interface" "linux" {
  count               = var.deploy_linux ? 1 : 0
  name                = "${var.prefix}-linux-nic"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.main.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.linux[0].id
  }
}

resource "azurerm_linux_virtual_machine" "linux" {
  count               = var.deploy_linux ? 1 : 0
  name                = "${var.prefix}-linux"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  size                = "Standard_B1s"
  admin_username      = var.admin_username
  admin_password      = var.admin_password
  disable_password_authentication = false

  network_interface_ids = [azurerm_network_interface.linux[0].id]

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }

  identity {
    type = "SystemAssigned"
  }

  tags = {
    purpose = "MC testing"
  }
}

# MC extension for Linux
resource "azurerm_virtual_machine_extension" "linux_gc" {
  count                = var.deploy_linux ? 1 : 0
  name                 = "AzurePolicyforLinux"
  virtual_machine_id   = azurerm_linux_virtual_machine.linux[0].id
  publisher            = "Microsoft.GuestConfiguration"
  type                 = "ConfigurationforLinux"
  type_handler_version = "1.0"
  auto_upgrade_minor_version = true
}

# --- Outputs ---
output "resource_group" {
  value = azurerm_resource_group.main.name
}

output "storage_account" {
  value = azurerm_storage_account.packages.name
}

output "storage_key" {
  value     = azurerm_storage_account.packages.primary_access_key
  sensitive = true
}

output "windows_vm_name" {
  value = var.deploy_windows ? azurerm_windows_virtual_machine.win[0].name : "not deployed"
}

output "linux_vm_name" {
  value = var.deploy_linux ? azurerm_linux_virtual_machine.linux[0].name : "not deployed"
}

output "windows_public_ip" {
  value = var.deploy_windows ? azurerm_public_ip.win[0].ip_address : "not deployed"
}

output "linux_public_ip" {
  value = var.deploy_linux ? azurerm_public_ip.linux[0].ip_address : "not deployed"
}
