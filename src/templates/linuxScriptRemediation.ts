import { ConfigurationState } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Linux Script-Based Remediation — demonstrates nxScript in AuditAndSet mode.
 *
 * IMPORTANT nxScript contract:
 *  - TestScript must return [bool] ($true = compliant, $false = non-compliant)
 *  - GetScript must return @{ Reasons = @([Reason]@{Code='...'; Phrase='...'}) }
 *  - SetScript runs actual remediation (not just "throw")
 *  - Scripts run inside the GC agent's bundled pwsh — native Linux commands work directly
 *
 * Each resource checks a sysctl parameter and fixes it if wrong, persisting to /etc/sysctl.conf.
 */
export const linuxScriptRemediation: ConfigurationState = {
  configName: 'LinuxSysctlRemediation',
  platform: 'Linux',
  mode: 'AuditAndSet',
  version: '1.0.0',
  description: 'Audit and remediate Linux kernel sysctl parameters — IP forwarding, SYN cookies, ICMP redirects, reverse path filtering, core dumps',
  resources: [
    {
      id: uuidv4(), schemaName: 'nxScript', instanceName: 'DisableIPv4Forwarding',
      properties: {
        TestScript: "$val = (sysctl -n net.ipv4.ip_forward 2>/dev/null).Trim(); return ($val -eq '0')",
        GetScript: "$val = (sysctl -n net.ipv4.ip_forward 2>/dev/null).Trim(); if ($val -eq '0') { $msg = 'net.ipv4.ip_forward is correctly set to 0' } else { $msg = \"net.ipv4.ip_forward is set to $val (expected 0)\" }; return @{ Reasons = @([Reason]@{ Code = 'LinuxSysctlRemediation:DisableIPv4Forwarding:Sysctl'; Phrase = $msg }) }",
        SetScript: "sysctl -w net.ipv4.ip_forward=0; $content = Get-Content /etc/sysctl.conf -ErrorAction SilentlyContinue; if ($content -match 'net.ipv4.ip_forward') { $content -replace 'net\\.ipv4\\.ip_forward.*', 'net.ipv4.ip_forward = 0' | Set-Content /etc/sysctl.conf } else { Add-Content /etc/sysctl.conf 'net.ipv4.ip_forward = 0' }",
      },
      dependsOn: [],
    },
    {
      id: uuidv4(), schemaName: 'nxScript', instanceName: 'EnableSYNCookies',
      properties: {
        TestScript: "$val = (sysctl -n net.ipv4.tcp_syncookies 2>/dev/null).Trim(); return ($val -eq '1')",
        GetScript: "$val = (sysctl -n net.ipv4.tcp_syncookies 2>/dev/null).Trim(); if ($val -eq '1') { $msg = 'net.ipv4.tcp_syncookies is correctly set to 1' } else { $msg = \"net.ipv4.tcp_syncookies is set to $val (expected 1)\" }; return @{ Reasons = @([Reason]@{ Code = 'LinuxSysctlRemediation:EnableSYNCookies:Sysctl'; Phrase = $msg }) }",
        SetScript: "sysctl -w net.ipv4.tcp_syncookies=1; $content = Get-Content /etc/sysctl.conf -ErrorAction SilentlyContinue; if ($content -match 'net.ipv4.tcp_syncookies') { $content -replace 'net\\.ipv4\\.tcp_syncookies.*', 'net.ipv4.tcp_syncookies = 1' | Set-Content /etc/sysctl.conf } else { Add-Content /etc/sysctl.conf 'net.ipv4.tcp_syncookies = 1' }",
      },
      dependsOn: [],
    },
    {
      id: uuidv4(), schemaName: 'nxScript', instanceName: 'DisableICMPRedirects',
      properties: {
        TestScript: "$val = (sysctl -n net.ipv4.conf.all.accept_redirects 2>/dev/null).Trim(); return ($val -eq '0')",
        GetScript: "$val = (sysctl -n net.ipv4.conf.all.accept_redirects 2>/dev/null).Trim(); if ($val -eq '0') { $msg = 'net.ipv4.conf.all.accept_redirects is correctly set to 0' } else { $msg = \"net.ipv4.conf.all.accept_redirects is set to $val (expected 0)\" }; return @{ Reasons = @([Reason]@{ Code = 'LinuxSysctlRemediation:DisableICMPRedirects:Sysctl'; Phrase = $msg }) }",
        SetScript: "sysctl -w net.ipv4.conf.all.accept_redirects=0; $content = Get-Content /etc/sysctl.conf -ErrorAction SilentlyContinue; if ($content -match 'net.ipv4.conf.all.accept_redirects') { $content -replace 'net\\.ipv4\\.conf\\.all\\.accept_redirects.*', 'net.ipv4.conf.all.accept_redirects = 0' | Set-Content /etc/sysctl.conf } else { Add-Content /etc/sysctl.conf 'net.ipv4.conf.all.accept_redirects = 0' }",
      },
      dependsOn: [],
    },
    {
      id: uuidv4(), schemaName: 'nxScript', instanceName: 'EnableReversePathFiltering',
      properties: {
        TestScript: "$val = (sysctl -n net.ipv4.conf.all.rp_filter 2>/dev/null).Trim(); return ($val -eq '1')",
        GetScript: "$val = (sysctl -n net.ipv4.conf.all.rp_filter 2>/dev/null).Trim(); if ($val -eq '1') { $msg = 'net.ipv4.conf.all.rp_filter is correctly set to 1' } else { $msg = \"net.ipv4.conf.all.rp_filter is set to $val (expected 1)\" }; return @{ Reasons = @([Reason]@{ Code = 'LinuxSysctlRemediation:EnableReversePathFiltering:Sysctl'; Phrase = $msg }) }",
        SetScript: "sysctl -w net.ipv4.conf.all.rp_filter=1; $content = Get-Content /etc/sysctl.conf -ErrorAction SilentlyContinue; if ($content -match 'net.ipv4.conf.all.rp_filter') { $content -replace 'net\\.ipv4\\.conf\\.all\\.rp_filter.*', 'net.ipv4.conf.all.rp_filter = 1' | Set-Content /etc/sysctl.conf } else { Add-Content /etc/sysctl.conf 'net.ipv4.conf.all.rp_filter = 1' }",
      },
      dependsOn: [],
    },
    {
      id: uuidv4(), schemaName: 'nxScript', instanceName: 'DisableCoreDumps',
      properties: {
        TestScript: "$val = (sysctl -n fs.suid_dumpable 2>/dev/null).Trim(); return ($val -eq '0')",
        GetScript: "$val = (sysctl -n fs.suid_dumpable 2>/dev/null).Trim(); if ($val -eq '0') { $msg = 'fs.suid_dumpable is correctly set to 0 (core dumps disabled for setuid)' } else { $msg = \"fs.suid_dumpable is set to $val (expected 0)\" }; return @{ Reasons = @([Reason]@{ Code = 'LinuxSysctlRemediation:DisableCoreDumps:Sysctl'; Phrase = $msg }) }",
        SetScript: "sysctl -w fs.suid_dumpable=0; $content = Get-Content /etc/sysctl.conf -ErrorAction SilentlyContinue; if ($content -match 'fs.suid_dumpable') { $content -replace 'fs\\.suid_dumpable.*', 'fs.suid_dumpable = 0' | Set-Content /etc/sysctl.conf } else { Add-Content /etc/sysctl.conf 'fs.suid_dumpable = 0' }",
      },
      dependsOn: [],
    },
  ],
};
