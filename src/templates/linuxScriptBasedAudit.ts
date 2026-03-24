import { ConfigurationState } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Linux Script-Based Audit — demonstrates nxScript for custom compliance checks.
 *
 * IMPORTANT nxScript contract:
 *  - TestScript must return [bool] ($true = compliant, $false = non-compliant)
 *  - GetScript must return @{ Reasons = @([Reason]@{Code='...'; Phrase='...'}) }
 *  - SetScript runs remediation (use "throw 'Audit only'" for audit-only configs)
 *  - Scripts run inside the GC agent's bundled pwsh — native Linux commands work directly
 */
export const linuxScriptBasedAudit: ConfigurationState = {
  configName: 'LinuxScriptBasedAudit',
  platform: 'Linux',
  mode: 'Audit',
  version: '1.0.0',
  description: 'Custom script-based compliance checks for Linux VMs using nxScript — demonstrates how to audit arbitrary conditions with TestScript/GetScript/SetScript',
  resources: [
    {
      id: uuidv4(), schemaName: 'nxScript', instanceName: 'CheckFirewallActive',
      properties: {
        TestScript: "$status = ufw status 2>/dev/null; if ($status -match 'Status: active') { return $true } else { return $false }",
        GetScript: "$status = ufw status 2>/dev/null; if ($status -match 'Status: active') { $msg = 'UFW firewall is active' } else { $msg = 'UFW firewall is NOT active' }; return @{ Reasons = @([Reason]@{ Code = 'LinuxScriptBasedAudit:CheckFirewallActive:FirewallStatus'; Phrase = $msg }) }",
        SetScript: "throw 'Audit only — enable firewall manually: sudo ufw enable'",
      },
      dependsOn: [],
    },
    {
      id: uuidv4(), schemaName: 'nxScript', instanceName: 'CheckNoWorldWritableFiles',
      properties: {
        TestScript: "$files = @(find /usr /etc -maxdepth 3 -perm -0002 -type f 2>/dev/null); return ($files.Count -eq 0)",
        GetScript: "$files = @(find /usr /etc -maxdepth 3 -perm -0002 -type f 2>/dev/null); if ($files.Count -eq 0) { $msg = 'No world-writable files found in /usr or /etc' } else { $msg = \"Found $($files.Count) world-writable files: $($files[0..4] -join ', ')\" }; return @{ Reasons = @([Reason]@{ Code = 'LinuxScriptBasedAudit:CheckNoWorldWritableFiles:WorldWritable'; Phrase = $msg }) }",
        SetScript: "throw 'Audit only — review and fix world-writable files manually'",
      },
      dependsOn: [],
    },
    {
      id: uuidv4(), schemaName: 'nxScript', instanceName: 'CheckTimeSyncConfigured',
      properties: {
        TestScript: "$status = timedatectl status 2>/dev/null; if ($status -match 'NTP service: active|System clock synchronized: yes') { return $true } else { return $false }",
        GetScript: "$status = timedatectl status 2>/dev/null; if ($status -match 'NTP service: active|System clock synchronized: yes') { $msg = 'NTP time synchronization is active' } else { $msg = 'NTP time synchronization is NOT configured' }; return @{ Reasons = @([Reason]@{ Code = 'LinuxScriptBasedAudit:CheckTimeSyncConfigured:NTPStatus'; Phrase = $msg }) }",
        SetScript: "throw 'Audit only — configure NTP: sudo timedatectl set-ntp true'",
      },
      dependsOn: [],
    },
    {
      id: uuidv4(), schemaName: 'nxScript', instanceName: 'CheckNoEmptyPasswords',
      properties: {
        TestScript: "$empty = @(awk -F: '($2 == \"\") {print $1}' /etc/shadow 2>/dev/null); return ($empty.Count -eq 0)",
        GetScript: "$empty = @(awk -F: '($2 == \"\") {print $1}' /etc/shadow 2>/dev/null); if ($empty.Count -eq 0) { $msg = 'No accounts with empty passwords found' } else { $msg = \"Accounts with empty passwords: $($empty -join ', ')\" }; return @{ Reasons = @([Reason]@{ Code = 'LinuxScriptBasedAudit:CheckNoEmptyPasswords:EmptyPasswords'; Phrase = $msg }) }",
        SetScript: "throw 'Audit only — lock accounts with empty passwords'",
      },
      dependsOn: [],
    },
    {
      id: uuidv4(), schemaName: 'nxScript', instanceName: 'CheckSwapDisabled',
      properties: {
        TestScript: "$swap = @(swapon --show 2>/dev/null); return ($swap.Count -le 1)",
        GetScript: "$swap = swapon --show 2>/dev/null; if (-not $swap -or $swap.Count -le 1) { $msg = 'Swap is disabled' } else { $msg = \"Swap is enabled: $($swap | Select-Object -Skip 1 | Select-Object -First 1)\" }; return @{ Reasons = @([Reason]@{ Code = 'LinuxScriptBasedAudit:CheckSwapDisabled:SwapStatus'; Phrase = $msg }) }",
        SetScript: "throw 'Audit only — disable swap: sudo swapoff -a'",
      },
      dependsOn: [],
    },
  ],
};
